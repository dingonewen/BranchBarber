import { useBranchStore } from "../store";
import { db } from "../db";
import { C } from "./theme";

export function DriftAlert() {
  const driftAlert    = useBranchStore((s) => s.driftAlert);
  const setDriftAlert = useBranchStore((s) => s.setDriftAlert);
  const markAsBranch  = useBranchStore((s) => s.markAsBranch);
  const selectNode    = useBranchStore((s) => s.selectNode);
  const bumpLayoutKey = useBranchStore((s) => s.bumpLayoutKey);

  if (!driftAlert) return null;

  const handleConfirm = () => {
    markAsBranch(driftAlert.nodeId);
    db.nodes.update(driftAlert.nodeId, { isBranch: true });
    selectNode(driftAlert.nodeId);
    bumpLayoutKey();
    setDriftAlert(null);
  };

  return (
    <div style={{
      padding: "10px 12px",
      background: "#fff4ec",
      border: `1px solid ${C.peach}`,
      borderRadius: 10, fontSize: 11, color: C.text,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span>⚠️</span>
        <span style={{ fontWeight: 700, color: C.peach }}>Side Quest Detected</span>
      </div>
      <p style={{ margin: "0 0 8px", color: C.subtext1 }}>
        Drifted{" "}
        <strong style={{ color: C.peach }}>{Math.round(driftAlert.score * 100)}%</strong>
        {" "}from previous topic.
      </p>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={handleConfirm} style={{
          flex: 1, padding: "5px 0", borderRadius: 6, border: "none",
          cursor: "pointer", background: C.peach, color: "#fff",
          fontWeight: 700, fontSize: 11,
        }}>
          ✓ Confirm Branch
        </button>
        <button onClick={() => setDriftAlert(null)} style={{
          padding: "5px 10px", borderRadius: 6,
          border: `1px solid ${C.surface1}`, cursor: "pointer",
          background: C.base, color: C.subtext0, fontSize: 11,
        }}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
