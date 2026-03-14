import { create } from "zustand";
import type { ConversationNode, ConversationMeta } from "../db";

export type NodeStatus = "root" | "branch" | "side-quest" | "normal";

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
  // Conversation
  conversationId: string | null;
  conversationMeta: ConversationMeta | null;

  // Tree data
  nodes: Record<string, TreeNode>;
  rootNodeId: string | null;
  currentNodeId: string | null;

  // UI
  selectedNodeId: string | null;
  sidebarVisible: boolean;
  sidebarTab: "tree" | "settings";
  isProcessing: boolean;
  driftAlert: { nodeId: string; score: number } | null;

  // Settings
  geminiApiKey: string;
  driftThreshold: number;
  autoDetectBranches: boolean;

  // Actions
  setConversation: (id: string, meta: ConversationMeta) => void;
  addNode: (node: ConversationNode) => void;
  updateNodeSummary: (id: string, summary: string) => void;
  updateNodeEmbedding: (id: string, embedding: number[]) => void;
  setCurrentNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  markAsBranch: (id: string) => void;
  setSidebarVisible: (v: boolean) => void;
  setSidebarTab: (tab: "tree" | "settings") => void;
  setProcessing: (v: boolean) => void;
  setDriftAlert: (alert: { nodeId: string; score: number } | null) => void;
  setSettings: (s: Partial<{ geminiApiKey: string; driftThreshold: number; autoDetectBranches: boolean }>) => void;
  loadNodes: (nodes: ConversationNode[]) => void;
}

function dbNodeToTreeNode(node: ConversationNode): TreeNode {
  let status: NodeStatus = "normal";
  if (node.isRoot) status = "root";
  else if (node.isBranch) status = "branch";
  else if (node.isSideQuest) status = "side-quest";
  return {
    id: node.id,
    label: node.label,
    prompt: node.prompt,
    response: node.response,
    summary: node.summary,
    parentId: node.parentId,
    children: [],
    driftScore: node.driftScore,
    status,
    domIndex: node.domIndex,
    depth: node.depth,
    position: node.position,
  };
}

function buildChildren(nodes: Record<string, TreeNode>): Record<string, TreeNode> {
  const result = { ...nodes };
  for (const id in result) {
    result[id] = { ...result[id], children: [] };
  }
  for (const id in result) {
    const { parentId } = result[id];
    if (parentId && result[parentId]) {
      result[parentId].children.push(id);
    }
  }
  return result;
}

export const useBranchStore = create<BranchBarberState>((set) => ({
  conversationId: null,
  conversationMeta: null,
  nodes: {},
  rootNodeId: null,
  currentNodeId: null,
  selectedNodeId: null,
  sidebarVisible: true,
  sidebarTab: "tree",
  isProcessing: false,
  driftAlert: null,
  geminiApiKey: "",
  driftThreshold: 0.6,
  autoDetectBranches: true,

  setConversation: (id, meta) =>
    set({ conversationId: id, conversationMeta: meta }),

  addNode: (dbNode) => {
    set((state) => {
      const treeNode = dbNodeToTreeNode(dbNode);
      const updated = { ...state.nodes, [treeNode.id]: treeNode };
      const withChildren = buildChildren(updated);
      const rootNodeId = dbNode.isRoot ? dbNode.id : state.rootNodeId;
      return {
        nodes: withChildren,
        rootNodeId,
        currentNodeId: dbNode.id,
      };
    });
  },

  updateNodeSummary: (id, summary) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [id]: { ...state.nodes[id], summary },
      },
    })),

  updateNodeEmbedding: (_id, _embedding) => {
    // embeddings stored in DB only, not in memory store
  },

  setCurrentNode: (id) => set({ currentNodeId: id }),

  selectNode: (id) => set({ selectedNodeId: id }),

  markAsBranch: (id) =>
    set((state) => ({
      nodes: {
        ...state.nodes,
        [id]: { ...state.nodes[id], status: "branch" },
      },
    })),

  setSidebarVisible: (v) => set({ sidebarVisible: v }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setProcessing: (v) => set({ isProcessing: v }),
  setDriftAlert: (alert) => set({ driftAlert: alert }),

  setSettings: (s) =>
    set((state) => ({
      geminiApiKey: s.geminiApiKey ?? state.geminiApiKey,
      driftThreshold: s.driftThreshold ?? state.driftThreshold,
      autoDetectBranches: s.autoDetectBranches ?? state.autoDetectBranches,
    })),

  loadNodes: (dbNodes) => {
    set((state) => {
      const nodeMap: Record<string, TreeNode> = {};
      let rootNodeId = state.rootNodeId;
      let currentNodeId = state.currentNodeId;
      for (const n of dbNodes) {
        nodeMap[n.id] = dbNodeToTreeNode(n);
        if (n.isRoot) rootNodeId = n.id;
        currentNodeId = n.id; // last one is current
      }
      const withChildren = buildChildren(nodeMap);
      return { nodes: withChildren, rootNodeId, currentNodeId };
    });
  },
}));