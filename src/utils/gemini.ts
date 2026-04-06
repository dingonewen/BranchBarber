const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
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
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = await res.json();
    return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  } finally {
    clearTimeout(timeout);
  }
}

// Called once per new conversation turn — generates an 8-word node label.
export async function summarizeWithGemini(
  prompt: string,
  response: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) return prompt.slice(0, 60) + (prompt.length > 60 ? "..." : "");
  try {
    const text = await callGemini(
      `Summarize this conversation exchange in 8 words or fewer. Return only the summary, no punctuation or quotes.\n\nUser: ${prompt.slice(0, 500)}\n\nAI: ${response.slice(0, 500)}`,
      apiKey
    );
    return text || prompt.slice(0, 60);
  } catch {
    return prompt.slice(0, 60) + (prompt.length > 60 ? "..." : "");
  }
}

// Called once per branch — summarises what the main thread was about so the
// ghost placeholder node clearly labels the original thread topic.
export async function inferGhostTopic(
  mainBranchContext: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) return "Continue main thread here";
  try {
    const text = await callGemini(
      `Summarize the main topic of this conversation thread in 8 words or fewer. This will label a placeholder node representing the original thread. Return only the summary, no punctuation or quotes.\n\n${mainBranchContext.slice(0, 800)}`,
      apiKey
    );
    return text || "Continue main thread here";
  } catch {
    return "Continue main thread here";
  }
}
