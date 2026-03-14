import { useBranchStore } from "../store";

export function DriftAlert() {
  const driftAlert = useBranchStore((s) => s.driftAlert);
  const setDriftAlert = useBranchStore((s) => s.setDriftAlert);
  const markAsBranch = useBranchStore((s) => s.markAsBranch);
  const selectNode = useBranchStore((s) => s.selectNode);

  if (!driftAlert) return null;

  const handleDismiss = () => setDriftAlert(null);
  const handleBranch = () => {
    markAsBranch(driftAlert.nodeId);
    selectNode(driftAlert.nodeId);
    setDriftAlert(null);
  };

  return (
    <div className="mx-3 mb-3 p-3 bg-amber-950/70 border border-amber-500/50 rounded-xl text-xs">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-amber-400 text-sm">⚠️</span>
        <span className="font-semibold text-amber-300">Side Quest Detected</span>
      </div>
      <p className="text-amber-200/80 mb-2">
        This turn drifted{" "}
        <span className="font-semibold text-amber-300">
          {Math.round(driftAlert.score * 100)}%
        </span>{" "}
        from your root goal. Consider branching.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleBranch}
          className="flex-1 py-1 px-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors"
        >
          Mark Branch
        </button>
        <button
          onClick={handleDismiss}
          className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
        >
          Ignore
        </button>
      </div>
    </div>
  );
}