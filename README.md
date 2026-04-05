# BranchBarber 🪒🌳

> **Stop shaving the yak. Start climbing the tree.**

`BranchBarber` is a high-performance Chrome Extension built to solve **"Intent Drift"** (the "Yak Shaving" problem) during complex GenAI learning and debugging sessions. It transforms linear chat logs into a dynamic, interactive **Conversation Tree**, allowing users to visualize, prune, and navigate their thought processes in real-time.

---

## 🚀 The Problem: Yak Shaving in GenAI

Technical learning isn't linear, but GenAI interfaces are. When users encounter bugs, they often spiral into "Side Quests":

1. **Root Goal:** "Build a Machine Learning model."
2. **Side Quest A:** "Fix Python environment path."
3. **Side Quest B:** "Debug shell permissions."
4. **Current State:** Researching Linux kernel flags while forgetting the original ML model.

`BranchBarber` maps these deviations as branches, providing a "teleportation" mechanism to jump back to the **Root Goal** without losing context.

---

## ✨ Key Features

- **Dynamic Tree Visualization:** Real-time mapping of linear conversations into hierarchical nodes using `React Flow`.
- **Semantic Drift Detection:** Uses **Local Embeddings** (`Transformers.js` / `all-MiniLM-L6-v2`) to calculate cosine similarity between the current prompt and the root objective, flagging "Side Quests" automatically.
- **Context Teleportation:** One-click navigation to historical nodes with automated DOM scrolling and context-aware resets via the host page's Edit function.
- **Local-First Privacy:** All chat data is stored locally in `IndexedDB` via `Dexie.js`. No data leaves your browser unless you opt-in for Gemini API summarization.
- **Hybrid Branching:** Choose between automated AI detection or manual "✂ Mark as Branch" triggers injected into every AI response.

---

## 🛠️ Technical Stack

### Extension & Frontend

| Layer | Technology | Reason |
|---|---|---|
| Language | TypeScript (Strict Mode) | Type safety across the full pipeline |
| Framework | React 18 | Component-driven sidebar UI |
| Extension API | Chrome Manifest V3 | Modern, security-compliant extension model |
| State Management | `Zustand` | Minimal boilerplate, synchronous tree updates |
| Visualization | `React Flow` | Interactive, pannable/zoomable node graph |
| Styling | `Tailwind CSS` | Utility-first, no style leakage via Shadow DOM |
| Bundler | `Webpack 5` | Fine-grained control over MV3 multi-entry chunking |

### Data & AI Logic

| Layer | Technology | Reason |
|---|---|---|
| Primary Storage | `Dexie.js` (IndexedDB) | Zero-latency local persistence, handles high-frequency writes |
| Edge AI | `Transformers.js` (`all-MiniLM-L6-v2`) | On-device NLP inference — no API calls, full privacy |
| Summarization | Gemini 2.0 Flash API | Optional cloud label generation; graceful local fallback |
| Cloud Sync | _(Future: Node.js + PostgreSQL)_ | Cross-device persistence |

---

## 🏗️ Architecture

```
src/
├── background/          # MV3 Service Worker — message routing, keepalive
├── content/
│   ├── index.ts             # Entry point
│   ├── observer.ts          # MutationObserver + node processing pipeline
│   ├── selectors.ts         # Resilient DOM selectors (ChatGPT & Gemini)
│   ├── navigator.ts         # Scroll-to / Reset-to logic
│   └── sidebar-injector.ts  # Shadow DOM React mount (style isolation)
├── worker/
│   └── embeddings.worker.ts # Transformers.js in Web Worker (zero UI-thread lag)
├── store/               # Zustand — tree state, drift alerts, settings
├── db/                  # Dexie.js — IndexedDB schema & queries
├── utils/
│   ├── index.ts             # cosineSimilarity, debounce, generateId
│   └── gemini.ts            # Gemini API summarization (optional)
└── components/
    ├── Sidebar.tsx           # Main sidebar shell
    ├── ConversationTree.tsx  # React Flow canvas
    ├── TreeNode.tsx          # Custom node (drift bar, status badge)
    ├── NodeDetail.tsx        # Selected node inspector
    ├── DriftAlert.tsx        # Side Quest warning banner
    └── SettingsPanel.tsx     # API key + threshold config
```

### Data Flow

```
DOM mutation (MutationObserver)
  → Extract prompt/response pairs
  → Embed text (Web Worker → Transformers.js)
  → Cosine similarity vs. root node embedding
  → Auto-flag Side Quest if drift > threshold
  → Summarize label (Gemini API or local fallback)
  → Persist to IndexedDB (Dexie.js)
  → Update Zustand store → React re-renders tree
```

---

## 🔧 Engineering Challenges (SDE/TPM Highlights)

- **Performance Optimization:** Offloaded all embedding inference to a dedicated `Web Worker`, keeping the host page UI thread completely unblocked. MutationObserver is debounced to batch DOM updates.
- **Architectural Trade-off:** Prioritized **Local-first** (`IndexedDB`) over cloud-only storage to deliver 100% privacy and full offline functionality out of the box.
- **Selector Resilience:** Built a multi-fallback DOM mapping engine across both ChatGPT and Gemini, with automatic SPA navigation re-attachment to survive client-side route changes.
- **Style Isolation:** The sidebar is injected into a **Shadow DOM** so Tailwind/React styles never conflict with the host page's CSS.

---

## ⚡ Getting Started

### Development

```bash
npm install
npm run dev        # Webpack watch mode
```

### Production Build

```bash
npm run build
# Output: dist/
```

### Load in Chrome

1. Open `chrome://extensions/` → enable **Developer mode**
2. Click **Load unpacked** → select the `dist/` folder
3. Navigate to `chatgpt.com` or `gemini.google.com`
4. The tree sidebar appears automatically on the right

---

## 🗺️ Roadmap

- [x] **Phase 1 (MVP):** MutationObserver engine, Shadow DOM sidebar, React Flow tree rendering
- [x] **Phase 2:** `Transformers.js` Web Worker for semantic drift detection and automated branching
- [x] **Phase 3:** Full CRUD for tree nodes and persistence via `Dexie.js`
- [ ] **Phase 4:** Dagre.js auto-layout for multi-branch trees
- [ ] **Phase 5:** Cloud synchronization with Node.js / PostgreSQL backend

---

## 🤝 About the Author

When using AI to assist with learning, the author frequently—amidst the back-and-forth of Q&A—gradually loses sight of the fundamental question. This is a lapse that proves counterproductive and leads to a lack of focus. This project focuses on solving cognitive overload in AI-assisted education.

---

License: MIT
