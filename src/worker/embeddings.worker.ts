/// <reference lib="webworker" />

// Dynamically import to avoid TS union complexity at compile time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    self.postMessage({ type: "status", payload: "loading_model" });
    // Dynamic import avoids TypeScript's complex union resolution
    const { pipeline } = await import("@huggingface/transformers");
    extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      { device: "wasm" }
    );
    self.postMessage({ type: "status", payload: "model_ready" });
  }
  return extractor;
}

self.addEventListener("message", async (event: MessageEvent) => {
  const { type, id, text } = event.data as {
    type: string;
    id: string;
    text: string;
  };

  if (type !== "embed") return;

  try {
    const model = await getExtractor();
    const output = await model(text, { pooling: "mean", normalize: true });
    const embedding = Array.from(output.data as Float32Array);
    self.postMessage({ type: "embedding", id, embedding });
  } catch (error) {
    self.postMessage({
      type: "error",
      id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});