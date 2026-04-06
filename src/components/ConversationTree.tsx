import React, { useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
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
import { TreeNodeComponent } from "./TreeNode";
import { C, branchColor } from "./theme";
import { db } from "../db";

const NODE_TYPES = { treeNode: TreeNodeComponent };
const SNAP_DIST  = 90;   // px — magnetic snap radius
const NODE_W     = 240;
const NODE_H     = 130;

function buildFlowElements(
  storeNodes: Record<string, TreeNode>,
  selectedId: string | null
): { nodes: Node<TreeNode>[]; edges: Edge[] } {
  const nodes: Node<TreeNode>[] = [];
  const edges: Edge[] = [];

  for (const [id, n] of Object.entries(storeNodes)) {
    nodes.push({ id, type: "treeNode", position: n.position, data: n, selected: id === selectedId });

    if (n.parentId) {
      const edgeColor = n.status === "ghost"    ? C.surface1
                      : n.status === "pending"  ? C.peach
                      : branchColor(n.position.x);
      edges.push({
        id: `e-${n.parentId}-${id}`,
        source: n.parentId,
        target: id,
        type: "smoothstep",
        animated: n.status === "pending",
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
        style: {
          stroke: edgeColor,
          strokeWidth: 1.5,
          strokeDasharray: n.status === "ghost" || n.status === "pending" ? "4 3" : undefined,
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
  const storeNodes   = useBranchStore((s) => s.nodes);
  const selectedId   = useBranchStore((s) => s.selectedNodeId);
  const layoutKey    = useBranchStore((s) => s.layoutKey);
  const selectNode   = useBranchStore((s) => s.selectNode);
  const shiftSubtree = useBranchStore((s) => s.shiftSubtree);
  const reparentNode = useBranchStore((s) => s.reparentNode);
  const bumpLayoutKey = useBranchStore((s) => s.bumpLayoutKey);

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
      const { nodes: n, edges: e } = buildFlowElements(storeNodes, selectedId);
      setNodes(n);
      setEdges(e);
    } else {
      // Only selection changed — don't overwrite drag positions
      setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === selectedId })));
    }
  }, [storeNodes, selectedId, layoutKey, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<TreeNode>) => {
      if (node.data.status !== "ghost") selectNode(node.id);
    },
    [selectNode]
  );

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
        justifyContent: "center", height: "100%", color: C.overlay1,
        fontSize: 11, padding: "0 16px", textAlign: "center", gap: 8,
      }}>
        <div style={{ fontSize: 28 }}>🌿</div>
        <p style={{ fontWeight: 600, color: C.subtext0, margin: 0 }}>No conversation yet</p>
        <p style={{ margin: 0 }}>Start chatting and BranchBarber will map your tree.</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%" }}>
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
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color={C.surface0} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
