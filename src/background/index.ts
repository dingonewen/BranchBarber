// Background Service Worker (Manifest V3)

const OFFSCREEN_URL = chrome.runtime.getURL("offscreen.html");

async function ensureOffscreenDocument(): Promise<void> {
  try {
    const existing = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [OFFSCREEN_URL],
    });
    if (existing.length > 0) return;
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: "Run Transformers.js embeddings outside host page CSP",
    });
  } catch (e) {
    // Already creating, or document already exists — safe to ignore
    console.warn("[BranchBarber] ensureOffscreenDocument:", e);
  }
}

function ensureAlarm(): void {
  chrome.alarms.get("keepAlive", (alarm) => {
    if (!alarm) {
      chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
    }
  });
}

// On install AND on every SW startup (browser restart, SW kill/revive)
chrome.runtime.onInstalled.addListener(() => {
  console.log("[BranchBarber] Extension installed");
  ensureAlarm();
  ensureOffscreenDocument();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  ensureOffscreenDocument();
});

// Keepalive tick — also re-ensures offscreen doc is alive
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    ensureOffscreenDocument();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_STATUS") {
    sendResponse({ status: "active" });
    return false;
  }

  if (message.type === "EMBED") {
    ensureOffscreenDocument()
      .then(() =>
        chrome.runtime.sendMessage({
          type: "EMBED",
          id: message.id,
          text: message.text,
        })
      )
      .then((response) => sendResponse(response))
      .catch((err) => sendResponse({ embedding: [], error: String(err) }));
    return true; // async
  }

  // Claude API calls must go through the background worker — api.anthropic.com
  // does not set CORS headers, so direct fetch from content scripts is blocked.
  if (message.type === "CLAUDE_API") {
    const key: string = (message.apiKey ?? "").trim();
    console.log("[BranchBarber] CLAUDE_API — key prefix:", key.slice(0, 10) + "...", "length:", key.length);
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 40,
        messages: [{ role: "user", content: message.prompt }],
      }),
    })
      .then(async (res) => {
        if (res.status === 429) { sendResponse({ is429: true }); return; }
        if (!res.ok) { sendResponse({ error: `Claude API error: ${res.status}` }); return; }
        const data = await res.json();
        sendResponse({ text: (data?.content?.[0]?.text ?? "").trim() });
      })
      .catch((err) => sendResponse({ error: String(err) }));
    return true; // async
  }

  return false;
});
