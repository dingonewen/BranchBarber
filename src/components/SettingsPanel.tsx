import { useState, useEffect } from "react";
import { useBranchStore } from "../store";
import { saveSettings, getOrCreateSettings } from "../db";

export function SettingsPanel() {
  const { geminiApiKey, driftThreshold, autoDetectBranches, setSettings } =
    useBranchStore((s) => ({
      geminiApiKey: s.geminiApiKey,
      driftThreshold: s.driftThreshold,
      autoDetectBranches: s.autoDetectBranches,
      setSettings: s.setSettings,
    }));

  const [apiKey, setApiKey] = useState(geminiApiKey);
  const [threshold, setThreshold] = useState(driftThreshold);
  const [autoDetect, setAutoDetect] = useState(autoDetectBranches);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getOrCreateSettings().then((s) => {
      setApiKey(s.geminiApiKey);
      setThreshold(s.driftThreshold);
      setAutoDetect(s.autoDetectBranches);
    });
  }, []);

  const handleSave = async () => {
    const updates = {
      geminiApiKey: apiKey,
      driftThreshold: threshold,
      autoDetectBranches: autoDetect,
    };
    await saveSettings(updates);
    setSettings(updates);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 p-3 overflow-y-auto">
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
          Gemini API
        </h3>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">
            API Key (for branch summaries)
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza..."
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors"
          />
          <p className="text-[10px] text-zinc-600 mt-1">
            Optional. Uses local fallback if empty. Never leaves your browser.
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
          Drift Detection
        </h3>

        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <div
            onClick={() => setAutoDetect((v) => !v)}
            className={`relative w-8 h-4 rounded-full transition-colors ${
              autoDetect ? "bg-purple-600" : "bg-zinc-600"
            }`}
          >
            <div
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                autoDetect ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </div>
          <span className="text-xs text-zinc-300">Auto-detect side quests</span>
        </label>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-zinc-400">Drift Threshold</label>
            <span className="text-xs font-semibold text-purple-400">
              {Math.round(threshold * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.3"
            max="0.9"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
            <span>Sensitive</span>
            <span>Relaxed</span>
          </div>
          <p className="text-[10px] text-zinc-600 mt-1">
            Flag conversations that drift more than this from the root goal.
          </p>
        </div>
      </div>

      <button
        onClick={handleSave}
        className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${
          saved
            ? "bg-emerald-700 text-emerald-200"
            : "bg-purple-700 hover:bg-purple-600 text-white"
        }`}
      >
        {saved ? "✓ Saved" : "Save Settings"}
      </button>

      <div className="text-[10px] text-zinc-700 text-center">
        BranchBarber v1.0.0 · Local-first · No telemetry
      </div>
    </div>
  );
}