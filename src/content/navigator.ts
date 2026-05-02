import type { Platform } from "./selectors";
import { getUserTurns, getAITurns, getConversationUrl } from "./selectors";
import { db, saveSettings } from "../db";
import { useBranchStore } from "../store";

let _platform: Platform = "unknown";

export function initNavigator(platform: Platform): void {
  _platform = platform;

  // CustomEvent-based scroll: fired by NodeDetail "View" button
  window.addEventListener("bb-scroll-to", (e) => {
    const { domIndex } = (e as CustomEvent<{ domIndex: number }>).detail;
    if (typeof domIndex === "number") scrollToTurn(domIndex);
  });

  window.addEventListener("message", (event) => {
    if (event.source !== (window as unknown as MessageEventSource)) return;
    const { type, domIndex } = event.data ?? {};

    if (type === "BRANCHBARBER_RESET_TO" && typeof domIndex === "number") {
      resetToTurn(domIndex);
    }
    if (type === "SHOW_SIDEBAR" || type === "BRANCHBARBER_SHOW_SIDEBAR") {
      showSidebar();
    }
  });

  try { chrome.runtime?.id; } catch { return; } // context already gone
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_STATUS") {
      const dark = useBranchStore.getState().darkMode;
      sendResponse({ status: "active", darkMode: dark });
      return false;
    }
    if (message.type === "SET_DARK_MODE") {
      const dark = !!message.dark;
      useBranchStore.getState().setDarkMode(dark);
      saveSettings({ darkMode: dark });
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === "SHOW_SIDEBAR") {
      showSidebar();
      return false;
    }
    if (message.type === "RESET_TREE") {
      // Reset DB + store, re-init observer, then show sidebar — all in one shot
      resetTree().then(() => {
        showSidebar();
        sendResponse({ ok: true });
      });
      return true; // async
    }
  });
}

async function resetTree(): Promise<void> {
  const url = getConversationUrl();
  // Delete all nodes for this conversation from IndexedDB
  const existing = await db.conversations.where("url").equals(url).first();
  if (existing) {
    await db.nodes.where("conversationId").equals(existing.id).delete();
    await db.conversations.delete(existing.id);
  }
  // Clear the in-memory store
  useBranchStore.getState().clearConversation();
  // Re-init observer by dispatching a custom event content/index.ts listens for
  window.dispatchEvent(new CustomEvent("bb-reset"));
}

function showSidebar(): void {
  // Dispatch custom event — Sidebar component listens and opens the drawer
  window.dispatchEvent(new CustomEvent("bb-show"));
}

function scrollToTurn(domIndex: number): void {
  // Gemini lazy-loads older messages — user turn may not be in DOM yet; fall back to AI element
  const userEl = getUserTurns(_platform)[domIndex] as HTMLElement | undefined;
  const aiEl   = getAITurns(_platform)[domIndex]   as HTMLElement | undefined;
  const target = userEl ?? aiEl;
  if (!target) return;
  target.scrollIntoView({ behavior: "instant", block: "center" });
  const prev = target.style.outline;
  target.style.outline = "2px solid rgba(198,160,246,0.8)";
  target.style.borderRadius = "8px";
  setTimeout(() => { target.style.outline = prev; }, 2000);
}

function resetToTurn(domIndex: number): void {
  const target = getUserTurns(_platform)[domIndex];
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });

  const editSelectors =
    _platform === "chatgpt"
      ? '[aria-label="Edit message"]'
      : '[aria-label="Edit"]';

  const editBtn = (
    target.closest("[data-testid^='conversation-turn-']") ?? target
  ).querySelector(editSelectors) as HTMLButtonElement | null;

  editBtn?.click();
}
