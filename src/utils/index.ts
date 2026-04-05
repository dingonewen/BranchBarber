export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function truncate(text: string, maxLen = 80): string {
  return text.length <= maxLen ? text : text.slice(0, maxLen - 3) + "...";
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Lightweight TF-IDF cosine similarity — works without any ML model.
// Used as fallback when embeddings are unavailable.
const STOPWORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'is','are','was','were','be','been','being','have','has','had','do','does',
  'did','will','would','could','should','may','might','can','this','that',
  'these','those','i','you','he','she','it','we','they','my','your','his',
  'her','its','our','their','what','how','why','when','where','who',
]);

export function lexicalDrift(a: string, b: string): number {
  const tokenize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const tokA = tokenize(a);
  const tokB = tokenize(b);
  if (tokA.length === 0 || tokB.length === 0) return 0;

  const freq = (toks: string[]) => {
    const m = new Map<string, number>();
    for (const t of toks) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  };
  const fA = freq(tokA);
  const fB = freq(tokB);
  const allTerms = new Set([...fA.keys(), ...fB.keys()]);

  let dot = 0, normA = 0, normB = 0;
  for (const t of allTerms) {
    const va = fA.get(t) ?? 0;
    const vb = fB.get(t) ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  const similarity = denom === 0 ? 0 : dot / denom;
  return 1 - similarity; // 0 = identical, 1 = completely different
}
