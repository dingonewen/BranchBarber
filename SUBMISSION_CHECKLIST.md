# Chrome Web Store Submission Checklist — Branch Barber

Complete every item before submitting. Items marked ⚠️ are the most commonly missed.

---

## 1. Developer Account

- [ ] Create a Google account dedicated to extension publishing (or use existing)
- [ ] Pay the one-time **$5 USD developer registration fee** at [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
- [ ] Verify your email address

---

## 2. Build a Clean Package

- [ ] Run `npm run build` — confirm output is in `dist/`
- [ ] Confirm no build errors (3 size warnings are acceptable)
- [ ] Zip the **contents** of `dist/` (not the folder itself):
  ```
  cd dist
  zip -r ../branch-barber-1.0.0.zip .
  ```
  On Windows: select all files inside `dist/`, right-click → Send to → Compressed folder
- [ ] Verify zip size is under 128 MB (it will be far smaller)

---

## 3. Required Assets

### Icons (already in the project)
- [ ] `icons/icon16.png` — 16×16 px
- [ ] `icons/icon48.png` — 48×48 px
- [ ] `icons/icon128.png` — 128×128 px

### Store Graphics (need to prepare)
- [ ] **Store icon** — 128×128 px PNG, no rounded corners (Chrome adds them). Use `public/icons/icon128.png` directly or create a cleaner version.
- [ ] **At least 1 screenshot** — exactly **1280×800 px** or **640×400 px** PNG or JPG.
  - `public/screenshot4.jpg` — resize/crop to exactly 1280×800 px using any image editor
  - The screenshot should clearly show the sidebar tree open on a ChatGPT or Gemini page
- [ ] *(Optional)* Small promo tile — 440×280 px PNG
- [ ] *(Optional)* Large promo tile — 920×680 px PNG

⚠️ **Screenshots must be exact dimensions** — the store rejects images that are even 1 px off.

---

## 4. Privacy Policy

- [ ] Push your repo to GitHub (if not already): `github.com/dingonewen/BranchBarber`
- [ ] Enable GitHub Pages: repo Settings → Pages → Source: main branch → `/root`
- [ ] Confirm `PRIVACY_POLICY.md` is accessible at a public URL
- [ ] ⚠️ **The store requires a live URL** — test the URL opens in an incognito window before submitting

Suggested URL: `https://dingonewen.github.io/BranchBarber/PRIVACY_POLICY`

---

## 5. manifest.json Review

- [ ] `"name": "Branch Barber"` ✓
- [ ] `"version": "1.0.0"` ✓
- [ ] `"description"` is under 132 characters ✓
- [ ] All icons listed in `"icons"` exist in the zip ✓
- [ ] `"default_popup"` exists (`popup.html`) ✓
- [ ] No `eval()` or remote script loading ✓
- [ ] ⚠️ `content_security_policy` uses `'wasm-unsafe-eval'` — this is **allowed** for extension pages (not content scripts) but you may need to justify it in the review notes

---

## 6. Store Listing Fields

Fill these in the Developer Dashboard (use `STORE_LISTING.md` for the text):

- [ ] **Name:** Branch Barber
- [ ] **Short description** (≤132 chars) — copy from `STORE_LISTING.md`
- [ ] **Detailed description** — copy from `STORE_LISTING.md`
- [ ] **Category:** Productivity
- [ ] **Language:** English
- [ ] **Store icon** uploaded (128×128 px)
- [ ] **At least 1 screenshot** uploaded (1280×800 px)
- [ ] **Privacy policy URL** — your hosted URL
- [ ] ⚠️ **Single purpose description** — copy from `STORE_LISTING.md`

---

## 7. Permissions Justification

⚠️ This is where most rejections happen. In the Developer Dashboard under "Permissions", justify each permission:

- [ ] `storage` — justified (see `STORE_LISTING.md`)
- [ ] `activeTab` — justified
- [ ] `scripting` — justified
- [ ] `alarms` — justified
- [ ] `offscreen` — justified

For `host_permissions` (`chatgpt.com`, `chat.openai.com`, `gemini.google.com`):
- [ ] Explain that the extension only activates on these three domains and reads DOM content solely to extract conversation turns for the local tree

---

## 8. Remote Code Declaration

- [ ] In the Dashboard, confirm you are **not** using remote code
- [ ] Note in submission: "All JS is bundled with Webpack. Model files are bundled locally. The only external call is an optional user-initiated Gemini API call using the user's own key."

---

## 9. Content Review Notes (optional but recommended)

When submitting, add a note to the reviewer in the "Notes for reviewer" field:

```
Branch Barber is a productivity extension that visualizes AI conversation 
history as a tree graph. It only activates on chatgpt.com, chat.openai.com, 
and gemini.google.com.

The extension uses 'wasm-unsafe-eval' in the extension_pages CSP to run an 
on-device sentence embedding model (all-MiniLM-L6-v2) via Transformers.js 
and ONNX Runtime WebAssembly. All model files are bundled locally in the 
extension — no remote code is loaded.

The only external network call is an optional call to the Google Gemini API 
(generativelanguage.googleapis.com) for generating 8-word node labels. This 
feature is disabled by default and only activates when the user provides their 
own API key in Settings.

No conversation data is sent to the developer's servers. All data is stored 
locally in IndexedDB.

Test account is not required — the extension works on any ChatGPT or Gemini 
conversation.
```

---

## 10. Final Pre-Submit Checks

- [ ] Install the zipped extension fresh in a clean Chrome profile (no dev mode) and verify it works
- [ ] Verify the popup opens correctly
- [ ] Open ChatGPT or Gemini, send a message, confirm a node appears in the tree
- [ ] Verify the "✂ Branch Here" button appears under AI responses
- [ ] Open Settings, save, confirm no errors
- [ ] Test "New Tree" from the popup
- [ ] ⚠️ Check that the privacy policy URL loads in a browser (incognito)

---

## 11. After Submission

- Initial review typically takes **1–3 business days** for new extensions
- If rejected, the rejection email will specify exactly what to fix — common reasons:
  - Missing or invalid privacy policy URL
  - Screenshot wrong dimensions
  - Permissions not justified
  - `wasm-unsafe-eval` flagged (add it to reviewer notes)
- You can resubmit immediately after fixing

---

## Useful Links

- Developer Dashboard: [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
- Program policies: [developer.chrome.com/docs/webstore/program-policies](https://developer.chrome.com/docs/webstore/program-policies)
- Review process: [developer.chrome.com/docs/webstore/review-process](https://developer.chrome.com/docs/webstore/review-process)
- Permission guidelines: [developer.chrome.com/docs/extensions/mv3/permission_warnings](https://developer.chrome.com/docs/extensions/mv3/permission_warnings)
