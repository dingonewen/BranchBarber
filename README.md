# BranchBarber

<p align="center">
  <img src="public/icons/source.png" width="120" alt="BranchBarber" />
</p>

> **Stop shaving the yak. Start climbing the tree.**

BranchBarber is a Chrome Extension that transforms linear AI chat logs into a live, interactive **Conversation Tree**. It automatically detects when your conversation drifts to a new topic, visualizes that drift as a branch in a node graph, and gives you precise tools to navigate, reorganize, and annotate your thinking in real time.

Supported platforms: **ChatGPT** (chatgpt.com, chat.openai.com) and **Google Gemini** (gemini.google.com).

---

## The Problem: Context Drift in AI Conversations

AI chat interfaces are linear. Real thinking is not. A session that starts with "Build a machine learning model" quickly spirals:

```
Root:         Build an ML model
  └─ Branch:  Fix Python environment path
       └─ Branch:  Debug shell permissions
            └─ Now: Researching Linux kernel flags
```

By the time you answer the tenth side question, you've forgotten why you opened the chat. BranchBarber maps exactly this kind of drift, labels each diversion, and lets you jump back to any point in the tree without losing work.

---

## Getting Started

### Build

```bash
npm install
npm run build      # output → dist/
```

For development with live reload:

```bash
npm run dev        # Webpack in watch mode
```

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked** and select the `dist/` folder
4. Navigate to `chatgpt.com` or `gemini.google.com`
5. BranchBarber automatically activates and the sidebar appears on the right side of the page

### Reload After Changes

After rebuilding, go to `chrome://extensions/` and click the ↺ refresh icon on the BranchBarber card. Then hard-reload the AI chat tab (`Ctrl+Shift+R`).

---

## The Popup

Click the BranchBarber icon in the Chrome toolbar to open the popup.

**Open Saved Tree** — opens the sidebar for the current tab, restoring the last saved tree for that conversation URL.

**New Tree** — wipes all stored nodes for the current conversation and starts a fresh tree. Use this when you start a genuinely new session and don't want the old tree to interfere. The sidebar opens automatically after the reset.

The status dot in the popup shows whether BranchBarber is active on the current tab (green), loading (amber), or idle/unsupported (grey).

---

## The Sidebar

The sidebar slides in from the right edge of the page and can be toggled with the `‹ ›` tab that sticks to its left edge at all times.

**Resizing the sidebar** — drag the thin strip at the very left edge of the sidebar panel left or right. The sidebar respects a minimum width of 280 px and a maximum of 700 px.

**Tabs**

- **Tree View** — the main node graph canvas
- **Settings** — Gemini API key and drift detection configuration

**Header indicators**

- The node count below the title updates in real time as new turns are processed.
- A small purple dot next to the title pulses while a turn is being processed.

**Legend strip** at the bottom of the Tree View identifies node colors: Root (purple), Branch (column-colored), Side Quest (orange), Normal (grey).

---

## How the Tree Is Built

Every time you send a message and receive a reply, BranchBarber captures that prompt/response pair and adds a node to the tree. Processing happens automatically — you never need to trigger it manually.

**Pairs are processed in order** (`domIndex` 0, 1, 2, …). The first pair in a conversation always becomes the **Root** node.

**Parent-relative layout**: each new node is placed directly below its parent on the canvas. When a branch is detected, the new node shifts one column to the right, and a ghost placeholder occupies the left-child slot to show where the main thread would have continued.

**Node positions are persisted** in IndexedDB so the tree layout survives page reloads and tab switches.

---

## Drift Detection

BranchBarber uses a two-layer approach to measure how much a new turn has drifted from the previous one:

### Layer 1 — Keyword Detection

Before any computation, the prompt is checked for explicit shift signals:

- English: `by the way`, `btw`, `anyway`, `separate question`, `separate issue`, `different topic`, `change of topic`, `unrelated`
- Mandarin Chinese: topic-transition discourse markers equivalent to "by the way", "on a different note", "while I'm at it", and "separate question"
- Additional languages can be added by extending the `SHIFT_KEYWORDS` array in `src/content/observer.ts`

If any of these phrases are detected, the turn is immediately flagged as a side quest regardless of semantic similarity.

### Layer 2 — Semantic Embedding (primary)

Each turn's combined prompt + response text (up to 512 characters) is embedded using **`all-MiniLM-L6-v2`** running entirely in-browser via Transformers.js on a WASM backend in an offscreen document. The embedding is computed asynchronously and never leaves your browser.

The drift score is `1 − cosine_similarity(current_embedding, parent_embedding)`. A score of `0` means the topics are identical; a score of `1` means completely unrelated.

### Layer 3 — Lexical TF-IDF (fallback)

If the embedding model hasn't finished loading yet (it pre-warms on extension startup but takes a few seconds the first time), a lightweight TF-IDF cosine similarity is computed directly over tokenized word frequencies — no ML required. Stopwords are filtered out. The same 0–1 drift scale is used.

### Threshold

The drift score is compared against `1 − driftThreshold` (configurable in Settings, default 60%). If the score exceeds the threshold, the turn is auto-flagged as a **Side Quest** (orange, pending user confirmation).

The console logs each turn's drift details:
```
[BB] Turn 3 embedding drift: 0.712
[BB] Turn 3: keyword=false drift=0.712 thr=0.40 → branch=true
```

---

## Node Types

| Badge label | Color | Meaning |
|---|---|---|
| **Root** | Purple (mauve) | First turn of the conversation. Always at position (0, 0). |
| **Main Thread** | Grey | A normal turn continuing the current branch. |
| **Side Quest?** | Orange (peach) | Auto-detected drift — pending user confirmation. Dashed animated edge. |
| **Branch** | Column color | User-confirmed branch. Solid edge in the column's palette color. |
| **Placeholder** | Dim grey | A ghost node inserted to reserve the left-child slot when a branch is detected. Italic label, dashed edge. |
| **Isolated** | Grey (no parent) | A node that has been detached from the tree. Floats freely. |

**Branch colors** are assigned by horizontal column. Each column to the right of the root gets a distinct color from the Catppuccin Latte extended palette (blue, teal, green, peach, pink, sapphire, maroon, flamingo). All nodes in the same column share a color, so you can visually follow a branch thread top to bottom.

---

## The Canvas

The tree is rendered as an interactive node graph using React Flow.

**Pan** — click and drag on an empty area of the canvas.

**Zoom** — scroll wheel, or use the `+` / `−` / fit-view controls in the bottom-right corner.

**Select a node** — click any node to open the Node Detail panel at the top of the sidebar. Click the node again or press ✕ in the detail panel to deselect.

**Drag a node** — click and drag any node to reposition it. When you release near another node (within 90 px), **magnetic snap** kicks in: the dragged node (and its entire subtree) automatically snaps to become a child of the nearest node, and the parentId relationship is updated in IndexedDB.

**Undo button** — the `↩ Undo (N)` button in the bottom-left of the canvas steps back up to 20 actions. It restores the Zustand store state and synchronizes IndexedDB (re-inserting deleted nodes, removing added ones, updating changed fields). The count in parentheses shows how many undo steps are available.

---

## Node Detail Panel

Click any node to open its detail panel at the top of the tree view.

**Header row** — a colored badge showing the node type (Root / Branch / Side Quest? / Main Thread / Placeholder) on the left, and the turn number on the right.

**Prompt** — the full user message for this turn, without any prefix.

**AI response preview** — the full AI reply, shown in a subtle inset box below the prompt. This section only appears for non-ghost nodes.

**Topic drift bar** — a horizontal bar showing the drift score from the previous node (0–100%). Green = low drift, yellow = moderate, red = high.

**Resizing the detail panel** — drag the bottom edge of the panel downward to expand it and read longer content. The panel has a default height of 210 px and can be expanded up to 600 px. Content scrolls inside.

### Actions

| Button | Appears when | What it does |
|---|---|---|
| **👁 View** | Any non-ghost node | Scrolls the chat page to this turn and briefly highlights it with a purple outline. |
| **⛓ Detach** | Non-root nodes with a parent | Splices the node out of its parent-child chain. Its children are reconnected directly to its grandparent. The node itself becomes isolated (no parent). Persists to IndexedDB. |
| **✂ Branch →** | Normal nodes with a parent | Manually promotes the node to a confirmed branch. A ghost placeholder is created at the left-child slot. The node and its entire subtree shift one column to the right. The ghost label is filled asynchronously by Gemini if an API key is configured. |
| **✓ Confirm** | Side Quest? (orange) nodes | Confirms the auto-detected branch. The node turns solid and takes the column's palette color. |
| **↺ Back to Main** | Confirmed Branch nodes | Reverses a branch. Finds the sibling ghost node, moves the node and subtree back to the ghost's position, and deletes the ghost. |
| **🗑 Delete** | Placeholder (ghost) nodes | Removes the ghost node. Any children it had are reparented directly to the ghost's parent. |
| **🗑 Delete** | Isolated nodes (no parent, not root) | Permanently deletes the floating node from the store and IndexedDB. |

All actions that modify the tree automatically push a snapshot to the undo stack before executing.

---

## Drift Alert Banner

When a new turn is auto-detected as a side quest, a **Side Quest Detected** banner appears at the top of the tree panel (above the node detail). It shows the drift percentage.

- **✓ Confirm Branch** — same as clicking Confirm in the node detail: locks the node as a branch, dismisses the banner, and selects the node.
- **Dismiss** — closes the banner without changing the node's status. The node remains orange (Side Quest?) until you act on it via the node detail.

---

## The "✂ Branch Here" Button

BranchBarber injects a small **"✂ Branch Here"** button beneath every AI response in the chat. Clicking it immediately marks that node as a confirmed branch (equivalent to using Node Detail → Branch →), without needing to open the sidebar. After clicking, the button changes to **"✓ Branched"** (green) to confirm the action.

---

## Settings

Open the **Settings** tab in the sidebar.

### Gemini API Key

Paste your Gemini API key (`AIza...`) here. The key is stored in IndexedDB and **never leaves your browser** — it is only used for direct client-side API calls.

When a key is configured, two features activate:

1. **Branch summaries** — after each turn is processed, Gemini 2.0 Flash generates an 8-word summary of the prompt/response pair. This becomes the node's label. Without a key, the label falls back to the first 60 characters of the prompt.

2. **Ghost node labels** — when a branch is created, Gemini predicts in 8 words what the user would have asked next on the main thread, and uses that as the placeholder label (e.g. "Explain gradient descent next steps").

Without a key, all functionality works except these two label-generation features.

**To get a Gemini API key**: visit [Google AI Studio](https://aistudio.google.com/apikey), create a project, and generate a free key.

### Auto-detect Side Quests

Toggle (default: on). When enabled, every new turn is checked for drift and flagged automatically. When disabled, BranchBarber still builds the tree but never auto-flags — you can still branch manually using "✂ Branch Here" or Node Detail.

### Drift Threshold

Slider from 30% to 90% (default: 60%). Controls how sensitive auto-detection is.

- **Lower value (e.g. 30%)** — more sensitive. Flags smaller topic shifts as side quests. Useful for highly focused sessions where any deviation matters.
- **Higher value (e.g. 90%)** — more relaxed. Only flags dramatic topic changes. Useful for wide-ranging exploratory sessions.

The threshold works as: `flag if drift_score > (1 − threshold)`. At 60%, anything with >40% cosine distance from the previous turn is flagged.

Click **Save Settings** to persist. The button briefly turns green ("✓ Saved") to confirm.

---

## Privacy

- All conversation data (prompts, responses, embeddings, positions) is stored locally in your browser's **IndexedDB** using Dexie.js.
- The embedding model (`all-MiniLM-L6-v2`) runs entirely on-device via WebAssembly. No text is sent to any server for embedding.
- The only optional network call is to the **Gemini API** for label generation, and only if you have provided an API key. The request includes up to 500 characters of your prompt and response.
- No telemetry, no analytics, no external logging.

---

## Architecture

```
src/
├── background/
│   └── index.ts             # MV3 service worker — routes EMBED messages to offscreen doc
├── offscreen/
│   └── index.ts             # Offscreen document — loads Transformers.js WASM pipeline,
│                            # pre-warms model on startup, handles EMBED requests
├── content/
│   ├── index.ts             # Entry point — mounts sidebar, wires bb-reset listener
│   ├── observer.ts          # Core pipeline: MutationObserver → drift detection →
│   │                        # node creation → DB write → store update
│   ├── selectors.ts         # DOM selectors for ChatGPT and Gemini (with fallbacks)
│   ├── navigator.ts         # Message handler: SHOW_SIDEBAR, RESET_TREE, scroll-to,
│   │                        # reset-to (triggers host page Edit button)
│   └── sidebar-injector.ts  # Injects a Shadow DOM host and mounts the React sidebar
├── popup/
│   ├── index.tsx            # Popup entry point
│   └── PopupApp.tsx         # "Open Saved Tree" / "New Tree" UI
├── store/
│   └── index.ts             # Zustand store — nodes, layout, undo stack, settings,
│                            # drift alerts; actions: addNode, markAsBranch, shiftSubtree,
│                            # reparentNode, pushUndo, undo, bumpLayoutKey, …
├── db/
│   └── index.ts             # Dexie schema: nodes, conversations, settings tables;
│                            # upsertNode, getConversationNodes, saveSettings, …
├── utils/
│   ├── index.ts             # generateId, cosineSimilarity, lexicalDrift (TF-IDF),
│   │                        # debounce, truncate
│   └── gemini.ts            # summarizeWithGemini, inferGhostTopic
└── components/
    ├── theme.ts             # Catppuccin Latte palette; branchColor(posX), branchBg(posX)
    ├── Sidebar.tsx          # Sidebar shell — resize handle, tabs, header, legend strip
    ├── ConversationTree.tsx # React Flow canvas — node/edge building, magnetic snap,
    │                        # undo button (Panel bottom-left), DB sync on undo
    ├── TreeNode.tsx         # Custom node renderer — drift bar, status badge, colors
    ├── NodeDetail.tsx       # Selected-node inspector — prompt, response, actions,
    │                        # branch/unbranch/detach/delete logic
    ├── DriftAlert.tsx       # "Side Quest Detected" banner
    ├── SettingsPanel.tsx    # API key + threshold form
    └── ErrorBoundary.tsx    # Catches React render errors in tree/settings
```

### Data Flow

```
DOM mutation (MutationObserver, debounced 800 ms)
  │
  ├─ Extract prompt + response text from ChatGPT/Gemini DOM
  ├─ Request embedding → background service worker → offscreen WASM pipeline
  │   (async; falls back to lexical TF-IDF if model not ready)
  ├─ Compute drift score vs. parent node's embedding (cosine or TF-IDF)
  ├─ Check keyword shift signals
  ├─ Determine node position (parent-relative binary-tree layout)
  │   ├─ Normal: left child of parent (x = parentX, y = parentY + 130)
  │   └─ Branch: right child of parent (x = parentX + 240, y = parentY + 130)
  │       + ghost left child placeholder created simultaneously
  ├─ Call Gemini API for 8-word summary label (optional, async)
  ├─ Persist node to IndexedDB (Dexie upsertNode)
  ├─ Update Zustand store (addNode → buildChildren → React re-render)
  └─ If drift flagged: set driftAlert → DriftAlert banner appears
```

### Key Design Decisions

**Shadow DOM injection** — the sidebar React tree is mounted inside a Shadow DOM host so its styles never conflict with ChatGPT's or Gemini's CSS.

**Offscreen document for embeddings** — Chrome MV3 service workers have strict restrictions on WASM and large module loading. An offscreen document (a hidden extension page) sidesteps these limits and keeps the WASM pipeline alive across multiple requests.

**Parent-relative layout** — node positions are stored as absolute (x, y) canvas coordinates derived at creation time from the parent's position. This means positions survive reloads and arbitrary tree edits without needing a layout algorithm at render time. `rebuildLayoutFromNodes` reconstructs the live layout tracking state (`mainBranchCurrentId`, `sideQuestCurrentId`) from the sorted DB nodes on page reload.

**Structure hash for React Flow** — rather than syncing ReactFlow node state on every Zustand update, `ConversationTree` computes a hash of `id:parentId:status:posX` for all nodes and only rebuilds the full node/edge arrays when this hash changes. Selection changes (which don't affect structure) only update the `selected` flag on existing ReactFlow nodes, avoiding unnecessary re-renders.

**Undo stack** — up to 20 snapshots of the full `nodes` record are stored in Zustand. On undo, the snapshot is restored to the store and then synchronized back to IndexedDB: nodes that reappear are re-inserted (without embeddings, which are re-computed on the next matching turn), nodes that should be gone are deleted, and changed fields (parentId, position, status flags) are updated.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) |
| UI framework | React 18 |
| State management | Zustand |
| Tree visualization | React Flow |
| Local persistence | Dexie.js (IndexedDB) |
| On-device embeddings | Transformers.js · `all-MiniLM-L6-v2` · WASM |
| Optional summarization | Gemini 2.0 Flash API |
| Build | Webpack 5 (multi-entry MV3 config) |
| Extension API | Chrome Manifest V3 |

---

## Roadmap

- [x] MutationObserver pipeline for ChatGPT and Gemini
- [x] Shadow DOM sidebar with React Flow tree
- [x] Semantic drift detection (Transformers.js embeddings + TF-IDF fallback)
- [x] Binary-tree parent-relative layout with ghost placeholders
- [x] Manual and auto branch/unbranch with full subtree shifting
- [x] Magnetic snap on node drag
- [x] Gemini-powered node summaries and ghost label prediction
- [x] Resizable sidebar
- [x] Undo (20-step history with DB sync)
- [x] Node detail: resizable, full prompt + response preview
- [ ] Dagre.js auto-layout option for large trees
- [ ] Export tree as image or JSON
- [ ] Cross-device sync via cloud backend

---

## Author

Built by **Wen Ding**

- Email: [dingywn@seas.upenn.edu](mailto:dingywn@seas.upenn.edu)
- GitHub: [@dingonewen](https://github.com/dingonewen)

---

License: MIT
