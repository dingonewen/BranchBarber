import { debounce, generateId, cosineSimilarity, lexicalDrift } from "../utils";
import type { Platform } from "./selectors";
import {
  detectPlatform,
  getConversationContainer,
  getUserTurns,
  getAITurns,
  extractText,
  getConversationUrl,
  getConversationTitle,
} from "./selectors";
import {
  db,
  upsertNode,
  upsertConversation,
  getConversationNodes,
  getConversationByUrl,
  getOrCreateSettings,
} from "../db";
import type { ConversationNode, ConversationMeta } from "../db";
import { useBranchStore } from "../store";
import { summarizeWithGemini } from "../utils/gemini";

let platform: Platform = "unknown";
let conversationId: string = "";
let mutationObserver: MutationObserver | null = null;

// Track processed turn count to avoid re-processing
let processedCount = 0;

// ── Layout tracking ──────────────────────────────────────────────────────────
// Main branch goes down column 0 (x=0).
// Side quests branch off to column 1+ (x = col * NODE_W).
const NODE_W = 240;
const NODE_H = 130;

let mainBranchCurrentId: string | null = null; // tip of the main thread
let sideQuestCurrentId: string | null  = null; // tip of current side quest
let inSideQuest        = false;
let mainBranchRow      = 0;   // next y index for main branch
let sideQuestRow       = 0;   // next y index for current side quest
let sideQuestCol       = 1;   // x column for next/current side quest

function resetLayout(): void {
  mainBranchCurrentId = null;
  sideQuestCurrentId  = null;
  inSideQuest         = false;
  mainBranchRow       = 0;
  sideQuestRow        = 0;
  sideQuestCol        = 1;
}

function rebuildLayoutFromNodes(nodes: import("../db").ConversationNode[]): void {
  resetLayout();
  const sorted = [...nodes].sort((a, b) => a.domIndex - b.domIndex);
  for (const n of sorted) {
    if (n.isRoot) {
      mainBranchCurrentId = n.id;
      mainBranchRow = 1;
    } else if (n.isSideQuest) {
      if (!inSideQuest) {
        inSideQuest  = true;
        sideQuestRow = mainBranchRow;
      }
      sideQuestCurrentId = n.id;
      sideQuestRow++;
    } else {
      if (inSideQuest) {
        inSideQuest        = false;
        sideQuestCurrentId = null;
        sideQuestCol++;
      }
      mainBranchCurrentId = n.id;
      mainBranchRow++;
    }
  }
}

export function initObserver(): void {
  platform = detectPlatform();
  if (platform === "unknown") return;

  // Wait for conversation init, then do an immediate scan for already-loaded
  // turns (important for Gemini where DOM is stable at injection time)
  initConversation().then(() => {
    scanAndProcessTurns();
    startMutationObserver();
  });
}

// Route embedding requests through background → offscreen document.
// This avoids host-page CSP restrictions entirely.
function requestEmbedding(text: string, id: string): Promise<number[]> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve([]), 30000);

    chrome.runtime.sendMessage(
      { type: "EMBED", id, text },
      (response: { id: string; embedding: number[]; error?: string }) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError || !response || response.error) {
          resolve([]);
        } else {
          resolve(response.embedding ?? []);
        }
      }
    );

    // Resolve empty if extension context is invalidated
    if (chrome.runtime.lastError) {
      clearTimeout(timeoutId);
      resolve([]);
    }
  });
}


async function initConversation(): Promise<void> {
  const url = getConversationUrl();

  // Always clear previous conversation's tree from the UI first
  useBranchStore.getState().clearConversation();

  const [existing, settings] = await Promise.all([
    getConversationByUrl(url),
    getOrCreateSettings(),
  ]);

  useBranchStore.getState().setSettings({
    geminiApiKey: settings.geminiApiKey,
    driftThreshold: settings.driftThreshold,
    autoDetectBranches: settings.autoDetectBranches,
  });

  if (existing) {
    conversationId = existing.id;
    useBranchStore.getState().setConversation(conversationId, existing);
    const nodes = await getConversationNodes(conversationId);
    useBranchStore.getState().loadNodes(nodes);
    processedCount = nodes.length;
    rebuildLayoutFromNodes(nodes);
  } else {
    conversationId = generateId();
    const meta: ConversationMeta = {
      id: conversationId,
      url,
      title: getConversationTitle(),
      rootNodeId: null,
      currentNodeId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await upsertConversation(meta);
    useBranchStore.getState().setConversation(conversationId, meta);
    processedCount = 0;
    resetLayout();
  }
}

function startMutationObserver(): void {
  const tryAttach = (): void => {
    const container = getConversationContainer(platform);
    const target = container ?? document.body;

    mutationObserver?.disconnect();
    mutationObserver = new MutationObserver(
      debounce(handleMutations, 800) as MutationCallback
    );
    mutationObserver.observe(target, {
      childList: true,
      subtree: true,
      characterData: false,
      attributes: false,
    });
  };

  tryAttach();

  // Re-attach on URL change (SPA navigation)
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      processedCount = 0;
      initConversation().then(tryAttach);
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });
}

const handleMutations = (): void => {
  scanAndProcessTurns();
};

async function scanAndProcessTurns(): Promise<void> {
  const userTurns = getUserTurns(platform);
  const aiTurns = getAITurns(platform);

  const pairCount = Math.min(userTurns.length, aiTurns.length);
  if (pairCount <= processedCount) return;

  const store = useBranchStore.getState();
  const settings = await getOrCreateSettings();

  for (let i = processedCount; i < pairCount; i++) {
    const prompt = extractText(userTurns[i]);
    const response = extractText(aiTurns[i]);
    if (!prompt || !response) continue;

    const nodeId = generateId();
    const isRoot = i === 0 && store.rootNodeId === null;

    // ── Drift detection ───────────────────────────────────────────────────────
    // Layer 1: keyword check (instant, free)
    const SHIFT_KEYWORDS = [
      '另外', '换个话题', '换个问题', '对了', '顺便问', '顺便说',
      'by the way', 'btw', 'anyway', 'separate question', 'separate issue',
      'different topic', 'change of topic', 'unrelated',
    ];
    const keywordShift = SHIFT_KEYWORDS.some((k) =>
      prompt.toLowerCase().includes(k)
    );

    // Layer 2: embedding similarity vs PARENT node (not root)
    // Detects sudden local topic jumps, not just "different from beginning"
    let driftScore = 0;
    let embedding: number[] = [];
    const textForEmbedding = `${prompt} ${response}`.slice(0, 512);
    embedding = await requestEmbedding(textForEmbedding, nodeId);

    if (!isRoot) {
      const parentNodeId = inSideQuest ? sideQuestCurrentId : mainBranchCurrentId;
      const parentDbNode = parentNodeId ? await db.nodes.get(parentNodeId) : null;

      if (embedding.length > 0 && parentDbNode?.embedding && parentDbNode.embedding.length > 0) {
        // ML embeddings available — use cosine similarity
        driftScore = 1 - cosineSimilarity(embedding, parentDbNode.embedding);
        console.log(`[BranchBarber] Turn ${i} embedding drift vs parent: ${driftScore.toFixed(3)}`);
      } else {
        // Fallback: lexical TF-IDF drift (works without model)
        const parentText = parentDbNode ? `${parentDbNode.prompt} ${parentDbNode.response}` : "";
        if (parentText) {
          driftScore = lexicalDrift(textForEmbedding, parentText.slice(0, 512));
          console.log(`[BranchBarber] Turn ${i} lexical drift vs parent: ${driftScore.toFixed(3)} (embeddings unavailable)`);
        }
      }
    }

    const threshold = 1 - settings.driftThreshold;
    const isSideQuest =
      settings.autoDetectBranches &&
      (keywordShift || driftScore > threshold);

    console.log(`[BranchBarber] Turn ${i}: keyword=${keywordShift}, drift=${driftScore.toFixed(3)}, threshold=${threshold.toFixed(2)}, branch=${isSideQuest}`);

    // ── Determine parentId and position ──────────────────────────────────────
    // Main thread runs down column 0 (x=0). Side quests branch to column 1+.
    // parentId points to the branching ancestor, not just the previous node.
    let parentId: string | null;
    let position: { x: number; y: number };
    let depth: number;

    if (isRoot) {
      parentId            = null;
      position            = { x: 0, y: 0 };
      depth               = 0;
      mainBranchCurrentId = nodeId;
      mainBranchRow       = 1;
      inSideQuest         = false;
    } else if (isSideQuest) {
      if (!inSideQuest) {
        // First node of this side quest — branch from the current main-branch tip
        inSideQuest  = true;
        sideQuestRow = mainBranchRow; // visually align with where we're branching from
        parentId     = mainBranchCurrentId;
        depth        = mainBranchRow; // same depth level as the branching point
      } else {
        parentId = sideQuestCurrentId;
        depth    = sideQuestRow;
      }
      position           = { x: sideQuestCol * NODE_W, y: sideQuestRow * NODE_H };
      sideQuestCurrentId = nodeId;
      sideQuestRow++;
    } else {
      if (inSideQuest) {
        // Returning to main thread after a side quest
        inSideQuest        = false;
        sideQuestCurrentId = null;
        sideQuestCol++;    // reserve this column; next side quest gets a fresh one
      }
      parentId            = mainBranchCurrentId;
      position            = { x: 0, y: mainBranchRow * NODE_H };
      depth               = mainBranchRow;
      mainBranchCurrentId = nodeId;
      mainBranchRow++;
    }

    const summary = await summarizeWithGemini(
      prompt,
      response,
      settings.geminiApiKey
    );

    const node: ConversationNode = {
      id: nodeId,
      conversationId,
      parentId: isRoot ? null : parentId,
      prompt,
      response,
      summary,
      embedding,
      driftScore,
      isBranch: false,
      isRoot,
      isSideQuest,
      domIndex: i,
      createdAt: Date.now(),
      label: summary || `Turn ${i + 1}`,
      depth,
      position,
    };

    await upsertNode(node);

    // Update conversation meta
    await upsertConversation({
      id: conversationId,
      url: getConversationUrl(),
      title: getConversationTitle(),
      rootNodeId: isRoot ? nodeId : store.rootNodeId,
      currentNodeId: nodeId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    store.addNode(node);

    if (isRoot && embedding.length > 0) {
      // Root embedding is now stored; update DB
      await db.nodes.update(nodeId, { embedding });
    }

    if (isSideQuest) {
      store.setDriftAlert({ nodeId, score: driftScore });
    }

    // Inject "Mark as Branch" button next to this AI response
    injectBranchButton(aiTurns[i], nodeId);

    processedCount = i + 1;
  }
}

function injectBranchButton(aiElement: Element, nodeId: string): void {
  const existingBtn = aiElement.querySelector("[data-branchbarber-btn]");
  if (existingBtn) return;

  const btn = document.createElement("button");
  btn.dataset.branchbarberBtn = nodeId;
  btn.setAttribute("title", "Mark as Branch Point");
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    color: #7c3aed;
    background: rgba(124,58,237,0.08);
    border: 1px solid rgba(124,58,237,0.3);
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
    font-family: inherit;
    z-index: 9999;
    position: relative;
  `;
  btn.textContent = "✂ Branch Here";

  btn.addEventListener("click", () => {
    useBranchStore.getState().markAsBranch(nodeId);
    db.nodes.update(nodeId, { isBranch: true });
    btn.textContent = "✓ Branched";
    btn.style.color = "#16a34a";
    btn.style.borderColor = "rgba(22,163,74,0.4)";
    btn.style.background = "rgba(22,163,74,0.08)";
  });

  // Append button after the AI turn element
  const actionBar = document.createElement("div");
  actionBar.style.cssText = "display:flex; padding: 4px 0; margin-top: 2px;";
  actionBar.appendChild(btn);
  aiElement.appendChild(actionBar);
}

export function destroyObserver(): void {
  mutationObserver?.disconnect();
}
