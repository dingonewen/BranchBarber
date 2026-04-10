import React, { useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { useBranchStore, getSubtreeIds } from "../store";
import type { TreeNode } from "../store";
import type { ConversationNode } from "../db";
import { TreeNodeComponent } from "./TreeNode";
import { tc, branchColor } from "./theme";
import { db } from "../db";

function safeGetURL(path: string): string {
  try { return chrome.runtime.getURL(path); } catch { return ""; }
}

const NODE_TYPES = { treeNode: TreeNodeComponent };
const SNAP_DIST  = 90;   // px — magnetic snap radius
const NODE_W     = 240;
const NODE_H     = 130;

function treeNodeToDbNode(n: TreeNode, conversationId: string): ConversationNode {
  return {
    id: n.id, conversationId, parentId: n.parentId,
    prompt: n.prompt, response: n.response, summary: n.summary, label: n.label,
    embedding: null, driftScore: n.driftScore,
    isBranch: n.status === "side-quest",
    isRoot: n.status === "root",
    isSideQuest: n.status === "side-quest",
    isGhost: n.status === "ghost",
    domIndex: n.domIndex, createdAt: Date.now(),
    depth: n.depth, position: n.position,
  };
}

function buildFlowElements(
  storeNodes: Record<string, TreeNode>,
  selectedId: string | null,
  dark: boolean
): { nodes: Node<TreeNode>[]; edges: Edge[] } {
  const nodes: Node<TreeNode>[] = [];
  const edges: Edge[] = [];
  const P = tc(dark);

  for (const [id, n] of Object.entries(storeNodes)) {
    nodes.push({ id, type: "treeNode", position: n.position, data: n, selected: id === selectedId });

    if (n.parentId) {
      const edgeColor = n.status === "ghost" ? P.surface1 : branchColor(n.position.x, dark);
      edges.push({
        id: `e-${n.parentId}-${id}`,
        source: n.parentId,
        target: id,
        type: "smoothstep",
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
        style: {
          stroke: edgeColor,
          strokeWidth: 1.5,
          strokeDasharray: n.status === "ghost" ? "4 3" : undefined,
          opacity: n.status === "ghost" ? 0.5 : 1,
        },
      });
    }
  }
  return { nodes, edges };
}

function isDescendantOf(nodes: Record<string, TreeNode>, nodeId: string, ancestorId: string): boolean {
  let n = nodes[nodeId];
  while (n?.parentId) {
    if (n.parentId === ancestorId) return true;
    n = nodes[n.parentId];
  }
  return false;
}

export function ConversationTree() {
  const storeNodes    = useBranchStore((s) => s.nodes);
  const selectedId    = useBranchStore((s) => s.selectedNodeId);
  const dark          = useBranchStore((s) => s.darkMode);
  const P             = tc(dark);
  const layoutKey     = useBranchStore((s) => s.layoutKey);
  const conversationId = useBranchStore((s) => s.conversationId);
  const selectNode    = useBranchStore((s) => s.selectNode);
  const shiftSubtree  = useBranchStore((s) => s.shiftSubtree);
  const reparentNode  = useBranchStore((s) => s.reparentNode);
  const bumpLayoutKey = useBranchStore((s) => s.bumpLayoutKey);
  const undoStack     = useBranchStore((s) => s.undoStack);
  const undoAction    = useBranchStore((s) => s.undo);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const prevStructureRef = useRef("");

  useEffect(() => {
    // Rebuild when: node IDs change, parentIds change (reparent), OR layoutKey bumped
    // Include status + posX so any color/layout change triggers rebuild immediately
    const structure = Object.values(storeNodes)
      .map((n) => `${n.id}:${n.parentId ?? ""}:${n.status}:${n.position.x}`)
      .sort()
      .join("|") + `@${layoutKey}`;

    if (structure !== prevStructureRef.current) {
      prevStructureRef.current = structure;
      const { nodes: n, edges: e } = buildFlowElements(storeNodes, selectedId, dark);
      setNodes(n);
      setEdges(e);
    } else {
      // Only selection changed — don't overwrite drag positions
      setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === selectedId })));
    }
  }, [storeNodes, selectedId, layoutKey, dark, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<TreeNode>) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  // ── Undo ─────────────────────────────────────────────────────────────────
  const handleUndo = useCallback(async () => {
    if (!conversationId) return;
    const prevNodes = undoAction();
    if (!prevNodes) return;

    const restoredNodes = useBranchStore.getState().nodes;

    // Nodes re-appearing after undo (were deleted by undone action) → re-insert in DB
    for (const [id, n] of Object.entries(restoredNodes)) {
      if (!prevNodes[id]) {
        await db.nodes.put(treeNodeToDbNode(n, conversationId));
      }
    }

    // Nodes that no longer exist after undo (were added by undone action) → delete from DB
    for (const id of Object.keys(prevNodes)) {
      if (!restoredNodes[id]) {
        await db.nodes.delete(id);
      }
    }

    // Nodes present in both → update mutable fields in DB
    for (const [id, n] of Object.entries(restoredNodes)) {
      if (prevNodes[id]) {
        await db.nodes.update(id, {
          parentId: n.parentId,
          position: n.position,
          isBranch: n.status === "side-quest",
          isSideQuest: n.status === "side-quest",
          isGhost: n.status === "ghost",
        });
      }
    }

    bumpLayoutKey();
  }, [conversationId, undoAction, bumpLayoutKey]);

  // ── Magnetic snap ────────────────────────────────────────────────────────
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, draggedNode: Node<TreeNode>) => {
      // Don't snap ghost nodes
      if (draggedNode.data.status === "ghost") return;

      const dragPos = draggedNode.position;
      let nearest: Node<TreeNode> | null = null;
      let nearestDist = Infinity;

      for (const n of nodes) {
        if (n.id === draggedNode.id) continue;
        if (isDescendantOf(storeNodes, n.id, draggedNode.id)) continue;
        const dx = n.position.x - dragPos.x;
        const dy = n.position.y - dragPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < SNAP_DIST && dist < nearestDist) {
          nearest = n;
          nearestDist = dist;
        }
      }

      if (!nearest) return;

      // Place as next child of nearest, below and to the right of existing children
      const existingChildren = Object.values(storeNodes).filter(
        (n) => n.parentId === nearest!.id && n.id !== draggedNode.id
      );
      const maxChildX = existingChildren.length
        ? Math.max(...existingChildren.map((c) => c.position.x))
        : nearest.position.x - NODE_W;
      const snapPos = { x: maxChildX + NODE_W, y: nearest.position.y + NODE_H };

      // Calculate delta from original STORED position (not current drag position)
      const origPos = storeNodes[draggedNode.id]?.position ?? dragPos;
      const dx = snapPos.x - origPos.x;
      const dy = snapPos.y - origPos.y;

      // Collect subtree IDs before store updates
      const subtreeIds = getSubtreeIds(storeNodes, draggedNode.id);

      // Update store: shift positions + reparent
      shiftSubtree(draggedNode.id, dx, dy);
      reparentNode(draggedNode.id, nearest.id);
      bumpLayoutKey();

      // Update DB asynchronously
      db.nodes.update(draggedNode.id, { parentId: nearest.id, position: snapPos });
      for (const id of subtreeIds) {
        if (id === draggedNode.id) continue;
        const n = storeNodes[id];
        if (n) db.nodes.update(id, { position: { x: n.position.x + dx, y: n.position.y + dy } });
      }
    },
    [nodes, storeNodes, shiftSubtree, reparentNode, bumpLayoutKey]
  );

  if (Object.keys(storeNodes).length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100%", color: P.overlay1,
        fontSize: 11, padding: "0 16px", textAlign: "center", gap: 8,
      }}>
        <img src={safeGetURL("icons/icon128.png")} style={{ width: 48, height: 48, objectFit: "contain", opacity: 0.5 }} />
        <p style={{ fontWeight: 600, color: P.subtext0, margin: 0 }}>No conversation yet</p>
        <p style={{ margin: 0 }}>Start chatting and Branch Barber will map your tree.</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <img
        src={safeGetURL("icons/dizzy.png")}
        style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 320, height: 320,
          objectFit: "contain",
          opacity: 0.06,
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
        }}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color={P.surface0} />
        <Controls showInteractive={false} position="bottom-right"
          style={{ background: P.surface0, border: `1px solid ${P.surface1}`, borderRadius: 8 }} />
        <Panel position="bottom-left">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="Undo last action"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 10px", borderRadius: 8, border: "none", cursor: undoStack.length === 0 ? "default" : "pointer",
              background: undoStack.length === 0 ? P.surface0 : P.surface1,
              color: undoStack.length === 0 ? P.overlay0 : P.subtext1,
              fontSize: 11, fontWeight: 600, fontFamily: "inherit",
              boxShadow: undoStack.length === 0 ? "none" : "0 1px 4px rgba(0,0,0,0.1)",
              transition: "background 0.15s",
            }}
          >
            ↩ Undo {undoStack.length > 0 && `(${undoStack.length})`}
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
