// Offscreen document — runs Transformers.js pipeline.
// This page is an extension context, so it has no host-page CSP restrictions.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;
let loadingPromise: Promise<any> | null = null;

async function getExtractor() {
  if (extractor) return extractor;
  if (!loadingPromise) {
    loadingPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      extractor = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        { device: "wasm", dtype: "q8" }
      );
      console.log("[BranchBarber] Embedding model ready");
      return extractor;
    })();
  }
  return loadingPromise;
}

// Kick off model loading immediately — don't wait for the first EMBED request
getExtractor().catch((e) => console.warn("[BranchBarber] Model preload failed:", e));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "EMBED") return false;

  const { id, text } = message as { type: string; id: string; text: string };

  getExtractor()
    .then((model: any) => model(text, { pooling: "mean", normalize: true }))
    .then((output: any) => {
      sendResponse({ id, embedding: Array.from(output.data as Float32Array) });
    })
    .catch((err: unknown) => {
      console.error("[BranchBarber] Embedding failed:", err);
      sendResponse({ id, embedding: [], error: String(err) });
    });

  return true;
});
