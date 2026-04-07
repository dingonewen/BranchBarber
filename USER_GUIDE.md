# Branch Barber — User Guide

<p align="center">
  <img src="public/icons/source.png" width="100" alt="Branch Barber" />
</p>

This guide covers every feature of Branch Barber in detail. Whether you just installed the extension or want to understand exactly how the tree-building logic works, this is the reference.

<p align="center">
  <img src="public/screenshot4.jpg" width="720" alt="Branch Barber in action" />
</p>

---

## Table of Contents

1. [What Branch Barber Does](#what-branch-barber-does)
2. [Installation](#installation)
3. [First Use](#first-use)
4. [The Popup](#the-popup)
5. [The Sidebar](#the-sidebar)
6. [How the Tree Is Built](#how-the-tree-is-built)
7. [Understanding Drift Detection](#understanding-drift-detection)
8. [Node Types and Colors](#node-types-and-colors)
9. [Navigating the Canvas](#navigating-the-canvas)
10. [The Node Detail Panel](#the-node-detail-panel)
11. [The "✂ Branch Here" Button](#the--branch-here-button)
12. [Settings](#settings)
13. [Undo](#undo)
14. [New Tree vs. Reload](#new-tree-vs-reload)
15. [Tips and Tricks](#tips-and-tricks)
16. [Troubleshooting](#troubleshooting)

---

## What Branch Barber Does

When you chat with an AI assistant, your conversation naturally wanders. You start asking about one thing, get an answer, then ask a follow-up about a completely different aspect, then ask something unrelated entirely. Standard chat interfaces show all of this as a flat, scrolling list. Branch Barber shows it as a **tree**.

Every message-response pair becomes a **node**. When a new message is significantly different in topic from the previous one, Branch Barber automatically places that node in a new **branch column** to the right, creating a visual fork. Nodes that stay on topic flow straight down. The result is a spatial map of your entire thinking process.

You can also **manually branch** any node, **drag and reparent** nodes, **undo** any action, and **jump directly** to any point in the conversation by clicking a node.

---

## Installation

### From Source (Developer Mode)

1. Download or clone the repository
2. Run `npm install` then `npm run build`
3. Open `chrome://extensions/` in Chrome
4. Enable **Developer mode** in the top-right corner
5. Click **Load unpacked** and select the `dist/` folder
6. The Branch Barber icon (a pair of scissors) appears in your Chrome toolbar

### After Updating

Whenever you rebuild (`npm run build`), go to `chrome://extensions/`, find Branch Barber, and click the circular **↺ refresh** button. Then press `Ctrl+Shift+R` on your ChatGPT or Gemini tab to hard-reload it.

---

## First Use

1. Open [chatgpt.com](https://chatgpt.com) or [gemini.google.com](https://gemini.google.com)
2. Branch Barber activates automatically — a thin tab labeled `›` appears on the right edge of the page
3. Click the `›` tab to open the sidebar
4. Start a conversation. After each complete message-response pair, a new node appears in the tree
5. Nodes appear almost instantly — Branch Barber does not wait for any network calls before displaying them

If you open Branch Barber on a conversation that already has many messages, all existing turns are processed immediately when the tree loads.

---

## The Popup

Click the Branch Barber icon in the Chrome toolbar to open the popup.

<img src="public/icons/source.png" width="32" style="vertical-align:middle" /> The popup gives you two main actions:

### Open Tree
Opens the sidebar for the current tab. If you previously had a tree for this conversation, it is restored exactly as you left it — node positions, branch status, labels, everything.

### New Tree
Wipes all stored nodes for the current conversation URL and starts a completely fresh tree. Use this when:
- You want to re-analyze an existing conversation from scratch with different settings
- A previous tree got into a bad state
- You changed your drift threshold and want to rebuild cleanly

The sidebar opens automatically after a New Tree reset.

### Status Dot
- **Green** — Branch Barber is active on this tab
- **Amber** — Checking / loading
- **Grey** — Not active, or you're on an unsupported site

---

## The Sidebar

The sidebar slides in from the right edge of the page.

### Opening and Closing
Click the `‹ ›` tab on the left edge of the sidebar at any time. The tab is always visible even when the sidebar is closed.

### Resizing
Drag the thin vertical strip at the very left edge of the sidebar panel. Drag left to make it wider, drag right to make it narrower. Minimum width is 280 px; maximum is 1200 px (wide enough to stretch across most of the Gemini page).

### Tabs
- **Tree View** — the interactive node graph canvas
- **Settings** — API key and drift detection configuration

### Header
- The icon and title **Branch Barber** are shown at the top
- A node count shows how many nodes are in the current tree, updating in real time
- A small dot pulses while a turn is being processed

### Legend
At the bottom of the Tree View, a legend strip shows the color assigned to each node type currently present in the tree. The legend is **dynamic** — it only shows colors and labels for node types that actually exist in the current tree. Branch columns each get their own color entry.

---

## How the Tree Is Built

### Automatic Processing
Branch Barber uses a `MutationObserver` to watch the chat page for new content. When the AI finishes responding to a message, the observer fires and Branch Barber processes the new prompt-response pair within about a second.

Processing is **non-blocking** — nodes appear immediately with a fallback label (the first 60 characters of your prompt). If you have AI mode enabled in Settings, the label updates to an 8-word Gemini summary a few seconds later.

### The Layout Model
The tree uses a **binary-tree parent-relative layout**:

```
Node A  (x=0, y=0)        ← Root
│
├── Ghost (x=0, y=130)    ← Left child: placeholder for "where main thread would go"
└── Node B (x=240, y=130) ← Right child: drifted node (branch)
    │
    ├── Ghost (x=240, y=260)
    └── Node C (x=480, y=260) ← Another branch
        │
        └── Node D (x=480, y=390) ← Same topic as C → straight down, no branch
```

**Key rules:**
- Every node's parent is the **previous node** in chronological order, regardless of whether it was a branch or not
- When drift is detected: new node goes **right** (x + 240), a ghost placeholder stays **left** (same x)
- When no drift: new node goes **straight down** (same x, y + 130)
- The ghost placeholder is decorative — it marks where the main thread "would have continued" and is not a parent of any subsequent node
- The tree always trends **rightward** as more branches are detected

### Processing Historical Turns
When you click "New Tree" or reload the page, Branch Barber processes all existing turns in sequence without any Gemini API calls (to avoid rate limiting). All nodes get local fallback labels. Only new turns you type after the tree loads will trigger Gemini label generation (if AI mode is on).

---

## Understanding Drift Detection

### What is Drift?
Drift is a measure of how different the topic of the current message is from the topic of the previous message. Branch Barber computes a score from 0 to 100%:
- **0%** = identical or nearly identical topics
- **100%** = completely unrelated topics

### How it's Computed
Branch Barber uses two methods:

**Lexical drift (instant):** The prompt + response text is tokenized into words, stopwords are removed, and a TF-IDF cosine similarity is computed against the parent node's text. This runs synchronously and is what actually determines branching — it's available immediately.

**Semantic embeddings (background):** In the background, the text is also run through `all-MiniLM-L6-v2` (a 22M-parameter sentence embedding model that runs entirely in your browser via WebAssembly). When the embedding finishes, it's stored in the database and will be used for drift comparison in future nodes. This improves accuracy for paraphrased questions but doesn't block node creation.

### The Threshold
In Settings, the **Drift Threshold** slider (default **80%**) controls when a branch is triggered:
- If `drift score > threshold`, the node is placed in a new branch column (right child)
- If `drift score ≤ threshold`, the node continues straight down (left child)

**80% means:** only dramatic topic changes trigger a branch. If you're asking follow-up questions on the same topic, they stay on the same column. If you suddenly switch to a completely different subject, they branch right.

**Lowering to 60%:** branches more aggressively — even moderate topic shifts get their own column.

**Raising to 90–95%:** only extreme topic changes branch.

---

## Node Types and Colors

### Root (Purple)
The very first message in the conversation. Always at canvas position (0, 0). There is exactly one root per tree.

### Main Thread (Grey)
A normal node that continued on the same topic as its parent. Most nodes in a focused conversation will be this type.

### Branch (Column color)
A node whose topic differed from its parent by more than the drift threshold. Branch nodes are placed to the right. The color depends on which column they're in:

| Column | Color |
|--------|-------|
| 1 (first branch) | Blue |
| 2 | Teal |
| 3 | Green |
| 4 | Peach/orange |
| 5 | Pink |
| 6 | Sapphire |
| 7+ | Maroon, Flamingo, … |

All nodes in the same horizontal column share the same color, making it easy to follow a branch thread top-to-bottom.

### Placeholder / Ghost (Dim grey, dashed border)
When a branch is created, a ghost node appears at the **left child slot** of the branching point. This is a visual marker showing "this is where the main thread would have continued." Ghost nodes have an italic label ("Continue main thread here") and a dashed border. They are not associated with any real message.

In AI mode, the ghost label is replaced by a Gemini-generated summary of the parent node's content (e.g., "Explaining Python environment setup steps").

### Isolated (Grey, no parent)
A node that has been manually detached from the tree using the Detach action. It floats freely on the canvas and can be repositioned by dragging.

---

## Navigating the Canvas

### Pan
Click and drag on any empty area of the canvas (not on a node) to pan the view.

### Zoom
Scroll the mouse wheel to zoom in and out. You can also use the `+`, `−`, and fit-view buttons in the bottom-right corner of the canvas.

### Fit View
Click the fit-view button (square icon, bottom-right) to zoom the canvas so all nodes are visible.

### Select a Node
Click any node to select it. The **Node Detail panel** opens at the top of the sidebar showing the full content of that node. Click the node again, or click the ✕ in the detail panel, to deselect.

### Drag a Node
Click and drag any node to move it freely on the canvas. When you **release** the node:
- If it lands within 90 px of another node, **magnetic snap** activates: the dragged node (and its entire subtree) automatically snaps to become a child of the nearest node
- The parent-child relationship is updated immediately in both the store and IndexedDB
- If the release point is more than 90 px from any other node, the node stays where you dropped it (free positioning)

---

## The Node Detail Panel

Click any node to open the detail panel at the top of the tree view.

### Header
- Colored badge showing the node type (Root / Branch / Main Thread / Placeholder)
- Turn number (e.g., "Turn 5") on the right
- ✕ button to close

### Content
- **Your prompt** — the full text of your message to the AI
- **AI response preview** — the first sentence of the AI's reply, shown in a subtle box. Hidden for ghost nodes.
- **Topic drift bar** — a colored progress bar showing the drift score from the previous node. Green = low, yellow = medium, red = high.

### Resizing the Panel
Drag the bottom edge of the Node Detail panel downward to expand it. Content scrolls inside. Default height is 210 px; maximum is 600 px.

### Actions

**👁 View**
Scrolls the chat page to the message this node represents and briefly highlights it with a purple outline. Useful for jumping back to context.

**⛓ Detach**
Removes this node from its position in the tree without deleting it. Its children are reconnected directly to its grandparent, keeping the chain intact. The node itself becomes Isolated (floats freely). Use this to "splice out" a turn you don't want in the main flow.

**✂ Branch →**
Manually promotes a Main Thread node to a Branch. A ghost placeholder is created at the left-child slot, and this node (plus its entire subtree) shifts one column to the right. If AI mode is enabled, the ghost label is generated by Gemini asynchronously. Use this to manually mark a divergence that the automatic detector missed.

**↺ Back to Main**
Reverses a Branch back to a normal Main Thread node. The ghost sibling is found and deleted, and this node's subtree shifts back left to occupy the ghost's old position.

**🗑 Delete** (ghost nodes)
Removes a ghost placeholder node. Its children (if any) are reparented to the ghost's parent, preserving the chain.

**🗑 Delete** (isolated nodes)
Permanently deletes a floating/isolated node from the tree and database.

All actions automatically push a snapshot to the undo stack before executing.

---

## The "✂ Branch Here" Button

Branch Barber injects a small button directly into the chat page beneath every AI response:

```
✂ Branch Here
```

Clicking this button immediately marks that conversation turn as a Branch — identical to clicking **✂ Branch →** in the Node Detail panel, but without needing to open the sidebar.

After clicking, the button changes to:

```
✓ Branched
```

(green) to confirm. **Clicking it again reverses the branch** — the button returns to "✂ Branch Here" and the node reverts to Main Thread status. It's a full toggle.

**Notes:**
- These buttons appear on all AI responses, both for new turns and for existing turns when the tree is loaded
- On Gemini, the buttons are injected as siblings of the `<model-response>` element so Angular's re-rendering cannot remove them
- If you click "New Tree", all existing Branch Here buttons are removed and re-injected fresh for the new tree

---

## Settings

Open the **Settings** tab in the sidebar.

### Node Labels

**Local** (default): Node labels use the first 60 characters of your prompt — instant, private, no API needed.

**AI (Gemini)**: Node labels are 8-word summaries generated by Gemini 2.0 Flash. More descriptive. Requires an API key. Gemini is only called for **new turns you type after the tree opens** — historical turns always use local labels to avoid rate limiting.

### Gemini API Key

Paste your Gemini API key (starts with `AIza...`) here. The key is stored in IndexedDB and **never leaves your browser** — it is used only for direct client-side Gemini API calls.

With a key configured and AI mode selected:
1. Each new turn gets an 8-word summary as its node label
2. When a branch is auto-detected or manually created, the ghost placeholder gets a Gemini-generated label summarizing the parent node's content (e.g., "Debugging Python path environment variables")

To get a key: visit [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

> **Note on rate limits:** Gemini API rate limiting (429 errors) is currently being addressed for paid-tier API keys. If you encounter 429 errors, Branch Barber will retry automatically with exponential backoff (up to 3 attempts). A more robust solution is coming soon.

### Auto-scale Overall Drift Threshold

**Toggle — what it controls:**

- **ON**: When you click Save Settings, the threshold change is applied **retroactively to all existing nodes** in the current tree. Nodes are re-evaluated with the new threshold and the entire layout is rebuilt — branches may appear or disappear immediately.

- **OFF**: The threshold only affects nodes added **from now on**. Existing nodes keep their current branch status unchanged.

### Drift Threshold Slider

Range: 30% to 95% (default: **80%**)

- **Lower value (e.g. 30–50%)** → "Branch more": smaller topic shifts trigger a branch. Good for highly focused sessions where any deviation matters.
- **Higher value (e.g. 85–95%)** → "Branch less": only dramatic topic changes trigger a branch. Good for wide-ranging exploratory sessions.

After adjusting:
- Click **Save Settings** to persist the value
- If Auto-scale is ON, the tree rebuilds immediately with the new threshold
- If Auto-scale is OFF, the new threshold applies to future nodes only

The button briefly turns green ("✓ Saved") to confirm.

---

## Undo

The **↩ Undo** button in the bottom-left of the canvas steps back up to **20 actions**.

Every action that modifies the tree (branching, unbranching, detaching, deleting, moving) automatically saves a snapshot before executing. Clicking Undo:
1. Restores the Zustand store to the previous snapshot
2. Synchronizes IndexedDB — re-inserts nodes that reappear, deletes nodes that should be gone, updates changed fields (parent, position, branch status)

The number in parentheses (e.g., `↩ Undo (3)`) shows how many steps are available. The button is greyed out when the stack is empty.

---

## New Tree vs. Reload

**Reload the page** (Ctrl+R or Ctrl+Shift+R): Branch Barber reloads and **restores your existing tree** from IndexedDB. All nodes, positions, and branch status are exactly as you left them.

**New Tree** (from the popup): Deletes all nodes for the current conversation URL from IndexedDB and starts fresh. Use this intentionally — it cannot be undone (the undo stack is also cleared).

**URL change**: When you navigate to a different conversation (different URL), Branch Barber automatically detects the URL change and initializes a new tree for that conversation. Your previous conversation's tree is saved and will be restored next time you visit that URL.

---

## Tips and Tricks

**Force a branch on a specific turn**: Click the **✂ Branch Here** button under any AI response, or click the node in the tree and use **✂ Branch →** in the Node Detail panel.

**Undo an accidental branch**: Click the node, then click **↺ Back to Main** in the Node Detail panel. Or use the **↩ Undo** button on the canvas.

**Jump to any message in the chat**: Click the node, then click **👁 View** in the Node Detail panel. The page scrolls to that message and highlights it.

**Reorganize the tree manually**: Drag nodes to new positions. Releasing near another node triggers magnetic snap and reparents the entire subtree.

**Read long prompts**: Drag the bottom edge of the Node Detail panel downward to expand it. Content scrolls inside.

**Widen the sidebar**: Drag the left edge of the sidebar to the left. You can make it wide enough to show many columns of branches side by side.

**Retroactively adjust branching**: Go to Settings, adjust the Drift Threshold slider, make sure "Auto-scale Overall Drift Threshold" is ON, and click Save. The tree immediately rebuilds with the new branching logic.

**Use Local mode for speed**: If you don't need AI-generated summaries, leave Node Labels set to "Local". Nodes appear instantly with truncated prompt labels and no API calls are made.

---

## Troubleshooting

### Nodes aren't appearing automatically

- Make sure you're on a supported page (`chatgpt.com` or `gemini.google.com`)
- Wait for the AI to **finish** responding — Branch Barber only processes complete message-response pairs
- Check the popup — the status dot should be green
- Try clicking "New Tree" to reinitialize

### The tree is missing some messages

- If the tree was opened after a long conversation already existed, all existing turns should be processed when you click "New Tree"
- If turns are still missing, the AI may have been mid-stream when processing occurred — sending a new message and receiving a reply will trigger a re-scan

### "✂ Branch Here" buttons are not showing

- Reload the tab (`Ctrl+Shift+R`) after reloading the extension
- On Gemini: buttons appear after a short delay as the page stabilizes. They should appear within 1–2 seconds of the AI finishing its response.

### Gemini API 429 errors

- This means you've hit the API rate limit. Branch Barber retries automatically with exponential backoff.
- To avoid this: keep Node Labels set to **Local** (default). Gemini is only called when AI mode is active AND you send a new message.
- A fix for paid-tier Gemini accounts is in progress.

### The tree looks wrong after changing the threshold

- Make sure "Auto-scale Overall Drift Threshold" is turned **ON** before clicking Save
- If the tree still looks wrong, click "New Tree" to rebuild from scratch with the current settings

### Extension stopped responding after a while

- Chrome MV3 service workers can go to sleep. Branch Barber has a keepalive alarm to prevent this, but if the worker has been idle for a long time, it may need a moment to restart.
- Hard-reload the tab (`Ctrl+Shift+R`) to reinitialize everything.

---

<p align="center">
  <img src="public/icons/dizzy.png" width="48" alt="" />
  <br/>
  <em>Built by <a href="https://github.com/dingonewen">Yiwen Ding</a> · <a href="mailto:dingywn@seas.upenn.edu">dingywn@seas.upenn.edu</a></em>
</p>
