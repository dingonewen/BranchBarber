import type { Platform } from "./selectors";
import { getUserTurns } from "./selectors";

let _platform: Platform = "unknown";

export function initNavigator(platform: Platform): void {
  _platform = platform;

  window.addEventListener("message", (event) => {
    if (event.source !== (window as unknown as MessageEventSource)) return;
    const { type, domIndex } = event.data ?? {};

    if (type === "BRANCHBARBER_SCROLL_TO" && typeof domIndex === "number") {
      scrollToTurn(domIndex);
    }

    if (type === "BRANCHBARBER_RESET_TO" && typeof domIndex === "number") {
      resetToTurn(domIndex);
    }

    if (type === "SHOW_SIDEBAR" || type === "BRANCHBARBER_SHOW_SIDEBAR") {
      const container = document.getElementById("branchbarber-sidebar-root");
      if (container) container.style.display = "";
    }
  });

  // Also handle Chrome extension messages
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SHOW_SIDEBAR") {
      const container = document.getElementById("branchbarber-sidebar-root");
      if (container) container.style.display = "";
    }
    if (message.type === "GET_STATUS") {
      return true;
    }
  });
}

function scrollToTurn(domIndex: number): void {
  const userTurns = getUserTurns(_platform);
  const target = userTurns[domIndex];
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    // Flash highlight
    const el = target as HTMLElement;
    const originalOutline = el.style.outline;
    el.style.outline = "2px solid rgba(124,58,237,0.8)";
    el.style.borderRadius = "8px";
    setTimeout(() => {
      el.style.outline = originalOutline;
    }, 2000);
  }
}

function resetToTurn(domIndex: number): void {
  // For ChatGPT: find the edit button at this turn and click it
  // This triggers the "edit message" flow which resets the conversation from that point
  if (_platform === "chatgpt") {
    const userTurns = getUserTurns(_platform);
    const target = userTurns[domIndex];
    if (target) {
      // Scroll to it first
      target.scrollIntoView({ behavior: "smooth", block: "center" });

      // Try to find edit button
      const editBtn = target.closest("[data-testid^='conversation-turn-']")
        ?.querySelector('[aria-label="Edit message"]') as HTMLButtonElement | null;
      if (editBtn) {
        editBtn.click();
      }
    }
  } else if (_platform === "gemini") {
    const userTurns = getUserTurns(_platform);
    const target = userTurns[domIndex];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      // Gemini has an edit pencil button
      const editBtn = target.querySelector('[aria-label="Edit"]') as HTMLButtonElement | null;
      if (editBtn) editBtn.click();
    }
  }
}