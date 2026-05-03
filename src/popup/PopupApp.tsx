import { useEffect, useState } from "react";
import { C, CM } from "../components/theme";

type Status = "idle" | "active" | "loading";

const SUPPORTED_HOSTS = ["chatgpt.com", "chat.openai.com", "gemini.google.com", "claude.ai"];

function safeGetURL(path: string): string {
  try { return chrome.runtime.getURL(path); } catch { return ""; }
}

// Always consume lastError so Chrome never logs "Unchecked runtime.lastError"
function send(tabId: number, msg: object, cb?: (r: unknown) => void): void {
  chrome.tabs.sendMessage(tabId, msg, (response) => {
    void chrome.runtime.lastError;
    cb?.(response);
  });
}

export function PopupApp() {
  const [status, setStatus] = useState<Status>("loading");
  const [tabUrl, setTabUrl] = useState("");
  const [tabId, setTabId]   = useState<number | null>(null);
  const [busy, setBusy]     = useState(false);

  // Dark mode: localStorage for instant rendering, synced from/to content script
  const [dark, setDark] = useState<boolean>(
    () => localStorage.getItem("bb-dark-mode") === "true"
  );

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? "";
      const id  = tabs[0]?.id ?? null;
      setTabUrl(url);
      setTabId(id);

      const supported = SUPPORTED_HOSTS.some((h) => url.includes(h));
      if (!supported || id == null) { setStatus("idle"); return; }

      send(id, { type: "GET_STATUS" }, (resp: unknown) => {
        const r = resp as { status: string; darkMode?: boolean } | null;
        setStatus(r ? "active" : "idle");
        // Sync dark mode from content script (source of truth)
        if (r && typeof r.darkMode === "boolean") {
          setDark(r.darkMode);
          localStorage.setItem("bb-dark-mode", String(r.darkMode));
        }
      });
    });
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("bb-dark-mode", String(next));
    if (tabId != null) {
      send(tabId, { type: "SET_DARK_MODE", dark: next });
    }
  };

  const isSupported = SUPPORTED_HOSTS.some((h) => tabUrl.includes(h));
  const canAct      = isSupported && tabId != null;

  const openSaved = () => { if (!canAct) return; send(tabId!, { type: "SHOW_SIDEBAR" }); };
  const openNew   = () => {
    if (!canAct || busy) return;
    setBusy(true);
    send(tabId!, { type: "RESET_TREE" }, () => setBusy(false));
  };

  const dotColor =
    status === "active"  ? (dark ? CM.green  : C.green) :
    status === "loading" ? (dark ? CM.yellow : C.yellow) :
                           (dark ? CM.overlay0 : C.surface2);

  const statusText =
    status === "active"  ? "Active on this page" :
    status === "loading" ? "Checking..." :
    isSupported          ? "Not yet active" :
    "Navigate to ChatGPT, Gemini, or Claude";

  const P = dark ? CM : C;

  const S = {
    wrap:      { width: 288, background: P.base, color: P.text, padding: 16, display: "flex", flexDirection: "column" as const, gap: 12, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
    header:    { display: "flex", alignItems: "center", gap: 10 },
    headerRight: { marginLeft: "auto", display: "flex", alignItems: "center" } as React.CSSProperties,
    title:     { fontWeight: 700, fontSize: 14, color: P.text, letterSpacing: "-0.01em" } as React.CSSProperties,
    sub:       { fontSize: 10, color: P.overlay1, marginTop: 1 } as React.CSSProperties,
    status:    { display: "flex", alignItems: "center", gap: 8, background: P.mantle, borderRadius: 8, padding: "7px 10px" } as React.CSSProperties,
    statusTxt: { fontSize: 11, color: P.subtext0 } as React.CSSProperties,
    hint:      { fontSize: 11, color: P.overlay1, lineHeight: 1.5 } as React.CSSProperties,
    row:       { display: "flex", alignItems: "flex-start", gap: 6 } as React.CSSProperties,
    footer:    { fontSize: 10, color: P.overlay0, textAlign: "center" as const },
  };

  const btnStyle = (bg: string, disabled = false): React.CSSProperties => ({
    flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
    cursor: disabled ? "default" : "pointer",
    background: disabled ? P.surface1 : bg,
    color: dark ? P.crust : "#fff",
    fontWeight: 700, fontSize: 12,
  });

  const themeBtn: React.CSSProperties = {
    background: "none", border: `1px solid ${P.surface1}`,
    borderRadius: 6, cursor: "pointer",
    color: P.subtext0, fontSize: 14,
    width: 28, height: 28,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    transition: "background 0.15s",
  };

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <img src={safeGetURL("icons/icon48.png")} style={{ width: 28, height: 28, objectFit: "contain" }} />
        <div>
          <div style={S.title}>Branch Barber</div>
          <div style={S.sub}>Conversation Tree</div>
        </div>
        <div style={S.headerRight}>
          <button style={themeBtn} onClick={toggleDark} title={dark ? "Switch to Light mode" : "Switch to Dark mode"}>
            {dark ? "☀" : "☾"}
          </button>
        </div>
      </div>

      <div style={S.status}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        <span style={S.statusTxt}>{statusText}</span>
      </div>

      {!isSupported ? (
        <div style={S.hint}>Works on: {SUPPORTED_HOSTS.join(", ")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {([
            ["✂", P.mauve, 'Click "Branch" on a node to send it to the right'],
            ["⛓", P.overlay1, "Detach splices a node out without losing children"],
          ] as [string, string, string][]).map(([icon, color, text]) => (
            <div key={text} style={S.row}>
              <span style={{ fontSize: 12, color, marginTop: 1 }}>{icon}</span>
              <span style={S.hint}>{text}</span>
            </div>
          ))}
        </div>
      )}

      {canAct && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnStyle(P.mauve)} onClick={openSaved}>Open Tree</button>
            <button style={btnStyle(P.blue, busy)} onClick={openNew} disabled={busy}>
              {busy ? "Starting..." : "New Tree"}
            </button>
          </div>
          <div style={{ fontSize: 10, color: P.overlay1, textAlign: "center" }}>
            "New Tree" clears all saved nodes for this page
          </div>
        </div>
      )}

      <div style={S.footer}>v1.0.0 · Local-first · No telemetry</div>
    </div>
  );
}
