import { useBranchStore } from "../store";
import { db, upsertNode } from "../db";
import type { ConversationNode } from "../db";
import { generateId } from "../utils";
import { C, branchColor } from "./theme";

const NODE_W = 240;
const NODE_H = 130;

const STATUS_LABEL: Record<string, string> = {
  root: "Root Node", "side-quest": "Confirmed Branch",
  pending: "Side Quest?", ghost: "Placeholder", normal: "",
};

export function NodeDetail() {
  const selectedId    = useBranchStore((s) => s.selectedNodeId);
  const nodes         = useBranchStore((s) => s.nodes);
  const conversationId = useBranchStore((s) => s.conversationId);
  const markAsBranch  = useBranchStore((s) => s.markAsBranch);
  const unmarkBranch  = useBranchStore((s) => s.unmarkBranch);
  const isolateNode   = useBranchStore((s) => s.isolateNode);
  const removeNode    = useBranchStore((s) => s.removeNode);
  const addNode       = useBranchStore((s) => s.addNode);
  const shiftSubtree  = useBranchStore((s) => s.shiftSubtree);
  const bumpLayoutKey = useBranchStore((s) => s.bumpLayoutKey);
  const selectNode    = useBranchStore((s) => s.selectNode);

  if (!selectedId) return null;
  const node = nodes[selectedId];
  if (!node) return null;

  const isGhost  = node.status === "ghost";
  const isBranched = node.status === "pending" || node.status === "side-quest";
  const accent   = isGhost     ? C.overlay1
                 : isBranched && node.status === "pending" ? C.peach
                 : branchColor(node.position.x);

  // ── Branch (normal → side-quest) ─────────────────────────────────────────
  // Creates a ghost placeholder at the left-child slot, moves this node + its
  // entire subtree to the right-child slot. Both are children of the same parent.
  const handleBranch = async () => {
    if (!node.parentId || !conversationId) return;
    const parent = nodes[node.parentId];
    if (!parent) return;

    // Left-child (ghost) position = directly below parent
    const ghostPos = { x: parent.position.x, y: parent.position.y + NODE_H };
    // Right-child (branch) position = one column to the right
    const branchPos = { x: parent.position.x + NODE_W, y: parent.position.y + NODE_H };

    // Create ghost sibling
    const ghostId = generateId();
    const ghostData: ConversationNode = {
      id: ghostId,
      conversationId,
      parentId: node.parentId,
      prompt: "", response: "",
      summary: "Continue main thread here",
      label: "Continue main thread here",
      embedding: null, driftScore: 0,
      isBranch: false, isRoot: false, isSideQuest: false, isGhost: true,
      domIndex: -1, createdAt: Date.now(),
      depth: parent.depth + 1,
      position: ghostPos,
    };
    await upsertNode(ghostData);
    addNode(ghostData);

    // Shift this node + subtree from current position to branchPos
    const dx = branchPos.x - node.position.x;
    const dy = branchPos.y - node.position.y;
    shiftSubtree(selectedId, dx, dy);

    // Persist new positions for entire subtree
    const updateSubtreeDb = (id: string) => {
      const n = useBranchStore.getState().nodes[id];
      if (n) {
        db.nodes.update(id, { position: n.position });
        n.children.forEach(updateSubtreeDb);
      }
    };
    updateSubtreeDb(selectedId);

    // Mark as confirmed branch
    markAsBranch(selectedId);
    db.nodes.update(selectedId, { isBranch: true, isSideQuest: true, position: branchPos });
    bumpLayoutKey();
  };

  // ── Confirm pending (auto-detected, positions already correct) ────────────
  const handleConfirm = () => {
    markAsBranch(selectedId);
    db.nodes.update(selectedId, { isBranch: true });
    bumpLayoutKey();
  };

  // ── Unbranch: snap back to ghost left-child slot, delete ghost ────────────
  const handleUnbranch = () => {
    const ghost = Object.values(nodes).find(
      (n) => n.parentId === node.parentId && n.status === "ghost"
    );
    if (ghost) {
      const dx = ghost.position.x - node.position.x;
      const dy = ghost.position.y - node.position.y;
      shiftSubtree(selectedId, dx, dy);
      removeNode(ghost.id);
      db.nodes.delete(ghost.id);
      const updateSubtreeDb = (id: string) => {
        const n = useBranchStore.getState().nodes[id];
        if (n) { db.nodes.update(id, { position: n.position }); n.children.forEach(updateSubtreeDb); }
      };
      updateSubtreeDb(selectedId);
    }
    unmarkBranch(selectedId);
    db.nodes.update(selectedId, { isBranch: false, isSideQuest: false });
    bumpLayoutKey();
  };

  // ── Detach: splice out of chain, children reconnect to grandparent ────────
  const handleDetach = () => {
    const grandparentId = node.parentId;
    for (const childId of node.children) {
      db.nodes.update(childId, { parentId: grandparentId });
    }
    db.nodes.update(selectedId, { parentId: null });
    isolateNode(selectedId);
    selectNode(null);
    bumpLayoutKey();
  };

  const btn = (label: string, onClick: () => void, color?: string) => (
    <button key={label} onClick={onClick} style={{
      flex: 1, padding: "5px 0", borderRadius: 6, cursor: "pointer",
      fontSize: 11, fontWeight: 600,
      background: color ?? C.base,
      color: color ? "#fff" : C.subtext1,
      border: color ? "none" : `1px solid ${C.surface1}`,
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
        <span style={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: accent }}>
          {STATUS_LABEL[node.status] || `Turn ${node.domIndex + 1}`}
        </span>
        <button onClick={() => selectNode(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.overlay1, fontSize: 12, padding: 0 }}>✕</button>
      </div>

      {/* Pending explanation */}
      {node.status === "pending" && (
        <div style={{ fontSize: 10, color: C.peach, background: "#fff4ec", borderRadius: 6, padding: "4px 8px", marginBottom: 8 }}>
          Auto-detected topic shift — confirm to lock as a branch, or dismiss to keep on main thread.
        </div>
      )}

      <div style={{ fontWeight: 600, color: isGhost ? C.overlay1 : C.text, lineHeight: 1.4, marginBottom: 8, fontStyle: isGhost ? "italic" : "normal" }}>
        {node.summary || node.label}
      </div>

      {!isGhost && node.driftScore > 0 && node.status !== "root" && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ color: C.overlay1, fontSize: 10 }}>Drift from previous</span>
            <span style={{ fontWeight: 700, fontSize: 10, color: node.driftScore > 0.6 ? C.red : node.driftScore > 0.3 ? C.yellow : C.green }}>
              {Math.round(node.driftScore * 100)}%
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: C.surface0, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 2, width: `${Math.min(node.driftScore * 100, 100)}%`,
              background: node.driftScore > 0.6 ? C.red : node.driftScore > 0.3 ? C.yellow : C.green }} />
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

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {!isGhost && btn("👁 View", () => window.postMessage({ type: "BRANCHBARBER_SCROLL_TO", domIndex: node.domIndex }, "*"))}

        {/* Detach: splice out of chain */}
        {!isGhost && node.status !== "root" && node.parentId !== null &&
          btn("⛓ Detach", handleDetach, C.overlay1)}

        {/* Normal on main → offer to branch right */}
        {node.status === "normal" && node.parentId !== null &&
          btn("✂ Branch →", handleBranch, accent)}

        {/* Pending (auto-detected) → confirm or dismiss */}
        {node.status === "pending" && (
          <>
            {btn("✓ Confirm", handleConfirm, C.peach)}
            {btn("↺ Back to Main", handleUnbranch)}
          </>
        )}

        {/* Confirmed branch → only option is back to main */}
        {node.status === "side-quest" &&
          btn("↺ Back to Main", handleUnbranch, C.surface2)}
      </div>
    </div>
  );
}
