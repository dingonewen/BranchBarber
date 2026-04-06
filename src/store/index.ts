import { create } from "zustand";
import type { ConversationNode, ConversationMeta } from "../db";

// "pending" = auto-detected drift, user hasn't confirmed yet (orange)
// "side-quest" = user confirmed branch (takes parent column color)
export type NodeStatus = "root" | "branch" | "side-quest" | "pending" | "normal" | "ghost";

export interface TreeNode {
  id: string;
  label: string;
  prompt: string;
  response: string;
  summary: string;
  parentId: string | null;
  children: string[];
  driftScore: number;
  status: NodeStatus;
  domIndex: number;
  depth: number;
  position: { x: number; y: number };
}

interface BranchBarberState {
  conversationId: string | null;
  conversationMeta: ConversationMeta | null;
  nodes: Record<string, TreeNode>;
  rootNodeId: string | null;
  currentNodeId: string | null;
  selectedNodeId: string | null;
  sidebarVisible: boolean;
  sidebarTab: "tree" | "settings";
  isProcessing: boolean;
  driftAlert: { nodeId: string; score: number } | null;
  geminiApiKey: string;
  driftThreshold: number;
  autoDetectBranches: boolean;
  summaryMode: "gemini" | "local";
  // Bumped by snap/unbranch to force ReactFlow to re-read positions from store
  layoutKey: number;
  undoStack: Array<Record<string, TreeNode>>;

  pushUndo: () => void;
  undo: () => Record<string, TreeNode> | null;
  clearConversation: () => void;
  setConversation: (id: string, meta: ConversationMeta) => void;
  addNode: (node: ConversationNode) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeSummary: (id: string, summary: string) => void;
  updateNodeEmbedding: (id: string, embedding: number[]) => void;
  setCurrentNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  markAsBranch: (id: string) => void;
  unmarkBranch: (id: string) => void;
  isolateNode: (id: string) => void;
  removeNode: (id: string) => void;
  reparentNode: (nodeId: string, newParentId: string | null) => void;
  shiftSubtree: (nodeId: string, dx: number, dy: number) => void;
  bumpLayoutKey: () => void;
  setSidebarVisible: (v: boolean) => void;
  setSidebarTab: (tab: "tree" | "settings") => void;
  setProcessing: (v: boolean) => void;
  setDriftAlert: (alert: { nodeId: string; score: number } | null) => void;
  setSettings: (s: Partial<{ geminiApiKey: string; driftThreshold: number; autoDetectBranches: boolean; summaryMode: "gemini" | "local" }>) => void;
  loadNodes: (nodes: ConversationNode[]) => void;
}

function dbNodeToTreeNode(node: ConversationNode): TreeNode {
  let status: NodeStatus = "normal";
  if (node.isGhost)          status = "ghost";
  else if (node.isRoot)      status = "root";
  else if (node.isBranch)    status = "side-quest";   // user confirmed → takes column color
  else if (node.isSideQuest) status = "pending";      // auto-detected, not yet confirmed (orange)
  return {
    id: node.id, label: node.label,
    prompt: node.prompt, response: node.response, summary: node.summary,
    parentId: node.parentId, children: [],
    driftScore: node.driftScore, status,
    domIndex: node.domIndex, depth: node.depth, position: node.position,
  };
}

function buildChildren(nodes: Record<string, TreeNode>): Record<string, TreeNode> {
  const result = { ...nodes };
  for (const id in result) result[id] = { ...result[id], children: [] };
  for (const id in result) {
    const { parentId } = result[id];
    if (parentId && result[parentId]) result[parentId].children.push(id);
  }
  return result;
}

// Exported so components can collect subtree IDs without importing store internals
export function getSubtreeIds(nodes: Record<string, TreeNode>, rootId: string): string[] {
  const result: string[] = [];
  const q = [rootId];
  while (q.length) {
    const cur = q.shift()!;
    result.push(cur);
    for (const c of (nodes[cur]?.children ?? [])) q.push(c);
  }
  return result;
}

export const useBranchStore = create<BranchBarberState>((set, get) => ({
  conversationId: null, conversationMeta: null,
  nodes: {}, rootNodeId: null, currentNodeId: null,
  selectedNodeId: null, sidebarVisible: true, sidebarTab: "tree",
  isProcessing: false, driftAlert: null,
  geminiApiKey: "", driftThreshold: 0.6, autoDetectBranches: true, summaryMode: "local" as const,
  layoutKey: 0,
  undoStack: [],

  pushUndo: () => set((state) => ({
    undoStack: [...state.undoStack.slice(-19), { ...state.nodes }],
  })),

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return null;
    const snapshot = state.undoStack[state.undoStack.length - 1];
    const prev = state.nodes;
    set({
      nodes: buildChildren({ ...snapshot }),
      undoStack: state.undoStack.slice(0, -1),
    });
    return prev;
  },

  clearConversation: () =>
    set({ nodes: {}, rootNodeId: null, currentNodeId: null, selectedNodeId: null, driftAlert: null }),

  setConversation: (id, meta) => set({ conversationId: id, conversationMeta: meta }),

  addNode: (dbNode) => {
    set((state) => {
      const treeNode = dbNodeToTreeNode(dbNode);
      const updated = { ...state.nodes, [treeNode.id]: treeNode };
      const withChildren = buildChildren(updated);
      const rootNodeId = dbNode.isRoot ? dbNode.id : state.rootNodeId;
      const currentNodeId = dbNode.isGhost ? state.currentNodeId : dbNode.id;
      return { nodes: withChildren, rootNodeId, currentNodeId };
    });
  },

  updateNodeLabel: (id, label) =>
    set((state) => ({ nodes: { ...state.nodes, [id]: { ...state.nodes[id], label } } })),

  updateNodeSummary: (id, summary) =>
    set((state) => ({ nodes: { ...state.nodes, [id]: { ...state.nodes[id], summary } } })),

  updateNodeEmbedding: (_id, _embedding) => { /* embeddings in DB only */ },

  setCurrentNode: (id) => set({ currentNodeId: id }),
  selectNode: (id) => set({ selectedNodeId: id }),

  // User confirms a branch/side-quest → "side-quest" = uses column color
  markAsBranch: (id) =>
    set((state) => ({ nodes: { ...state.nodes, [id]: { ...state.nodes[id], status: "side-quest" } } })),

  unmarkBranch: (id) =>
    set((state) => ({ nodes: { ...state.nodes, [id]: { ...state.nodes[id], status: "normal" } } })),

  // Remove node from parent-child chain: reparent its children to its grandparent,
  // then sever the node's own parentId (it floats alone).
  isolateNode: (id) =>
    set((state) => {
      const node = state.nodes[id];
      if (!node) return {};
      const grandparentId = node.parentId;
      const updated = { ...state.nodes };
      // Reparent all direct children to grandparent
      for (const childId of node.children) {
        if (updated[childId]) {
          updated[childId] = { ...updated[childId], parentId: grandparentId };
        }
      }
      // Sever the node itself
      updated[id] = { ...node, parentId: null, status: "normal" };
      return { nodes: buildChildren(updated) };
    }),

  removeNode: (id) =>
    set((state) => {
      const { [id]: _removed, ...rest } = state.nodes;
      return { nodes: buildChildren(rest) };
    }),

  reparentNode: (nodeId, newParentId) =>
    set((state) => {
      if (!state.nodes[nodeId]) return {};
      const nodes = {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], parentId: newParentId },
      };
      return { nodes: buildChildren(nodes) };
    }),

  shiftSubtree: (nodeId, dx, dy) =>
    set((state) => {
      const toShift = getSubtreeIds(state.nodes, nodeId);
      const nodes = { ...state.nodes };
      for (const id of toShift) {
        if (nodes[id]) {
          nodes[id] = {
            ...nodes[id],
            position: { x: nodes[id].position.x + dx, y: nodes[id].position.y + dy },
          };
        }
      }
      return { nodes };
    }),

  bumpLayoutKey: () => set((state) => ({ layoutKey: state.layoutKey + 1 })),

  setSidebarVisible: (v) => set({ sidebarVisible: v }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setProcessing: (v) => set({ isProcessing: v }),
  setDriftAlert: (alert) => set({ driftAlert: alert }),

  setSettings: (s) =>
    set((state) => ({
      geminiApiKey: s.geminiApiKey ?? state.geminiApiKey,
      driftThreshold: s.driftThreshold ?? state.driftThreshold,
      autoDetectBranches: s.autoDetectBranches ?? state.autoDetectBranches,
      summaryMode: s.summaryMode ?? state.summaryMode,
    })),

  loadNodes: (dbNodes) => {
    set((state) => {
      const nodeMap: Record<string, TreeNode> = {};
      let rootNodeId = state.rootNodeId;
      let currentNodeId = state.currentNodeId;
      for (const n of dbNodes) {
        nodeMap[n.id] = dbNodeToTreeNode(n);
        if (n.isRoot) rootNodeId = n.id;
        if (!n.isGhost) currentNodeId = n.id;
      }
      return { nodes: buildChildren(nodeMap), rootNodeId, currentNodeId };
    });
  },
}));
