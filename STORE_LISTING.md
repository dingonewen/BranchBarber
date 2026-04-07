# Chrome Web Store Listing — Branch Barber

This file contains all the text you need to fill in the Chrome Web Store Developer Dashboard.

---

## Basic Information

**Extension name:** Branch Barber

**Short description (132 characters max):**
```
Visualize your AI conversations as a tree. Auto-detect topic drift and navigate ChatGPT & Gemini like a map.
```

**Detailed description (up to 16,000 characters):**

```
Branch Barber transforms your linear AI chat sessions into a live, interactive conversation tree — so you can see exactly where your thinking branched, navigate back to any point instantly, and never lose context again.

Works on ChatGPT (chatgpt.com) and Google Gemini (gemini.google.com).

────────────────────────────────────────
THE PROBLEM
────────────────────────────────────────

AI conversations drift. You start asking about one thing, get a useful answer, then ask a follow-up on something slightly different, then something completely different — and ten messages later you've forgotten what you originally needed. Standard chat interfaces give you a flat scroll. Branch Barber gives you a map.

────────────────────────────────────────
HOW IT WORKS
────────────────────────────────────────

Every message-response pair becomes a node on a visual tree canvas. Branch Barber automatically measures the topic similarity between each new message and the previous one. When the topic changes significantly, the new node branches to the right — creating a visual fork in the tree. Messages that stay on the same topic flow straight down.

The result is a spatial layout of your entire conversation: you can see at a glance which threads are related, how far each branch has gone, and where you diverged from your original line of thinking.

────────────────────────────────────────
KEY FEATURES
────────────────────────────────────────

▸ AUTOMATIC TOPIC DRIFT DETECTION
Branch Barber computes how different each new message is from the previous one using a fast lexical similarity algorithm. When the score exceeds your configured threshold (default: 80%), the node automatically branches right. No manual tagging required.

▸ LIVE TREE UPDATES
Nodes appear as soon as the AI finishes responding — no refresh needed, no manual trigger. The tree updates in real time as your conversation progresses.

▸ MANUAL BRANCHING
Every AI response has a "✂ Branch Here" button injected directly into the chat page. Click it to manually mark a turn as a branch. Click again to undo. You can also branch, unbranch, detach, or delete any node from the sidebar.

▸ INTERACTIVE CANVAS
Pan, zoom, and drag nodes freely. When you drag a node near another, magnetic snap automatically reparents it and shifts the entire subtree — so you can reorganize your tree by hand.

▸ NODE DETAIL PANEL
Click any node to see the full prompt, a preview of the AI response, and a topic drift bar. Jump directly to that message in the chat with one click.

▸ ADJUSTABLE DRIFT THRESHOLD
Use the Settings slider to control how sensitive branching is. Lower = branches more often (good for focused sessions). Higher = only dramatic topic changes branch (good for wide-ranging exploration). Toggle "Auto-scale" to apply changes retroactively to the entire tree instantly.

▸ UNDO (20 STEPS)
Every tree action — branch, unbranch, detach, delete, move — can be undone. Up to 20 steps of history, synchronized with the local database.

▸ RESIZABLE SIDEBAR
Drag the sidebar edge to any width. Make it wide enough to show all branch columns side by side.

▸ 100% LOCAL AND PRIVATE
All conversation data, embeddings, and settings are stored in your browser's IndexedDB. Nothing is sent to the developer's servers. The on-device embedding model (all-MiniLM-L6-v2) runs entirely in your browser via WebAssembly.

▸ OPTIONAL AI NODE LABELS (REQUIRES GEMINI API KEY)
Enable AI mode in Settings and add your own Gemini API key to generate 8-word AI summaries as node labels. Without a key, labels use the first 60 characters of your prompt — fast and private.

────────────────────────────────────────
PERMISSIONS EXPLAINED
────────────────────────────────────────

• storage — saves your tree, settings, and node data locally in IndexedDB
• activeTab — reads the current tab's URL to associate the tree with the right conversation
• scripting — injects the sidebar and node buttons into ChatGPT and Gemini pages
• alarms — keeps the background service worker alive for reliable embedding processing
• offscreen — runs the on-device ML embedding model in a hidden page (required by Chrome MV3 for WebAssembly)

Branch Barber only activates on chatgpt.com, chat.openai.com, and gemini.google.com.

────────────────────────────────────────
COMING SOON
────────────────────────────────────────

• Chrome Web Store public release
• Export tree as image or JSON
• Support for additional AI platforms
• Optional cloud sync for cross-device trees

────────────────────────────────────────
OPEN SOURCE
────────────────────────────────────────

Branch Barber is built by Yiwen Ding (University of Pennsylvania).
GitHub: github.com/dingonewen
Contact: dingywn@seas.upenn.edu
```

---

## Category

**Primary category:** Productivity
**Secondary category:** Tools

---

## Store Icons and Screenshots Required

The Chrome Web Store requires:

| Asset | Size | Notes |
|-------|------|-------|
| Extension icon | 128×128 px PNG | Use `public/icons/icon128.png` |
| Small promo tile | 440×280 px PNG | Create from screenshot + logo |
| Screenshot(s) | 1280×800 or 640×400 px | At least 1, up to 5. Use `public/screenshot4.jpg` (resize/crop if needed) |
| Large promo tile (optional) | 920×680 px | Optional but recommended for featuring |
| Marquee promo tile (optional) | 1400×560 px | Only needed if applying for featuring |

**Minimum required to submit:** icon + at least 1 screenshot.

---

## Privacy Policy URL

You must host the Privacy Policy at a public URL. Options:

1. **GitHub Pages** (easiest): Push `PRIVACY_POLICY.md` to your repo, enable GitHub Pages, and use the URL:
   `https://dingonewen.github.io/BranchBarber/PRIVACY_POLICY`

2. **Raw GitHub**: Use the raw file URL directly:
   `https://raw.githubusercontent.com/dingonewen/BranchBarber/main/PRIVACY_POLICY.md`
   *(Note: Chrome Web Store may not accept raw GitHub URLs — GitHub Pages is preferred)*

3. **Any public webpage** you control

Enter this URL in the "Privacy policy" field of the store listing.

---

## Permissions Justification

The Developer Dashboard will ask you to justify each permission. Use these:

| Permission | Justification |
|-----------|--------------|
| `storage` | Stores conversation tree nodes, layout positions, drift scores, and user settings (drift threshold, API key) in the browser's IndexedDB via Dexie.js. All data is local — nothing is sent to external servers. |
| `activeTab` | Reads the current tab's URL to associate the conversation tree with the correct conversation and detect URL changes when the user navigates to a new chat. |
| `scripting` | Injects the sidebar React application and "Branch Here" buttons into ChatGPT and Gemini pages. Required to display the visual tree interface overlaid on the chat page. |
| `alarms` | Creates a periodic keepalive alarm to prevent the Chrome MV3 service worker from going to sleep during long conversations, ensuring the embedding pipeline remains available. |
| `offscreen` | Required by Chrome Manifest V3 to run WebAssembly workloads. An offscreen document loads and runs the all-MiniLM-L6-v2 sentence embedding model entirely on-device for semantic drift detection. |

---

## Single-Purpose Description

The Chrome Web Store requires a single-purpose statement:

```
Branch Barber's single purpose is to visualize AI conversation history as an 
interactive tree graph on ChatGPT and Google Gemini, enabling users to track 
topic drift and navigate their conversation structure.
```

---

## Remote Code Policy

Branch Barber does **not** use remote code. All JavaScript is bundled at build time via Webpack and included in the extension package. The only external network calls are:

1. Optional calls to the Google Gemini API (user-provided API key, user-initiated, opt-in only)
2. The `all-MiniLM-L6-v2` model files — these are bundled locally in the extension via CopyWebpackPlugin and loaded from the extension's own files, not from a CDN

---

## Version Notes (for first submission)

**Version:** 1.0.0

```
Initial release of Branch Barber.

Features:
- Automatic conversation tree building for ChatGPT and Google Gemini
- Topic drift detection using lexical TF-IDF similarity and on-device ML embeddings
- Auto and manual branching with configurable drift threshold
- Interactive React Flow canvas with pan, zoom, drag, and magnetic snap
- Node detail panel with prompt/response preview and direct navigation
- "Branch Here" inline buttons on every AI response
- Undo (20-step history with IndexedDB sync)
- Resizable sidebar
- Optional AI node labels via Gemini API (user-provided key, opt-in)
- 100% local storage — no telemetry
```

---

## Checklist Before Submitting

See `SUBMISSION_CHECKLIST.md` for the full pre-submission checklist.
