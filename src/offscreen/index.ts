// Offscreen document — runs Transformers.js pipeline.
// This page is an extension context, so it has no host-page CSP restrictions,
// but the extension's own manifest CSP still applies (script-src 'self').
// We must prevent Transformers.js / ONNX Runtime from fetching any files from
// external CDNs (jsdelivr, etc.) — all assets must come from the bundled dist.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;
let loadingPromise: Promise<any> | null = null;

async function getExtractor() {
  if (extractor) return extractor;
  if (!loadingPromise) {
    loadingPromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");

      // ── Tell ONNX Runtime to load WASM files from the bundled extension dist ──
      // Without this it fetches from https://cdn.jsdelivr.net/… which is blocked
      // by the extension's script-src 'self' CSP.
      // Point ONNX Runtime at the extension root where we copied the WASM/MJS
      // files with their original names via CopyWebpackPlugin.
      // Without this it fetches from jsdelivr CDN — blocked by extension CSP.
      const baseUrl = chrome.runtime.getURL("");
      if (env.backends.onnx.wasm) {
        env.backends.onnx.wasm.wasmPaths = baseUrl;
      }

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
