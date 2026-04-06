import { useBranchStore } from "../store";
import { db } from "../db";
import { C } from "./theme";

const STATUS_COLOR: Record<string, string> = {
  root: C.mauve, branch: C.blue, "side-quest": C.yellow, ghost: C.overlay1, normal: C.overlay1,
};
const STATUS_LABEL: Record<string, string> = {
  root: "Root Node", branch: "Branch Point", "side-quest": "Side Quest", ghost: "Placeholder", normal: "",
};

export function NodeDetail() {
  const selectedId    = useBranchStore((s) => s.selectedNodeId);
  const nodes         = useBranchStore((s) => s.nodes);
  const markAsBranch  = useBranchStore((s) => s.markAsBranch);
  const unmarkBranch  = useBranchStore((s) => s.unmarkBranch);
  const selectNode    = useBranchStore((s) => s.selectNode);

  if (!selectedId) return null;
  const node = nodes[selectedId];
  if (!node) return null;

  const isGhost = node.status === "ghost";

  const btn = (label: string, onClick: () => void, accent?: string) => (
    <button key={label} onClick={onClick} style={{
      flex: 1, padding: "5px 0", borderRadius: 6, cursor: "pointer",
      fontSize: 11, fontWeight: 600,
      background: accent ?? C.base,
      color: accent ? "#fff" : C.subtext1,
      border: accent ? "none" : `1px solid ${C.surface1}`,
    }}>
      {label}
    </button>
  );

  return (
    <div style={{
      background: C.mantle, border: `1px solid ${C.surface0}`,
      borderRadius: 10, padding: "10px 12px", fontSize: 11, color: C.text,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: STATUS_COLOR[node.status] }}>
          {STATUS_LABEL[node.status] || `Turn ${node.domIndex + 1}`}
        </span>
        <button onClick={() => selectNode(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.overlay1, fontSize: 12, padding: 0 }}>✕</button>
      </div>

      <div style={{ fontWeight: 600, color: isGhost ? C.overlay1 : C.text, lineHeight: 1.4, marginBottom: 8, fontStyle: isGhost ? "italic" : "normal" }}>
        {node.summary || node.label}
      </div>

      {!isGhost && node.driftScore > 0 && node.status !== "root" && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ color: C.overlay1, fontSize: 10 }}>Context Drift</span>
            <span style={{ fontWeight: 700, fontSize: 10, color: node.driftScore > 0.6 ? C.red : node.driftScore > 0.3 ? C.yellow : C.green }}>
              {Math.round(node.driftScore * 100)}%
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: C.surface0, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 2, width: `${Math.min(node.driftScore * 100, 100)}%`, background: node.driftScore > 0.6 ? C.red : node.driftScore > 0.3 ? C.yellow : C.green }} />
          </div>
        </div>
      )}

      {!isGhost && (
        <div style={{ background: C.crust, borderRadius: 6, padding: "6px 8px", marginBottom: 8 }}>
          <div style={{ color: C.overlay1, fontSize: 10, marginBottom: 2 }}>Prompt</div>
          <div style={{ color: C.subtext1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const }}>
            {node.prompt}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        {!isGhost && btn("👁 View",  () => window.postMessage({ type: "BRANCHBARBER_SCROLL_TO", domIndex: node.domIndex }, "*"))}
        {!isGhost && btn("↩ Reset", () => window.postMessage({ type: "BRANCHBARBER_RESET_TO",  domIndex: node.domIndex }, "*"))}
        {node.status === "normal"   && btn("✂ Branch", () => { markAsBranch(selectedId); db.nodes.update(selectedId, { isBranch: true }); }, C.mauve)}
        {node.status === "branch"   && btn("↺ Unbranch", () => { unmarkBranch(selectedId); db.nodes.update(selectedId, { isBranch: false }); }, C.overlay1)}
        {node.status === "side-quest" && btn("↺ Unbranch", () => { unmarkBranch(selectedId); db.nodes.update(selectedId, { isSideQuest: false }); }, C.overlay1)}
      </div>
    </div>
  );
}
