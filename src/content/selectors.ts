export type Platform = "chatgpt" | "gemini" | "unknown";

export function detectPlatform(): Platform {
  const host = window.location.hostname;
  if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) return "chatgpt";
  if (host.includes("gemini.google.com")) return "gemini";
  return "unknown";
}

/** Returns the element to observe for new turns. */
export function getConversationContainer(platform: Platform): Element | null {
  if (platform === "chatgpt") {
    return (
      document.querySelector("main") ??
      document.querySelector("#__next main") ??
      null
    );
  }
  if (platform === "gemini") {
    return (
      document.querySelector("chat-window") ??
      document.querySelector("bard-sidenav-content") ??
      document.querySelector("main") ??
      document.body
    );
  }
  return null;
}

/** Returns all user message elements in order. */
export function getUserTurns(platform: Platform): Element[] {
  if (platform === "chatgpt") {
    return Array.from(
      document.querySelectorAll('[data-message-author-role="user"]')
    );
  }
  if (platform === "gemini") {
    // Gemini uses Angular web components — select by tag name
    // Current DOM: <user-query> contains the user's message
    const byTag = document.querySelectorAll("user-query");
    if (byTag.length > 0) return Array.from(byTag);
    // Fallback: message-content inside conversation-turn
    return Array.from(document.querySelectorAll(".conversation-turn .query-text, .user-query-bubble-with-footer"));
  }
  return [];
}

/** Returns all AI response elements in order. */
export function getAITurns(platform: Platform): Element[] {
  if (platform === "chatgpt") {
    return Array.from(
      document.querySelectorAll('[data-message-author-role="assistant"]')
    );
  }
  if (platform === "gemini") {
    const byTag = document.querySelectorAll("model-response");
    if (byTag.length > 0) return Array.from(byTag);
    return Array.from(document.querySelectorAll(".model-response-text, .response-container"));
  }
  return [];
}

export function extractText(element: Element): string {
  // For Angular web components, try to pierce shadow root first
  const shadow = (element as Element & { shadowRoot?: ShadowRoot }).shadowRoot;
  const source = shadow ?? element;
  return (source.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 2000);
}

export function getConversationUrl(): string {
  return window.location.href.split("?")[0];
}

export function getConversationTitle(): string {
  return (
    document.title ||
    document.querySelector("h1")?.textContent?.trim() ||
    "Untitled Conversation"
  );
}

export function getInputElement(platform: Platform): HTMLElement | null {
  if (platform === "chatgpt") {
    return (document.querySelector("#prompt-textarea") as HTMLElement) ?? null;
  }
  if (platform === "gemini") {
    return (
      (document.querySelector(".ql-editor") as HTMLElement) ??
      (document.querySelector("rich-textarea [contenteditable]") as HTMLElement) ??
      null
    );
  }
  return null;
}
