const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export async function summarizeWithGemini(
  prompt: string,
  response: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) {
    // Fallback: use first ~60 chars of prompt as label
    return prompt.slice(0, 60) + (prompt.length > 60 ? "..." : "");
  }

  const body = {
    contents: [
      {
        parts: [
          {
            text: `Summarize the following AI conversation exchange in 8 words or fewer. Return only the summary, no punctuation or quotes.\n\nUser: ${prompt.slice(0, 500)}\n\nAI: ${response.slice(0, 500)}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 30,
    },
  };

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return text.trim() || prompt.slice(0, 60);
  } catch {
    return prompt.slice(0, 60) + (prompt.length > 60 ? "..." : "");
  }
}