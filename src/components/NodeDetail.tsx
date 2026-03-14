import { useBranchStore } from "../store";
import { db } from "../db";

export function NodeDetail() {
  const selectedNodeId = useBranchStore((s) => s.selectedNodeId);
  const nodes = useBranchStore((s) => s.nodes);
  const markAsBranch = useBranchStore((s) => s.markAsBranch);
  const selectNode = useBranchStore((s) => s.selectNode);

  if (!selectedNodeId) return null;
  const node = nodes[selectedNodeId];
  if (!node) return null;

  const handleMarkBranch = () => {
    markAsBranch(selectedNodeId);
    db.nodes.update(selectedNodeId, { isBranch: true });
  };

  const handleScrollTo = () => {
    // Post message to content script to scroll to this DOM index
    window.postMessage(
      { type: "BRANCHBARBER_SCROLL_TO", domIndex: node.domIndex },
      "*"
    );
  };

  const handleReset = () => {
    window.postMessage(
      { type: "BRANCHBARBER_RESET_TO", domIndex: node.domIndex },
      "*"
    );
  };

  const statusColors: Record<string, string> = {
    root: "text-purple-400",
    branch: "text-blue-400",
    "side-quest": "text-amber-400",
    normal: "text-zinc-400",
  };

  return (
    <div className="flex flex-col gap-3 p-3 bg-zinc-900 rounded-xl border border-zinc-700">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wide ${statusColors[node.status] ?? "text-zinc-400"}`}>
          {node.status === "root"
            ? "Root Node"
            : node.status === "branch"
            ? "Branch Point"
            : node.status === "side-quest"
            ? "Side Quest"
            : `Turn ${node.domIndex + 1}`}
        </span>
        <button
          onClick={() => selectNode(null)}
          className="text-zinc-500 hover:text-zinc-300 text-xs p-0.5"
        >
          ✕
        </button>
      </div>

      {/* Summary */}
      <div>
        <p className="text-xs font-medium text-white/90">{node.summary || node.label}</p>
      </div>

      {/* Drift indicator */}
      {node.driftScore > 0 && node.status !== "root" && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-500">Context Drift</span>
            <span className={`text-[10px] font-semibold ${
              node.driftScore > 0.6 ? "text-red-400" : node.driftScore > 0.3 ? "text-amber-400" : "text-emerald-400"
            }`}>
              {Math.round(node.driftScore * 100)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-700 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                node.driftScore > 0.6 ? "bg-red-500" : node.driftScore > 0.3 ? "bg-amber-400" : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(node.driftScore * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Prompt preview */}
      <div className="bg-zinc-800 rounded-lg p-2">
        <p className="text-[10px] text-zinc-500 mb-1">Prompt</p>
        <p className="text-xs text-zinc-300 line-clamp-3">{node.prompt}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleScrollTo}
          className="flex-1 text-xs py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
        >
          👁 View
        </button>
        <button
          onClick={handleReset}
          className="flex-1 text-xs py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
        >
          ↩ Reset Here
        </button>
        {node.status === "normal" && (
          <button
            onClick={handleMarkBranch}
            className="flex-1 text-xs py-1.5 px-2 rounded-lg bg-purple-900/50 hover:bg-purple-900/80 text-purple-300 border border-purple-700 transition-colors"
          >
            ✂ Branch
          </button>
        )}
      </div>
    </div>
  );
}