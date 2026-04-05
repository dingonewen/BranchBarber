import { debounce, generateId, cosineSimilarity } from "../utils";
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
let embeddingWorker: Worker | null = null;
let pendingEmbeddings = new Map<string, (embedding: number[]) => void>();

// Track processed turn count to avoid re-processing
let processedCount = 0;

export function initObserver(): void {
  platform = detectPlatform();
  if (platform === "unknown") return;

  setupEmbeddingWorker();
  initConversation();
  startMutationObserver();
}

function setupEmbeddingWorker(): void {
  try {
    const workerUrl = chrome.runtime.getURL("worker.js");
    embeddingWorker = new Worker(workerUrl);
    embeddingWorker.onmessage = (e: MessageEvent) => {
      const { type, id, embedding } = e.data;
      if (type === "embedding" && id && pendingEmbeddings.has(id)) {
        const resolve = pendingEmbeddings.get(id)!;
        pendingEmbeddings.delete(id);
        resolve(embedding);
      }
    };
  } catch {
    console.warn("[BranchBarber] Embedding worker unavailable");
  }
}

function requestEmbedding(text: string, id: string): Promise<number[]> {
  return new Promise((resolve) => {
    if (!embeddingWorker) {
      resolve([]);
      return;
    }
    const timeoutId = setTimeout(() => {
      pendingEmbeddings.delete(id);
      resolve([]);
    }, 15000);

    pendingEmbeddings.set(id, (embedding) => {
      clearTimeout(timeoutId);
      resolve(embedding);
    });
    embeddingWorker.postMessage({ type: "embed", id, text });
  });
}

async function initConversation(): Promise<void> {
  const url = getConversationUrl();
  const existing = await getConversationByUrl(url);
  const settings = await getOrCreateSettings();

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
    const parentId = store.currentNodeId;

    // Compute drift score against root embedding
    let driftScore = 0;
    let embedding: number[] = [];
    const textForEmbedding = `${prompt} ${response}`.slice(0, 512);
    embedding = await requestEmbedding(textForEmbedding, nodeId);

    if (!isRoot && embedding.length > 0) {
      const rootNode = store.rootNodeId
        ? await db.nodes.get(store.rootNodeId)
        : null;
      if (rootNode?.embedding && rootNode.embedding.length > 0) {
        driftScore = 1 - cosineSimilarity(embedding, rootNode.embedding);
      }
    }

    const isSideQuest =
      settings.autoDetectBranches &&
      driftScore > (1 - settings.driftThreshold);

    // Determine depth
    const parentNodeInStore = parentId ? store.nodes[parentId] : null;
    const depth = parentNodeInStore ? parentNodeInStore.depth + 1 : 0;

    // Auto-layout position
    const position = {
      x: depth * 220,
      y: i * 120,
    };

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
  embeddingWorker?.terminate();
}