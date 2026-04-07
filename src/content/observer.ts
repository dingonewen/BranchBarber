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
function resetLayout(): void {
  mainBranchCurrentId = null;
}

function rebuildLayoutFromNodes(nodes: ConversationNode[]): void {
  resetLayout();
  // Every real node (including branches) is the parent of the next node in sequence.
  // Ghosts (domIndex=-1) are decorative — skip them.
  const sorted = [...nodes]
    .filter((n) => !n.isGhost)
    .sort((a, b) => a.domIndex - b.domIndex);
  for (const n of sorted) {
    mainBranchCurrentId = n.id;
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
    const timeoutId = setTimeout(() => resolve([]), 5000);
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

function clearAllButtons(): void {
  // Remove all injected bar siblings
  document.querySelectorAll("[data-branchbarber-bar]").forEach((bar) => bar.remove());
  // Clear injection markers so buttons can be re-injected for the new tree
  document.querySelectorAll("[data-branchbarber-injected]").forEach((el) => {
    delete (el as HTMLElement).dataset.branchbarberInjected;
  });
}

async function initConversation(): Promise<void> {
  const url = getConversationUrl();
  clearAllButtons();
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
    // Inject buttons after DOM is ready, then keep checking in case Angular re-renders wipe them
    setTimeout(reinjectButtons, 500);
    setTimeout(reinjectButtons, 2000);
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

let isScanning = false;
const handleMutations = (): void => { scanAndProcessTurns(); };

async function scanAndProcessTurns(): Promise<void> {
  if (!isContextValid()) return;
  if (isScanning) return;
  isScanning = true;
  try {
    await _doScan();
  } finally {
    isScanning = false;
  }
}

async function _doScan(): Promise<void> {
  const settings = await getOrCreateSettings();

  // Re-query DOM fresh at the start of each scan
  let userTurns = getUserTurns(platform);
  let aiTurns   = getAITurns(platform);
  let pairCount = Math.min(userTurns.length, aiTurns.length);
  if (pairCount <= processedCount) return;

  const SHIFT_KEYWORDS = [
    '另外','换个话题','换个问题','对了','顺便问','顺便说',
    'by the way','btw','anyway','separate question','separate issue',
    'different topic','change of topic','unrelated',
  ];

  for (let i = processedCount; i < pairCount; i++) {
    // Re-query DOM each iteration — Angular may re-render between awaits
    userTurns = getUserTurns(platform);
    aiTurns   = getAITurns(platform);
    pairCount = Math.min(userTurns.length, aiTurns.length);
    if (i >= pairCount) break;

    const prompt   = extractText(userTurns[i]);
    const response = extractText(aiTurns[i]);
    if (!prompt || !response) {
      // AI still streaming — stop here, mutation observer will trigger again when done
      break;
    }

    const nodeId  = generateId();
    const isRoot  = i === 0 && useBranchStore.getState().rootNodeId === null;
    const keywordShift = SHIFT_KEYWORDS.some((k) => prompt.toLowerCase().includes(k));

    const textForEmbedding = `${prompt} ${response}`.slice(0, 512);
    const parentNodeId = !isRoot ? mainBranchCurrentId : null;

    // Lexical drift — instant, no await needed
    let driftScore = 0;
    if (!isRoot && parentNodeId) {
      const parentDbNode = await db.nodes.get(parentNodeId);
      if (parentDbNode) {
        const parentText = `${parentDbNode.prompt} ${parentDbNode.response}`;
        if (parentText) driftScore = lexicalDrift(textForEmbedding, parentText.slice(0, 512));
      }
    }

    // Fire embedding in background — updates DB when it arrives, doesn't block node creation
    requestEmbedding(textForEmbedding, nodeId).then((emb) => {
      if (emb.length === 0) return;
      db.nodes.update(nodeId, { embedding: emb });
      if (!isRoot && parentNodeId) {
        db.nodes.get(parentNodeId).then((p) => {
          if (!p?.embedding?.length) return;
          const newDrift = 1 - cosineSimilarity(emb, p.embedding!);
          db.nodes.update(nodeId, { driftScore: newDrift });
        });
      }
    });

    const isSideQuest = settings.autoDetectBranches && (keywordShift || driftScore > settings.driftThreshold);

    let parentId: string | null;
    let position: { x: number; y: number };
    let depth: number;

    if (isRoot) {
      parentId            = null;
      position            = { x: 0, y: 0 };
      depth               = 0;
      mainBranchCurrentId = nodeId;

    } else if (isSideQuest) {
      // Drift detected: new node goes RIGHT, ghost placeholder goes LEFT (both children of parent)
      const branchFromId = mainBranchCurrentId;
      const bp           = parentPos(branchFromId);

      // Ghost = left child (marks where main thread would have continued)
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
        position: { x: bp.x, y: bp.y + NODE_H },
      };
      await upsertNode(ghostNode);
      useBranchStore.getState().addNode(ghostNode);

      if ((settings.summaryMode ?? "local") === "gemini" && settings.geminiApiKey && branchFromId) {
        db.nodes.get(branchFromId).then((n) => {
          if (!n) return;
          inferGhostTopic(`${n.prompt}\n\n${n.response}`.slice(0, 600), settings.geminiApiKey).then((label) => {
            db.nodes.update(ghostId, { label, summary: label });
            useBranchStore.getState().updateNodeLabel(ghostId, label);
          });
        });
      }

      // New node = right child; it becomes the new main-thread tip (tree keeps going right)
      parentId            = branchFromId;
      position            = { x: bp.x + NODE_W, y: bp.y + NODE_H };
      depth               = Math.round(bp.y / NODE_H) + 1;
      mainBranchCurrentId = nodeId;

    } else {
      // No drift: straight down
      const mp            = parentPos(mainBranchCurrentId);
      parentId            = mainBranchCurrentId;
      position            = { x: mp.x, y: mp.y + NODE_H };
      depth               = Math.round(mp.y / NODE_H) + 1;
      mainBranchCurrentId = nodeId;
    }

    const fallbackLabel = prompt.slice(0, 60) + (prompt.length > 60 ? "..." : "");
    const useGemini     = (settings.summaryMode ?? "local") === "gemini" && !!settings.geminiApiKey;

    const node: ConversationNode = {
      id: nodeId, conversationId,
      parentId: isRoot ? null : parentId,
      prompt, response, summary: fallbackLabel, embedding: [],
      driftScore, isBranch: isSideQuest, isRoot, isSideQuest,
      domIndex: i, createdAt: Date.now(),
      label: fallbackLabel,
      depth, position,
    };

    await upsertNode(node);
    upsertConversation({
      id: conversationId, url: getConversationUrl(), title: getConversationTitle(),
      rootNodeId: isRoot ? nodeId : useBranchStore.getState().rootNodeId,
      currentNodeId: nodeId, createdAt: Date.now(), updatedAt: Date.now(),
    });

    useBranchStore.getState().addNode(node);

    if (useGemini) {
      summarizeWithGemini(prompt, response, settings.geminiApiKey).then((summary) => {
        if (summary && summary !== fallbackLabel) {
          db.nodes.update(nodeId, { label: summary, summary });
          useBranchStore.getState().updateNodeLabel(nodeId, summary);
        }
      });
    }

    injectBranchButton(aiTurns[i], nodeId);
    processedCount = i + 1;
  }

  setTimeout(reinjectButtons, 300);
}

function setButtonState(btn: HTMLButtonElement, branched: boolean): void {
  if (branched) {
    btn.textContent = "✓ Branched";
    btn.style.color = "#16a34a";
    btn.style.borderColor = "rgba(22,163,74,0.4)";
    btn.style.background = "rgba(22,163,74,0.08)";
  } else {
    btn.textContent = "✂ Branch Here";
    btn.style.color = "#7c3aed";
    btn.style.borderColor = "rgba(124,58,237,0.3)";
    btn.style.background = "rgba(124,58,237,0.08)";
  }
}

function injectBranchButton(aiElement: Element, nodeId: string, initiallyBranched = false): void {
  // Use a marker on the element itself — appending inside Angular components gets wiped on re-render
  if ((aiElement as HTMLElement).dataset.branchbarberInjected) return;
  (aiElement as HTMLElement).dataset.branchbarberInjected = "true";

  const btn = document.createElement("button");
  btn.dataset.branchbarberBtn = nodeId;
  btn.style.cssText = `
    display:inline-flex;align-items:center;gap:4px;
    padding:4px 10px;font-size:11px;font-weight:600;
    border:1px solid transparent;border-radius:6px;
    cursor:pointer;font-family:inherit;position:relative;z-index:9999;
  `;
  let branched = initiallyBranched;
  setButtonState(btn, branched);
  btn.addEventListener("click", () => {
    branched = !branched;
    if (branched) {
      useBranchStore.getState().markAsBranch(nodeId);
      db.nodes.update(nodeId, { isBranch: true });
    } else {
      useBranchStore.getState().unmarkBranch(nodeId);
      db.nodes.update(nodeId, { isBranch: false });
    }
    setButtonState(btn, branched);
  });
  const bar = document.createElement("div");
  bar.dataset.branchbarberBar = nodeId;
  bar.style.cssText = "display:block;width:100%;padding:4px 0;margin-top:2px;";
  bar.appendChild(btn);
  // Insert AFTER the AI element (as sibling) so Angular re-renders don't wipe it
  aiElement.insertAdjacentElement("afterend", bar);
}

// Called after loading an existing conversation — reinject buttons for all turns.
// Also called periodically to catch turns that were missed (e.g. Angular re-render wiped the marker).
function reinjectButtons(): void {
  const aiTurns = getAITurns(platform);
  const nodes = useBranchStore.getState().nodes;
  // Build domIndex → nodeId map
  const byDomIndex = new Map<number, string>();
  for (const n of Object.values(nodes)) {
    if (n.status !== "ghost" && n.domIndex >= 0) byDomIndex.set(n.domIndex, n.id);
  }
  aiTurns.forEach((el, i) => {
    const nodeId = byDomIndex.get(i);
    if (!nodeId) return;
    // If marker was wiped by Angular re-render, remove the stale sibling bar and re-inject
    if ((el as HTMLElement).dataset.branchbarberInjected) {
      const staleBar = el.nextElementSibling;
      if (staleBar && (staleBar as HTMLElement).dataset.branchbarberBar === nodeId) return; // still intact
      // marker set but bar is gone — reset and re-inject
      delete (el as HTMLElement).dataset.branchbarberInjected;
    }
    const node = nodes[nodeId];
    injectBranchButton(el, nodeId, node?.status === "side-quest");
  });
}

export function destroyObserver(): void {
  mutationObserver?.disconnect();
}
