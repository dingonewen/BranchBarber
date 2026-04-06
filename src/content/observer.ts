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

// ── Layout state ─────────────────────────────────────────────────────────────
// Column 0 = main branch (left). Side quests get column 1, 2, …
const NODE_W = 240;
const NODE_H = 130;

let mainBranchCurrentId: string | null = null; // tip of main thread (may be a ghost)
let sideQuestCurrentId:  string | null = null;
let inSideQuest = false;
let mainBranchRow = 0;  // next available row on main branch
let sideQuestRow  = 0;
let sideQuestCol  = 1;

function resetLayout(): void {
  mainBranchCurrentId = null;
  sideQuestCurrentId  = null;
  inSideQuest         = false;
  mainBranchRow       = 0;
  sideQuestRow        = 0;
  sideQuestCol        = 1;
}

function rebuildLayoutFromNodes(nodes: ConversationNode[]): void {
  resetLayout();
  const sorted = [...nodes].sort((a, b) => a.domIndex - b.domIndex);
  for (const n of sorted) {
    if (n.isGhost) {
      mainBranchCurrentId = n.id;
      // don't advance mainBranchRow — ghost was placed at current row
    } else if (n.isRoot) {
      mainBranchCurrentId = n.id;
      mainBranchRow = 1;
    } else if (n.isSideQuest) {
      if (!inSideQuest) {
        inSideQuest  = true;
        sideQuestRow = mainBranchRow + 1;
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
  initConversation().then(() => {
    scanAndProcessTurns();
    startMutationObserver();
  });
}

function requestEmbedding(text: string, id: string): Promise<number[]> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve([]), 30000);
    chrome.runtime.sendMessage(
      { type: "EMBED", id, text },
      (response: { id: string; embedding: number[]; error?: string }) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError || !response || response.error) resolve([]);
        else resolve(response.embedding ?? []);
      }
    );
    if (chrome.runtime.lastError) { clearTimeout(timeoutId); resolve([]); }
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
  });

  if (existing) {
    conversationId = existing.id;
    useBranchStore.getState().setConversation(conversationId, existing);
    const nodes = await getConversationNodes(conversationId);
    useBranchStore.getState().loadNodes(nodes);
    // processedCount = only real (non-ghost) turns
    processedCount = nodes.filter((n) => !n.isGhost).length;
    rebuildLayoutFromNodes(nodes);
  } else {
    conversationId = generateId();
    const meta: ConversationMeta = {
      id: conversationId, url,
      title: getConversationTitle(),
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

    // ── Layer 1: keyword drift ────────────────────────────────────────────────
    const SHIFT_KEYWORDS = [
      '另外', '换个话题', '换个问题', '对了', '顺便问', '顺便说',
      'by the way', 'btw', 'anyway', 'separate question', 'separate issue',
      'different topic', 'change of topic', 'unrelated',
    ];
    const keywordShift = SHIFT_KEYWORDS.some((k) => prompt.toLowerCase().includes(k));

    // ── Layer 2: parent-relative similarity ───────────────────────────────────
    let driftScore = 0;
    let embedding: number[] = [];
    const textForEmbedding = `${prompt} ${response}`.slice(0, 512);
    embedding = await requestEmbedding(textForEmbedding, nodeId);

    if (!isRoot) {
      const parentNodeId = inSideQuest ? sideQuestCurrentId : mainBranchCurrentId;
      const parentDbNode = parentNodeId ? await db.nodes.get(parentNodeId) : null;
      if (embedding.length > 0 && parentDbNode?.embedding && parentDbNode.embedding.length > 0) {
        driftScore = 1 - cosineSimilarity(embedding, parentDbNode.embedding);
        console.log(`[BB] Turn ${i} embedding drift: ${driftScore.toFixed(3)}`);
      } else {
        const parentText = parentDbNode ? `${parentDbNode.prompt} ${parentDbNode.response}` : "";
        if (parentText) {
          driftScore = lexicalDrift(textForEmbedding, parentText.slice(0, 512));
          console.log(`[BB] Turn ${i} lexical drift: ${driftScore.toFixed(3)}`);
        }
      }
    }

    const threshold   = 1 - settings.driftThreshold;
    const isSideQuest = settings.autoDetectBranches && (keywordShift || driftScore > threshold);
    console.log(`[BB] Turn ${i}: keyword=${keywordShift} drift=${driftScore.toFixed(3)} thr=${threshold.toFixed(2)} → branch=${isSideQuest}`);

    // ── Layout + parentId ─────────────────────────────────────────────────────
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

    } else if (isSideQuest && !inSideQuest) {
      // ── First node of a new side quest ───────────────────────────────────
      // Both the ghost node AND the side quest node are siblings, children of
      // the current main-branch tip.
      const branchParent = mainBranchCurrentId;
      const ghostRow     = mainBranchRow;

      // Create ghost node (synthetic placeholder on main branch)
      const ghostId    = generateId();
      const ghostLabel = "Continue main thread here";
      const ghostNode: ConversationNode = {
        id: ghostId, conversationId,
        parentId: branchParent,
        prompt: "", response: "",
        summary: ghostLabel, label: ghostLabel,
        embedding: null, driftScore: 0,
        isBranch: false, isRoot: false, isSideQuest: false, isGhost: true,
        domIndex: -1,
        createdAt: Date.now(),
        depth: ghostRow,
        position: { x: 0, y: ghostRow * NODE_H },
      };
      await upsertNode(ghostNode);
      store.addNode(ghostNode);

      // Async: fill ghost label with Gemini prediction (non-blocking)
      if (settings.geminiApiKey) {
        const context = branchParent
          ? await db.nodes.get(branchParent).then((n) => n ? `${n.prompt} ${n.response}` : "")
          : "";
        inferGhostTopic(context, settings.geminiApiKey).then((label) => {
          db.nodes.update(ghostId, { label, summary: label });
          useBranchStore.getState().updateNodeLabel(ghostId, label);
        });
      }

      // Now the main branch pointer advances to the ghost
      mainBranchCurrentId = ghostId;
      mainBranchRow       = ghostRow + 1; // ghost occupies this row

      // Side quest node branches from the same parent as the ghost
      inSideQuest        = true;
      sideQuestRow       = ghostRow;      // same y-row as ghost
      parentId           = branchParent;
      position           = { x: sideQuestCol * NODE_W, y: sideQuestRow * NODE_H };
      depth              = ghostRow;
      sideQuestCurrentId = nodeId;
      sideQuestRow++;

    } else if (isSideQuest && inSideQuest) {
      // Continuing down the current side quest
      parentId           = sideQuestCurrentId;
      position           = { x: sideQuestCol * NODE_W, y: sideQuestRow * NODE_H };
      depth              = sideQuestRow;
      sideQuestCurrentId = nodeId;
      sideQuestRow++;

    } else {
      // Main branch (returning from side quest or normal continuation)
      if (inSideQuest) {
        inSideQuest        = false;
        sideQuestCurrentId = null;
        sideQuestCol++;
      }
      parentId            = mainBranchCurrentId;
      position            = { x: 0, y: mainBranchRow * NODE_H };
      depth               = mainBranchRow;
      mainBranchCurrentId = nodeId;
      mainBranchRow++;
    }

    const summary = await summarizeWithGemini(prompt, response, settings.geminiApiKey);

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
