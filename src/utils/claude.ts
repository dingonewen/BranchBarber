// api.anthropic.com does not set CORS headers, so fetch from content scripts is
// blocked. All Claude API calls are proxied through the background service worker.

let queue: Promise<void> = Promise.resolve();
let lastCallTime = 0;
const MIN_GAP_MS = 1000; // 1 s gap — conservative; Claude API limits are much higher than Gemini free tier

function enqueue(fn: () => Promise<string>): Promise<string> {
  const run = async (): Promise<string> => {
    const now = Date.now();
    const wait = MIN_GAP_MS - (now - lastCallTime);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallTime = Date.now();
    return fn();
  };
  const result = queue.then(run);
  queue = result.then(() => {}, () => {});
  return result;
}

function callClaudeRaw(prompt: string, apiKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error("Claude API timeout")), 10000);
    try {
      chrome.runtime.sendMessage(
        { type: "CLAUDE_API", prompt, apiKey },
        (response: { text?: string; error?: string; is429?: boolean } | null) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
          if (!response) { reject(new Error("No response from background")); return; }
          if (response.is429) { reject(Object.assign(new Error("429"), { is429: true })); return; }
          if (response.error) { reject(new Error(response.error)); return; }
          resolve(response.text ?? "");
        }
      );
    } catch (e) {
      clearTimeout(timeoutId);
      reject(e);
    }
  });
}

async function callClaudeWithRetry(prompt: string, apiKey: string): Promise<string> {
  let delay = 10000;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await callClaudeRaw(prompt, apiKey);
    } catch (e: unknown) {
      if ((e as { is429?: boolean }).is429 && attempt < 2) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        lastCallTime = 0;
      } else {
        throw e;
      }
    }
  }
  return "";
}

export async function summarizeWithClaude(
  prompt: string,
  response: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) return prompt.slice(0, 60) + (prompt.length > 60 ? "..." : "");
  try {
    const text = await enqueue(() =>
      callClaudeWithRetry(
        `Summarize this conversation exchange in 8 words or fewer. Return only the summary, no punctuation or quotes.\n\nUser: ${prompt.slice(0, 500)}\n\nAI: ${response.slice(0, 500)}`,
        apiKey
      )
    );
    return text || prompt.slice(0, 60);
  } catch (e) {
    console.error("[BranchBarber] Claude summarization failed:", e);
    return prompt.slice(0, 60) + (prompt.length > 60 ? "..." : "");
  }
}

export async function inferGhostTopicClaude(
  mainBranchContext: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) return "Continue main thread here";
  try {
    const text = await enqueue(() =>
      callClaudeWithRetry(
        `Summarize the main topic of this conversation thread in 8 words or fewer. This will label a placeholder node representing the original thread. Return only the summary, no punctuation or quotes.\n\n${mainBranchContext.slice(0, 800)}`,
        apiKey
      )
    );
    return text || "Continue main thread here";
  } catch (e) {
    console.error("[BranchBarber] Claude ghost topic failed:", e);
    return "Continue main thread here";
  }
}
