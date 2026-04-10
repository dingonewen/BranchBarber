import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { TreeNode } from "../store";
import { useBranchStore } from "../store";
import { tc, branchColor, branchBg } from "./theme";

export const TreeNodeComponent = memo(({ data, selected }: NodeProps<TreeNode>) => {
  const dark = useBranchStore((s) => s.darkMode);
  const P    = tc(dark);

  const isGhost    = data.status === "ghost";
  const isRoot     = data.status === "root";
  const isIsolated = data.status === "normal" && data.parentId === null && !isRoot;

  const accent = isGhost ? P.surface1
               : isRoot  ? P.mauve
               :           branchColor(data.position.x, dark);

  const bg = isGhost ? P.mantle : branchBg(data.position.x, dark);

  const borderColor = selected ? P.mauve : accent;
  const borderStyle = isGhost ? "1.5px dashed" : "2px solid";

  const badgeLabel =
    isRoot                         ? "Root"
    : data.status === "side-quest" ? "Branch"
    : isIsolated                   ? "Isolated"
    : null;

  return (
    <div style={{
      position: "relative",
      width: 180,
      background: bg,
      border: `${borderStyle} ${borderColor}`,
      borderRadius: 10,
      padding: "8px 10px",
      fontSize: 11,
      cursor: isGhost ? "default" : "pointer",
      color: isGhost ? P.overlay1 : P.text,
      opacity: isGhost ? 0.65 : isIsolated ? 0.55 : 1,
      boxShadow: selected
        ? `0 0 0 3px ${accent}33, 0 4px 12px rgba(0,0,0,0.15)`
        : `0 2px 6px rgba(0,0,0,${dark ? "0.3" : "0.07"})`,
      transition: "border-color 0.15s, box-shadow 0.15s",
    }}>
      <Handle type="target" position={Position.Left}
        style={{ background: P.surface2, border: "none", width: 8, height: 8 }} />

      {badgeLabel && (
        <span style={{
          position: "absolute", top: -10, left: 8,
          padding: "1px 6px", borderRadius: 4,
          background: isIsolated ? P.surface2 : accent,
          color: dark ? P.crust : "#fff",
          fontSize: 9, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {badgeLabel}
        </span>
      )}

      {isGhost ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: P.overlay1, fontSize: 11 }}>
          <span style={{ fontSize: 14 }}>⋯</span>
          <span style={{ fontStyle: "italic" }}>{data.label}</span>
        </div>
      ) : (
        <>
          <div style={{
            fontWeight: 600, color: P.text, lineHeight: 1.3, marginBottom: 4,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
          }}>
            {data.summary || data.label}
          </div>

          {data.driftScore > 0 && data.status !== "root" && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: P.surface1, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${Math.min(data.driftScore * 100, 100)}%`,
                  background: data.driftScore > 0.6 ? P.red : data.driftScore > 0.3 ? P.yellow : P.green,
                }} />
              </div>
              <span style={{ fontSize: 9, color: P.overlay1, width: 26, textAlign: "right" }}>
                {Math.round(data.driftScore * 100)}%
              </span>
            </div>
          )}
        </>
      )}

      <Handle type="source" position={Position.Right}
        style={{ background: P.surface2, border: "none", width: 8, height: 8 }} />
    </div>
  );
});

TreeNodeComponent.displayName = "TreeNodeComponent";
