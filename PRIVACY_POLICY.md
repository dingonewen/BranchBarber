# Privacy Policy — Branch Barber

**Last updated:** April 2026

Branch Barber ("the Extension") is developed by Yiwen Ding. This Privacy Policy explains what data the Extension collects, how it is used, and how it is stored.

---

## Summary

Branch Barber is a **local-first** extension. All data it collects stays in your browser. It does not transmit your conversation content to any server owned or operated by the developer.

---

## Data Collected and How It Is Used

### Conversation Content (prompts and AI responses)

Branch Barber reads the text of your messages and AI responses from the ChatGPT and Google Gemini web pages you visit. This content is used solely to:

- Build and display the conversation tree in the sidebar
- Compute topic drift scores between consecutive messages
- Generate node labels for the tree

This content is stored **locally in your browser's IndexedDB** (via Dexie.js) and is never transmitted to any server operated by the developer.

### Text Embeddings

Short excerpts of your conversation text (up to 512 characters per turn) are processed by an on-device machine learning model (`all-MiniLM-L6-v2`) running entirely within your browser via WebAssembly. The resulting numerical vectors (embeddings) are stored locally in IndexedDB. **No text or embedding data is sent to any external server for this purpose.**

### Settings (including optional API keys)

If you choose to enter a Gemini API key in the Settings panel, that key is stored locally in your browser's IndexedDB. It is never logged, transmitted to the developer's servers, or shared with any third party.

### Optional Gemini API Calls

If you configure a Gemini API key and enable AI (Gemini) label mode, the Extension will send short excerpts of your conversation text (up to 500 characters per message) directly to the **Google Gemini API** (`generativelanguage.googleapis.com`) for the purpose of generating 8-word node labels. These requests are made directly from your browser to Google's API using your own API key. The developer has no access to these requests or their contents. This feature is **opt-in** and disabled by default.

Google's handling of data sent to their API is governed by [Google's Privacy Policy](https://policies.google.com/privacy) and the [Gemini API Terms of Service](https://ai.google.dev/terms).

---

## Data Storage

All data collected by the Extension is stored in your browser's **IndexedDB** using the Dexie.js library. This includes:

- Conversation node data (prompts, responses, labels, positions, drift scores)
- Conversation metadata (URL, title, timestamps)
- Application settings (drift threshold, summary mode, API key)
- Text embeddings

This data is stored locally on your device and is not synced to any cloud service by the Extension. It can be cleared at any time by:

- Clicking "New Tree" in the Extension popup (clears nodes for the current conversation)
- Clearing your browser's site data for the relevant domain in Chrome settings

---

## Data NOT Collected

Branch Barber does **not** collect:

- Browsing history beyond the three supported domains (chatgpt.com, chat.openai.com, gemini.google.com)
- Personal identification information
- Authentication credentials or session tokens
- Usage analytics or telemetry
- Crash reports or error logs sent to external servers

---

## Third-Party Services

The Extension interacts with one optional third-party service:

| Service | Purpose | When used | Governed by |
|---------|---------|-----------|-------------|
| Google Gemini API | Generate 8-word node labels | Only when you provide an API key and enable AI mode | [Google Privacy Policy](https://policies.google.com/privacy) |

No other third-party services, trackers, or analytics tools are used.

---

## Children's Privacy

This Extension is not directed at children under the age of 13. We do not knowingly collect data from children.

---

## Changes to This Policy

If this Privacy Policy is updated, the "Last updated" date at the top will be revised. Continued use of the Extension after changes constitutes acceptance of the updated policy.

---

## Contact

If you have questions about this Privacy Policy, please contact:

**Yiwen Ding**
- Email: [dingywn@seas.upenn.edu](mailto:dingywn@seas.upenn.edu)
- GitHub: [github.com/dingonewen](https://github.com/dingonewen)
