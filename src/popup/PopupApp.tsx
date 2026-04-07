import { useEffect, useState } from "react";

type Status = "idle" | "active" | "loading";

const SUPPORTED_HOSTS = ["chatgpt.com", "chat.openai.com", "gemini.google.com"];

function safeGetURL(path: string): string {
  try { return chrome.runtime.getURL(path); } catch { return ""; }
}

const S = {
  wrap:    { width: 288, background: "#eff1f5", color: "#4c4f69", padding: 16, display: "flex", flexDirection: "column" as const, gap: 12, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  header:  { display: "flex", alignItems: "center", gap: 10 },
  title:   { fontWeight: 700, fontSize: 14, color: "#4c4f69", letterSpacing: "-0.01em" },
  sub:     { fontSize: 10, color: "#8c8fa1", marginTop: 1 },
  status:  { display: "flex", alignItems: "center", gap: 8, background: "#e6e9ef", borderRadius: 8, padding: "7px 10px" },
  dot:     (color: string): React.CSSProperties => ({ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }),
  statusTxt: { fontSize: 11, color: "#6c6f85" } as React.CSSProperties,
  hint:    { fontSize: 11, color: "#8c8fa1", lineHeight: 1.5 } as React.CSSProperties,
  row:     { display: "flex", alignItems: "flex-start", gap: 6 } as React.CSSProperties,
  btn:     (bg: string, disabled = false): React.CSSProperties => ({
    flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
    cursor: disabled ? "default" : "pointer",
    background: disabled ? "#bcc0cc" : bg,
    color: "#fff", fontWeight: 700, fontSize: 12,
  }),
  footer:  { fontSize: 10, color: "#acb0be", textAlign: "center" as const },
};

// Always consume lastError so Chrome never logs "Unchecked runtime.lastError"
function send(tabId: number, msg: object, cb?: (r: unknown) => void): void {
  chrome.tabs.sendMessage(tabId, msg, (response) => {
    void chrome.runtime.lastError; // read to suppress the error
    cb?.(response);
  });
}

export function PopupApp() {
  const [status, setStatus]   = useState<Status>("loading");
  const [tabUrl, setTabUrl]   = useState("");
  const [tabId, setTabId]     = useState<number | null>(null);
  const [busy, setBusy]       = useState(false);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? "";
      const id  = tabs[0]?.id ?? null;
      setTabUrl(url);
      setTabId(id);

      const supported = SUPPORTED_HOSTS.some((h) => url.includes(h));
      if (!supported || id == null) { setStatus("idle"); return; }

      send(id, { type: "GET_STATUS" }, (resp) => {
        setStatus(resp ? "active" : "idle");
      });
    });
  }, []);

  const isSupported = SUPPORTED_HOSTS.some((h) => tabUrl.includes(h));
  const canAct      = isSupported && tabId != null;

  const openSaved = () => {
    if (!canAct) return;
    send(tabId!, { type: "SHOW_SIDEBAR" });
  };

  const openNew = () => {
    if (!canAct || busy) return;
    setBusy(true);
    send(tabId!, { type: "RESET_TREE" }, () => {
      setBusy(false);
    });
  };

  const dotColor =
    status === "active"  ? "#40a02b" :
    status === "loading" ? "#df8e1d" : "#acb0be";

  const statusText =
    status === "active"  ? "Active on this page" :
    status === "loading" ? "Checking..." :
    isSupported          ? "Not yet active" :
    "Navigate to ChatGPT or Gemini";

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <img src={safeGetURL("icons/icon48.png")} style={{ width: 28, height: 28, objectFit: "contain" }} />
        <div>
          <div style={S.title}>Branch Barber</div>
          <div style={S.sub}>Conversation Tree</div>
        </div>
      </div>

      <div style={S.status}>
        <div style={S.dot(dotColor)} />
        <span style={S.statusTxt}>{statusText}</span>
      </div>

      {!isSupported ? (
        <div style={S.hint}>Works on: {SUPPORTED_HOSTS.join(", ")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {([
            ["✂", "#8839ef", 'Click "Branch" on a node to send it to the right'],
            ["⚠", "#fe640b", "Orange nodes = auto-detected topic drift"],
            ["⛓", "#8c8fa1", "Detach splices a node out without losing children"],
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
            <button style={S.btn("#8839ef")} onClick={openSaved}>
              Open Tree
            </button>
            <button style={S.btn("#1e66f5", busy)} onClick={openNew} disabled={busy}>
              {busy ? "Starting..." : "New Tree"}
            </button>
          </div>
          <div style={{ fontSize: 10, color: "#8c8fa1", textAlign: "center" }}>
            "New Tree" clears all saved nodes for this page
          </div>
        </div>
      )}

      <div style={S.footer}>v1.0.0 · Local-first · No telemetry</div>
    </div>
  );
}
