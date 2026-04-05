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
      showSidebar();
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_STATUS") {
      sendResponse({ status: "active" });
      return false;
    }
    if (message.type === "SHOW_SIDEBAR") {
      showSidebar();
      return false;
    }
  });
}

function showSidebar(): void {
  // Dispatch custom event — Sidebar component listens and opens the drawer
  window.dispatchEvent(new CustomEvent("bb-show"));
}

function scrollToTurn(domIndex: number): void {
  const target = getUserTurns(_platform)[domIndex] as HTMLElement | undefined;
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
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
