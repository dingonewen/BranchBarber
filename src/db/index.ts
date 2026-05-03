import Dexie, { type Table } from "dexie";

export interface ConversationNode {
  id: string;
  conversationId: string;
  parentId: string | null;
  prompt: string;
  response: string;
  summary: string;
  embedding: number[] | null;
  driftScore: number;
  isBranch: boolean;
  isRoot: boolean;
  isSideQuest: boolean;
  isGhost?: boolean;
  domIndex: number;
  createdAt: number;
  label: string;
  depth: number;
  position: { x: number; y: number };
}

export interface ConversationMeta {
  id: string;
  url: string;
  title: string;
  rootNodeId: string | null;
  currentNodeId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  id: string;
  geminiApiKey: string;
  claudeApiKey: string;
  driftThreshold: number;
  autoDetectBranches: boolean;
  showSidebar: boolean;
  sidebarPosition: "left" | "right";
  summaryMode: "gemini" | "claude" | "local";
  darkMode: boolean;
}

class BranchBarberDB extends Dexie {
  nodes!: Table<ConversationNode>;
  conversations!: Table<ConversationMeta>;
  settings!: Table<AppSettings>;

  constructor() {
    super("BranchBarberDB");
    this.version(1).stores({
      nodes: "id, conversationId, parentId, createdAt, domIndex",
      conversations: "id, url, updatedAt",
      settings: "id",
    });
  }
}

export const db = new BranchBarberDB();

export async function getOrCreateSettings(): Promise<AppSettings> {
  const existing = await db.settings.get("default");
  if (existing) return existing;
  const defaults: AppSettings = {
    id: "default",
    geminiApiKey: "",
    claudeApiKey: "",
    driftThreshold: 0.80,
    autoDetectBranches: true,
    showSidebar: true,
    sidebarPosition: "right",
    summaryMode: "local",
    darkMode: false,
  };
  await db.settings.put(defaults);
  return defaults;
}

export async function saveSettings(
  updates: Partial<Omit<AppSettings, "id">>
): Promise<void> {
  await db.settings.update("default", updates);
}

export async function getConversationNodes(
  conversationId: string
): Promise<ConversationNode[]> {
  return db.nodes
    .where("conversationId")
    .equals(conversationId)
    .sortBy("domIndex");
}

export async function upsertNode(node: ConversationNode): Promise<void> {
  await db.nodes.put(node);
}

export async function upsertConversation(
  meta: ConversationMeta
): Promise<void> {
  await db.conversations.put(meta);
}

export async function getConversationByUrl(
  url: string
): Promise<ConversationMeta | undefined> {
  return db.conversations.where("url").equals(url).first();
}
