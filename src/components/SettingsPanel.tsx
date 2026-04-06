import { useState, useEffect } from "react";
import { useBranchStore } from "../store";
import { saveSettings, getOrCreateSettings } from "../db";
import { C } from "./theme";

export function SettingsPanel() {
  // Use separate selectors — inline object selector causes #185 (new object every render)
  const geminiApiKey      = useBranchStore((s) => s.geminiApiKey);
  const driftThreshold    = useBranchStore((s) => s.driftThreshold);
  const autoDetectBranches = useBranchStore((s) => s.autoDetectBranches);
  const setSettings       = useBranchStore((s) => s.setSettings);

  const [apiKey, setApiKey]         = useState(geminiApiKey);
  const [threshold, setThreshold]   = useState(driftThreshold);
  const [autoDetect, setAutoDetect] = useState(autoDetectBranches);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState("");

  useEffect(() => {
    getOrCreateSettings()
      .then((s) => {
        setApiKey(s.geminiApiKey);
        setThreshold(s.driftThreshold);
        setAutoDetect(s.autoDetectBranches);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const handleSave = async () => {
    try {
      const updates = { geminiApiKey: apiKey, driftThreshold: threshold, autoDetectBranches: autoDetect };
      await saveSettings(updates);
      setSettings(updates);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e));
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: C.base,
    border: `1px solid ${C.surface1}`,
    borderRadius: 6, padding: "6px 10px",
    fontSize: 11, color: C.text, outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 20, color: C.text }}>

      {error && (
        <div style={{ padding: 8, background: "#ffecee", border: `1px solid ${C.red}`, borderRadius: 6, fontSize: 11, color: C.red }}>
          {error}
        </div>
      )}

      {/* Gemini API */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.overlay1, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          Gemini API
        </div>
        <label style={{ display: "block", fontSize: 11, color: C.subtext0, marginBottom: 4 }}>
          API Key (optional — for branch summaries)
        </label>
        <input
          type="password" value={apiKey} placeholder="AIza..."
          onChange={(e) => setApiKey(e.target.value)}
          style={inputStyle}
        />
        <div style={{ fontSize: 10, color: C.overlay1, marginTop: 4 }}>
          Never leaves your browser.
        </div>
      </div>

      {/* Drift Detection */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.overlay1, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          Drift Detection
        </div>

        <div
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer" }}
          onMouseDown={(e) => { e.stopPropagation(); setAutoDetect((v) => !v); }}
        >
          <div style={{
            width: 32, height: 18, borderRadius: 9, position: "relative",
            background: autoDetect ? C.mauve : C.surface1, transition: "background 0.2s", flexShrink: 0,
          }}>
            <div style={{
              position: "absolute", top: 3, width: 12, height: 12,
              borderRadius: "50%", background: "#fff",
              transition: "left 0.2s", left: autoDetect ? 17 : 3,
            }} />
          </div>
          <span style={{ fontSize: 11, color: C.text }}>Auto-detect side quests</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: C.subtext0 }}>Drift Threshold</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.mauve }}>{Math.round(threshold * 100)}%</span>
        </div>
        <input
          type="range" min="0.3" max="0.9" step="0.05" value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: C.mauve }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.overlay1, marginTop: 2 }}>
          <span>Sensitive</span><span>Relaxed</span>
        </div>
      </div>

      <button
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleSave(); }}
        style={{
          padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
          fontWeight: 700, fontSize: 12,
          background: saved ? C.green : C.mauve,
          color: "#fff", transition: "background 0.2s",
        }}
      >
        {saved ? "✓ Saved" : "Save Settings"}
      </button>

      <div style={{ textAlign: "center", fontSize: 10, color: C.overlay1 }}>
        BranchBarber v1.0.0 · Local-first · No telemetry
      </div>
    </div>
  );
}
