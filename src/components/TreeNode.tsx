import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { TreeNode } from "../store";
import { C, branchColor, branchBg } from "./theme";

export const TreeNodeComponent = memo(({ data, selected }: NodeProps<TreeNode>) => {
  const isGhost    = data.status === "ghost";
  const isRoot     = data.status === "root";
  const isIsolated = data.status === "normal" && data.parentId === null && !isRoot;

  const accent = isGhost ? C.surface1
               : isRoot  ? C.mauve
               :           branchColor(data.position.x);

  const bg = isGhost ? C.mantle : branchBg(data.position.x);

  const borderColor = selected ? C.mauve : accent;
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
      color: isGhost ? C.overlay1 : C.text,
      opacity: isGhost ? 0.65 : isIsolated ? 0.55 : 1,
      boxShadow: selected
        ? `0 0 0 3px ${accent}33, 0 4px 12px rgba(0,0,0,0.1)`
        : "0 2px 6px rgba(0,0,0,0.07)",
      transition: "border-color 0.15s, box-shadow 0.15s",
    }}>
      <Handle type="target" position={Position.Left}
        style={{ background: C.surface2, border: "none", width: 8, height: 8 }} />

      {badgeLabel && (
        <span style={{
          position: "absolute", top: -10, left: 8,
          padding: "1px 6px", borderRadius: 4,
          background: isIsolated ? C.surface2 : accent,
          color: "#fff",
          fontSize: 9, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {badgeLabel}
        </span>
      )}

      {isGhost ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.overlay1, fontSize: 11 }}>
          <span style={{ fontSize: 14 }}>⋯</span>
          <span style={{ fontStyle: "italic" }}>{data.label}</span>
        </div>
      ) : (
        <>
          <div style={{
            fontWeight: 600, color: C.text, lineHeight: 1.3, marginBottom: 4,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
          }}>
            {data.summary || data.label}
          </div>

          {data.driftScore > 0 && data.status !== "root" && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: C.surface1, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${Math.min(data.driftScore * 100, 100)}%`,
                  background: data.driftScore > 0.6 ? C.red : data.driftScore > 0.3 ? C.yellow : C.green,
                }} />
              </div>
              <span style={{ fontSize: 9, color: C.overlay1, width: 26, textAlign: "right" }}>
                {Math.round(data.driftScore * 100)}%
              </span>
            </div>
          )}
        </>
      )}

      <Handle type="source" position={Position.Right}
        style={{ background: C.surface2, border: "none", width: 8, height: 8 }} />
    </div>
  );
});

TreeNodeComponent.displayName = "TreeNodeComponent";
