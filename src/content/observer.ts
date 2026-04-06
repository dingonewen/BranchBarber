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
import { summarizeWithGemini, inferGhostTopic } from "../utils/gemini";

let platform: Platform = "unknown";
let conversationId: string = "";
let mutationObserver: MutationObserver | null = null;
let processedCount = 0;

// ── Layout tracking ───────────────────────────────────────────────────────────
// Positions are parent-relative: each node is placed directly below its parent
// (left child, same x) or to the right (side-quest/right child, x + NODE_W).
const NODE_W = 240;
const NODE_H = 130;

// Current tip of each branch — used to parent new nodes correctly
let mainBranchCurrentId: string | null = null;
let sideQuestCurrentId:  string | null = null;
let inSideQuest = false;

function resetLayout(): void {
  mainBranchCurrentId = null;
  sideQuestCurrentId  = null;
  inSideQuest         = false;
}

function rebuildLayoutFromNodes(nodes: ConversationNode[]): void {
  resetLayout();
  // Sorted by domIndex; ghost nodes have domIndex=-1 so they come first
  const sorted = [...nodes].sort((a, b) => a.domIndex - b.domIndex);
  for (const n of sorted) {
    if (n.isRoot) {
      mainBranchCurrentId = n.id;
    } else if (n.isGhost) {
      mainBranchCurrentId = n.id; // ghost is the left-child placeholder
    } else if (n.isSideQuest) {
      if (!inSideQuest) inSideQuest = true;
      sideQuestCurrentId = n.id;
    } else {
      if (inSideQuest) { inSideQuest = false; sideQuestCurrentId = null; }
      mainBranchCurrentId = n.id;
    }
  }
}

// Get a node's position from the store, with a safe fallback
function parentPos(nodeId: string | null): { x: number; y: number } {
  if (!nodeId) return { x: 0, y: -NODE_H };
  return useBranchStore.getState().nodes[nodeId]?.position ?? { x: 0, y: -NODE_H };
}

export function initObserver(): void {
  platform = detectPlatform();
  if (platform === "unknown") return;
  initConversation().then(() => {
    scanAndProcessTurns();
    startMutationObserver();
  });
}

function isContextValid(): boolean {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

function requestEmbedding(text: string, id: string): Promise<number[]> {
  return new Promise((resolve) => {
    if (!isContextValid()) { resolve([]); return; }
    const timeoutId = setTimeout(() => resolve([]), 60000);
    try {
      chrome.runtime.sendMessage(
        { type: "EMBED", id, text },
        (response: { id: string; embedding: number[]; error?: string }) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError || !response || response.error) resolve([]);
          else resolve(response.embedding ?? []);
        }
      );
    } catch {
      clearTimeout(timeoutId);
      resolve([]);
    }
  });
}

async function initConversation(): Promise<void> {
  const url = getConversationUrl();
  useBranchStore.getState().clearConversation();

  const [existing, settings] = await Promise.all([
    getConversationByUrl(url),
    getOrCreateSettings(),
  ]);

  useBranchStore.getState().setSettings({
    geminiApiKey: settings.geminiApiKey,
    driftThreshold: settings.driftThreshold,
    autoDetectBranches: settings.autoDetectBranches,
    summaryMode: settings.summaryMode ?? "local",
  });

  if (existing) {
    conversationId = existing.id;
    useBranchStore.getState().setConversation(conversationId, existing);
    const nodes = await getConversationNodes(conversationId);
    useBranchStore.getState().loadNodes(nodes);
    processedCount = nodes.filter((n) => !n.isGhost).length;
    rebuildLayoutFromNodes(nodes);
  } else {
    conversationId = generateId();
    const meta: ConversationMeta = {
      id: conversationId, url, title: getConversationTitle(),
      rootNodeId: null, currentNodeId: null,
      createdAt: Date.now(), updatedAt: Date.now(),
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
    mutationObserver = new MutationObserver(debounce(handleMutations, 800) as MutationCallback);
    mutationObserver.observe(target, { childList: true, subtree: true });
  };
  tryAttach();

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

const handleMutations = (): void => { scanAndProcessTurns(); };

async function scanAndProcessTurns(): Promise<void> {
  if (!isContextValid()) return;
  const userTurns = getUserTurns(platform);
  const aiTurns   = getAITurns(platform);
  const pairCount = Math.min(userTurns.length, aiTurns.length);
  if (pairCount <= processedCount) return;

  const store    = useBranchStore.getState();
  const settings = await getOrCreateSettings();

  for (let i = processedCount; i < pairCount; i++) {
    const prompt   = extractText(userTurns[i]);
    const response = extractText(aiTurns[i]);
    if (!prompt || !response) continue;

    const nodeId = generateId();
    const isRoot = i === 0 && store.rootNodeId === null;

    // ── Drift detection ───────────────────────────────────────────────────────
    const SHIFT_KEYWORDS = [
      '另外','换个话题','换个问题','对了','顺便问','顺便说',
      'by the way','btw','anyway','separate question','separate issue',
      'different topic','change of topic','unrelated',
    ];
    const keywordShift = SHIFT_KEYWORDS.some((k) => prompt.toLowerCase().includes(k));

    let driftScore = 0;
    let embedding: number[] = [];
    const textForEmbedding = `${prompt} ${response}`.slice(0, 512);
    embedding = await requestEmbedding(textForEmbedding, nodeId);

    if (!isRoot) {
      const parentNodeId = inSideQuest ? sideQuestCurrentId : mainBranchCurrentId;
      const parentDbNode = parentNodeId ? await db.nodes.get(parentNodeId) : null;
      if (embedding.length > 0 && parentDbNode?.embedding && parentDbNode.embedding.length > 0) {
        driftScore = 1 - cosineSimilarity(embedding, parentDbNode.embedding);

      } else {
        const parentText = parentDbNode ? `${parentDbNode.prompt} ${parentDbNode.response}` : "";
        if (parentText) {
          driftScore = lexicalDrift(textForEmbedding, parentText.slice(0, 512));

        }
      }
    }

    const threshold   = 1 - settings.driftThreshold;
    const isSideQuest = settings.autoDetectBranches && (keywordShift || driftScore > threshold);

    // ── Position + parentId (parent-relative layout) ──────────────────────────
    // The tree is a binary-ish structure:
    //   Left child  (no drift)  = (parentX,         parentY + NODE_H)
    //   Right child (drift)     = (parentX + NODE_W, parentY + NODE_H)
    // When drift is detected, a ghost left-child placeholder is also created.

    let parentId: string | null;
    let position: { x: number; y: number };
    let depth: number;

    if (isRoot) {
      parentId            = null;
      position            = { x: 0, y: 0 };
      depth               = 0;
      mainBranchCurrentId = nodeId;
      inSideQuest         = false;

    } else if (isSideQuest && !inSideQuest) {
      // ── Branch begins ─────────────────────────────────────────────────────
      // Branch from the current main-branch tip
      const branchFromId  = mainBranchCurrentId;
      const bp            = parentPos(branchFromId);

      // Left-child ghost (placeholder for main continuation)
      const ghostId    = generateId();
      const ghostLabel = "Continue main thread here";
      const ghostNode: ConversationNode = {
        id: ghostId, conversationId,
        parentId: branchFromId,
        prompt: "", response: "", summary: ghostLabel, label: ghostLabel,
        embedding: null, driftScore: 0,
        isBranch: false, isRoot: false, isSideQuest: false, isGhost: true,
        domIndex: -1, createdAt: Date.now(),
        depth: Math.round(bp.y / NODE_H) + 1,
        position: { x: bp.x, y: bp.y + NODE_H },      // left child
      };
      await upsertNode(ghostNode);
      store.addNode(ghostNode);

      // Async: fill ghost label by summarising the direct parent node
      if ((settings.summaryMode ?? "local") === "gemini" && settings.geminiApiKey && branchFromId) {
        db.nodes.get(branchFromId).then((n) => {
          if (!n) return;
          const ctx = `${n.prompt}\n\n${n.response}`.slice(0, 600);
          inferGhostTopic(ctx, settings.geminiApiKey).then((label) => {
            db.nodes.update(ghostId, { label, summary: label });
            useBranchStore.getState().updateNodeLabel(ghostId, label);
          });
        });
      }

      // Main branch pointer advances to ghost so future normal nodes hang off it
      mainBranchCurrentId = ghostId;

      // Right child = side quest node
      parentId           = branchFromId;             // same parent as ghost
      position           = { x: bp.x + NODE_W, y: bp.y + NODE_H };  // right child
      depth              = Math.round(bp.y / NODE_H) + 1;
      inSideQuest        = true;
      sideQuestCurrentId = nodeId;

    } else if (isSideQuest && inSideQuest) {
      // ── Continue down the side quest ──────────────────────────────────────
      const sqp    = parentPos(sideQuestCurrentId);
      parentId     = sideQuestCurrentId;
      position     = { x: sqp.x, y: sqp.y + NODE_H };  // left child of side-quest tip
      depth        = Math.round(sqp.y / NODE_H) + 1;
      sideQuestCurrentId = nodeId;

    } else {
      // ── Normal main-branch continuation ───────────────────────────────────
      if (inSideQuest) { inSideQuest = false; sideQuestCurrentId = null; }
      const mp    = parentPos(mainBranchCurrentId);
      parentId    = mainBranchCurrentId;
      position    = { x: mp.x, y: mp.y + NODE_H };   // left child of main tip
      depth       = Math.round(mp.y / NODE_H) + 1;
      mainBranchCurrentId = nodeId;
    }

    const useGemini = (settings.summaryMode ?? "local") === "gemini" && !!settings.geminiApiKey;
    const summary = await summarizeWithGemini(prompt, response, useGemini ? settings.geminiApiKey : "");

    const node: ConversationNode = {
      id: nodeId, conversationId,
      parentId: isRoot ? null : parentId,
      prompt, response, summary, embedding,
      driftScore, isBranch: false, isRoot, isSideQuest,
      domIndex: i, createdAt: Date.now(),
      label: summary || `Turn ${i + 1}`,
      depth, position,
    };

    await upsertNode(node);
    await upsertConversation({
      id: conversationId, url: getConversationUrl(), title: getConversationTitle(),
      rootNodeId: isRoot ? nodeId : store.rootNodeId,
      currentNodeId: nodeId, createdAt: Date.now(), updatedAt: Date.now(),
    });

    store.addNode(node);
    if (isSideQuest) store.setDriftAlert({ nodeId, score: driftScore });

    injectBranchButton(aiTurns[i], nodeId);
    processedCount = i + 1;
  }
}

function injectBranchButton(aiElement: Element, nodeId: string): void {
  if (aiElement.querySelector("[data-branchbarber-btn]")) return;
  const btn = document.createElement("button");
  btn.dataset.branchbarberBtn = nodeId;
  btn.style.cssText = `
    display:inline-flex;align-items:center;gap:4px;margin-top:6px;
    padding:4px 10px;font-size:11px;font-weight:600;
    color:#7c3aed;background:rgba(124,58,237,0.08);
    border:1px solid rgba(124,58,237,0.3);border-radius:6px;
    cursor:pointer;font-family:inherit;position:relative;z-index:9999;
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
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;padding:4px 0;margin-top:2px;";
  bar.appendChild(btn);
  aiElement.appendChild(bar);
}

export function destroyObserver(): void {
  mutationObserver?.disconnect();
}
