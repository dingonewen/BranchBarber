const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Two serial queues: ghost labels (high priority) run first, node labels (low priority) run after
let ghostQueue: Promise<void> = Promise.resolve();
let nodeQueue:  Promise<void> = Promise.resolve();
let lastCallTime = 0;
const MIN_GAP_MS = 1000; // 1s gap = ~60 RPM, safe for paid; free tier may 429 but will retry

function enqueue(queue: "ghost" | "node", fn: () => Promise<string>): Promise<string> {
  const run = async (): Promise<string> => {
    const now = Date.now();
    const wait = MIN_GAP_MS - (now - lastCallTime);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallTime = Date.now();
    return fn();
  };

  if (queue === "ghost") {
    const result = ghostQueue.then(run);
    ghostQueue = result.then(() => {}, () => {});
    return result;
  } else {
    // Node labels wait for ghost queue to drain first
    const result = Promise.all([ghostQueue, nodeQueue]).then(run);
    nodeQueue = result.then(() => {}, () => {});
    return result;
  }
}

async function callGeminiRaw(prompt: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 40 },
      }),
      signal: controller.signal,
    });
    if (res.status === 429) throw Object.assign(new Error("429"), { is429: true });
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = await res.json();
    return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  } finally {
    clearTimeout(timeout);
  }
}

// Retry up to 3 times with exponential backoff on 429
async function callGeminiWithRetry(prompt: string, apiKey: string): Promise<string> {
  let delay = 5000;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await callGeminiRaw(prompt, apiKey);
    } catch (e: unknown) {
      if ((e as { is429?: boolean }).is429 && attempt < 2) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        lastCallTime = 0; // reset gap so next attempt fires immediately after wait
      } else {
        throw e;
      }
    }
  }
  return "";
}

// Called once per new conversation turn — low priority (node label)
export async function summarizeWithGemini(
  prompt: string,
  response: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) return prompt.slice(0, 60) + (prompt.length > 60 ? "..." : "");
  try {
    const text = await enqueue("node", () =>
      callGeminiWithRetry(
        `Summarize this conversation exchange in 8 words or fewer. Return only the summary, no punctuation or quotes.\n\nUser: ${prompt.slice(0, 500)}\n\nAI: ${response.slice(0, 500)}`,
        apiKey
      )
    );
    return text || prompt.slice(0, 60);
  } catch {
    return prompt.slice(0, 60) + (prompt.length > 60 ? "..." : "");
  }
}

// Called once per branch — high priority (ghost label), runs before node labels
export async function inferGhostTopic(
  mainBranchContext: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) return "Continue main thread here";
  try {
    const text = await enqueue("ghost", () =>
      callGeminiWithRetry(
        `Summarize the main topic of this conversation thread in 8 words or fewer. This will label a placeholder node representing the original thread. Return only the summary, no punctuation or quotes.\n\n${mainBranchContext.slice(0, 800)}`,
        apiKey
      )
    );
    return text || "Continue main thread here";
  } catch {
    return "Continue main thread here";
  }
}
