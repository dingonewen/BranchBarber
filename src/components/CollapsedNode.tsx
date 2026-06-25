import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { useBranchStore } from "../store";
import { tc, branchColor } from "./theme";

export interface CollapsedGroupData {
  anchorId: string;
  count: number;
  firstLabel: string;
  lastLabel: string;
  posX: number;
}

export const CollapsedNodeComponent = memo(({ data, selected }: NodeProps<CollapsedGroupData>) => {
  const dark          = useBranchStore((s) => s.darkMode);
  const toggleCollapse = useBranchStore((s) => s.toggleCollapse);
  const P             = tc(dark);
  const accent        = branchColor(data.posX, dark);

  return (
    <div
      onClick={() => toggleCollapse(data.anchorId)}
      style={{
        width: 180,
        background: dark ? P.mantle : "#f5f5fa",
        border: `1.5px dashed ${selected ? P.mauve : accent}`,
        borderRadius: 10,
        padding: "8px 10px",
        fontSize: 11,
        cursor: "pointer",
        color: P.subtext1,
        boxShadow: `0 2px 6px rgba(0,0,0,${dark ? "0.3" : "0.07"})`,
        transition: "border-color 0.15s",
        userSelect: "none" as const,
      }}
    >
      <Handle type="target" position={Position.Left}
        style={{ background: P.surface2, border: "none", width: 8, height: 8 }} />

      <div style={{ fontWeight: 700, color: accent, marginBottom: 4, fontSize: 12 }}>
        ▶ {data.count} turns
      </div>
      <div style={{
        color: P.overlay1, fontSize: 10, lineHeight: 1.4,
        overflow: "hidden", display: "-webkit-box",
        WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
      }}>
        {data.firstLabel} … {data.lastLabel}
      </div>

      <Handle type="source" position={Position.Right}
        style={{ background: P.surface2, border: "none", width: 8, height: 8 }} />
    </div>
  );
});

CollapsedNodeComponent.displayName = "CollapsedNodeComponent";
