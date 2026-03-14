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

## ✨ Key Features
- **Dynamic Tree Visualization:** Real-time mapping of linear conversations into hierarchical nodes using `React Flow`.
- **Semantic Drift Detection:** Uses **Local Embeddings** (`Transformers.js`) to calculate cosine similarity between the current prompt and the root objective, flagging "Side Quests" automatically.
- **Context Teleportation:** One-click navigation to historical nodes with automated DOM scrolling and context-aware resets.
- **Local-First Privacy:** All chat data is stored locally in `IndexedDB`. No data leaves your browser unless you opt-in for cloud sync.
- **Hybrid Branching:** Choose between automated AI detection or manual "Mark as Branch" triggers.

| Feature | Description |
|---|---|
| **MutationObserver Engine** | Real-time DOM monitoring on ChatGPT & Gemini without page interference |
| **Manual Branching** | Injected "✂ Branch Here" button on every AI response |
| **Automatic Drift Detection** | Cosine similarity via `all-MiniLM-L6-v2` embeddings in a Web Worker |
| **Visual Tree** | Interactive React Flow graph with color-coded nodes |
| **Context Reset** | Click any node → "↩ Reset Here" to jump back via the Edit function |
| **Branch Summarization** | Gemini API (optional) for 8-word node labels |
| **Persistent Storage** | Dexie.js (IndexedDB) for full conversation trees across sessions |
| **Privacy-First** | All computation local; no data leaves your browser (unless Gemini API key set) |

## 🛠️ Technical Stack (The Architecture)

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript (strict) |
| Extension | Manifest V3 |
| State | Zustand |
| Styling | Tailwind CSS |
| Tree UI | React Flow |
| Embeddings | Transformers.js (`all-MiniLM-L6-v2`) |
| Storage | Dexie.js (IndexedDB) |
| Summarization | Gemini 2.0 Flash API |
| Bundler | Webpack 5 |

## Architecture

```
src/
├── background/      # MV3 Service Worker (message routing, keepalive)
├── content/
│   ├── index.ts         # Entry point
│   ├── observer.ts      # MutationObserver + node processing pipeline
│   ├── selectors.ts     # Resilient DOM selectors (ChatGPT & Gemini)
│   ├── navigator.ts     # Scroll-to / Reset-to logic
│   └── sidebar-injector.ts  # Shadow DOM React mount
├── worker/
│   └── embeddings.worker.ts  # Transformers.js (all-MiniLM-L6-v2) in Web Worker
├── store/
│   └── index.ts         # Zustand state management
├── db/
│   └── index.ts         # Dexie.js (IndexedDB) schema + queries
├── utils/
│   ├── index.ts         # cosineSimilarity, debounce, generateId
│   └── gemini.ts        # Gemini API summarization
├── components/
│   ├── Sidebar.tsx          # Main sidebar shell
│   ├── ConversationTree.tsx # React Flow canvas
│   ├── TreeNode.tsx         # Custom node renderer
│   ├── NodeDetail.tsx       # Selected node inspector
│   ├── DriftAlert.tsx       # Drift detection banner
│   └── SettingsPanel.tsx    # API key + threshold settings
└── popup/
    └── PopupApp.tsx     # Extension popup
```
## Setup

### Development

```bash
npm install
npm run dev       # watch mode
```

### Production Build

```bash
npm run build
# Output: dist/
```

### Load in Chrome

1. `chrome://extensions/` → Enable **Developer mode**
2. **Load unpacked** → select `dist/` folder
3. Navigate to `chatgpt.com` or `gemini.google.com`

---

## Configuration

Open the BranchBarber sidebar → **Settings** tab:

- **Gemini API Key** — optional; enables 8-word AI summaries on each node
- **Drift Threshold** — cosine similarity threshold (default 60%) for flagging side quests
- **Auto-detect side quests** — toggle automatic drift alerts

### Data & AI Logic
- **Primary Storage:** `Dexie.js` (IndexedDB) - Chosen for zero-latency local persistence and high-frequency writes.
- **Edge AI:** `Transformers.js` - Running NLP models on-device for privacy and performance.
- **Cloud Sync (Future):** Node.js & PostgreSQL - For cross-device persistence.

## 🏗️ Engineering Challenges (SDE/TPM Highlights)
- **Performance Optimization:** Implemented `MutationObserver` with `requestIdleCallback` to monitor heavy DOM changes in Gemini/ChatGPT without affecting UI thread performance.
- **Architectural Trade-offs:** Prioritized a **Local-first** approach (IndexedDB) over traditional cloud-only storage to ensure 100% privacy and offline functionality.
- **Selector Resilience:** Built a robust DOM-mapping engine to handle frequent UI updates on host LLM platforms.

## 🗺️ Roadmap
- [ ] **Phase 1 (MVP):** Basic sidebar tree rendering and DOM scraping.
- [ ] **Phase 2:** Integration of `Transformers.js` for automated semantic branching.
- [ ] **Phase 3:** Full CRUD for tree nodes and persistence via Dexie.js.
- [ ] **Phase 4:** Cloud synchronization with Node.js/PostgreSQL backend.

## 🤝 About the Author
When using AI to assist with learning, the author frequently—amidst the back-and-forth of Q&A—gradually loses sight of the fundamental question. This is a lapse that proves counterproductive and leads to a lack of focus. This project focuses on solving cognitive overload in AI-assisted education.

---
License: MIT
