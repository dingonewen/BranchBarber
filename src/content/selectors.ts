/**
 * Resilient selectors for ChatGPT and Gemini.
 * Multiple fallback strategies per platform.
 */

export type Platform = "chatgpt" | "gemini" | "unknown";

export function detectPlatform(): Platform {
  const host = window.location.hostname;
  if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) {
    return "chatgpt";
  }
  if (host.includes("gemini.google.com")) {
    return "gemini";
  }
  return "unknown";
}

/** Returns the container that holds all conversation turns. */
export function getConversationContainer(
  platform: Platform
): Element | null {
  if (platform === "chatgpt") {
    return (
      document.querySelector('[data-testid="conversation-turn-list"]') ??
      document.querySelector("main .flex.flex-col.items-center > div") ??
      document.querySelector("#__next main") ??
      null
    );
  }
  if (platform === "gemini") {
    return (
      document.querySelector("chat-window") ??
      document.querySelector(".conversation-container") ??
      document.querySelector("infinite-scroller") ??
      null
    );
  }
  return null;
}

/** Returns all user message elements. */
export function getUserTurns(platform: Platform): Element[] {
  if (platform === "chatgpt") {
    const candidates = [
      ...document.querySelectorAll('[data-message-author-role="user"]'),
      ...document.querySelectorAll('[data-testid^="conversation-turn-"] .whitespace-pre-wrap'),
    ];
    return candidates.length > 0
      ? Array.from(document.querySelectorAll('[data-message-author-role="user"]'))
      : [];
  }
  if (platform === "gemini") {
    return Array.from(
      document.querySelectorAll(
        'user-query, .user-query-container, [data-query-index]'
      )
    );
  }
  return [];
}

/** Returns all AI response elements. */
export function getAITurns(platform: Platform): Element[] {
  if (platform === "chatgpt") {
    return Array.from(
      document.querySelectorAll('[data-message-author-role="assistant"]')
    );
  }
  if (platform === "gemini") {
    return Array.from(
      document.querySelectorAll(
        'model-response, .model-response-text, .response-container'
      )
    );
  }
  return [];
}

/** Extracts text content from a turn element. */
export function extractText(element: Element): string {
  // Strip code blocks, markdown artifacts
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Returns the conversation URL (stable identifier). */
export function getConversationUrl(): string {
  return window.location.href.split("?")[0];
}

/** Returns the conversation title (best-effort). */
export function getConversationTitle(): string {
  return (
    document.title ||
    document.querySelector("h1")?.textContent?.trim() ||
    "Untitled Conversation"
  );
}

/** Returns the input textarea element. */
export function getInputElement(platform: Platform): HTMLElement | null {
  if (platform === "chatgpt") {
    return (
      (document.querySelector("#prompt-textarea") as HTMLElement) ??
      (document.querySelector('[data-id="root"] textarea') as HTMLElement) ??
      null
    );
  }
  if (platform === "gemini") {
    return (
      (document.querySelector(".ql-editor") as HTMLElement) ??
      (document.querySelector('rich-textarea [contenteditable]') as HTMLElement) ??
      null
    );
  }
  return null;
}