import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { TreeNode } from "../store";

const STATUS_STYLES: Record<string, { bg: string; border: string; badge: string }> = {
  root: {
    bg: "bg-purple-950/80",
    border: "border-purple-500",
    badge: "bg-purple-600 text-white",
  },
  branch: {
    bg: "bg-blue-950/80",
    border: "border-blue-400",
    badge: "bg-blue-500 text-white",
  },
  "side-quest": {
    bg: "bg-amber-950/80",
    border: "border-amber-400",
    badge: "bg-amber-500 text-black",
  },
  normal: {
    bg: "bg-zinc-900/90",
    border: "border-zinc-600",
    badge: "bg-zinc-600 text-white",
  },
};

const STATUS_LABELS: Record<string, string> = {
  root: "Root",
  branch: "Branch",
  "side-quest": "Side Quest",
  normal: "",
};

export const TreeNodeComponent = memo(
  ({ data, selected }: NodeProps<TreeNode>) => {
    const styles = STATUS_STYLES[data.status] ?? STATUS_STYLES.normal;
    const label = STATUS_LABELS[data.status];

    return (
      <div
        className={`
          relative w-48 rounded-xl border-2 p-3 text-xs shadow-lg cursor-pointer select-none
          transition-all duration-150
          ${styles.bg} ${styles.border}
          ${selected ? "ring-2 ring-white/50 scale-105" : "hover:scale-102"}
        `}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-zinc-400 !border-0 !w-2 !h-2"
        />

        {label && (
          <span
            className={`absolute -top-2.5 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${styles.badge}`}
          >
            {label}
          </span>
        )}

        {data.status === "side-quest" && (
          <div className="absolute -top-1 -right-1 text-amber-400 text-sm" title="Potential context drift">
            ⚠
          </div>
        )}

        <div className="font-semibold text-white/90 leading-tight mb-1 line-clamp-2">
          {data.summary || data.label}
        </div>

        {data.driftScore > 0 && data.status !== "root" && (
          <div className="flex items-center gap-1 mt-1.5">
            <div className="flex-1 h-1 rounded-full bg-zinc-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  data.driftScore > 0.6
                    ? "bg-red-500"
                    : data.driftScore > 0.3
                    ? "bg-amber-400"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(data.driftScore * 100, 100)}%` }}
              />
            </div>
            <span className="text-[9px] text-zinc-400 w-7 text-right">
              {Math.round(data.driftScore * 100)}%
            </span>
          </div>
        )}

        <Handle
          type="source"
          position={Position.Right}
          className="!bg-zinc-400 !border-0 !w-2 !h-2"
        />
      </div>
    );
  }
);

TreeNodeComponent.displayName = "TreeNodeComponent";