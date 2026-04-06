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
import { useBranchStore } from "../store";
import { TreeNodeComponent } from "./TreeNode";
import type { TreeNode } from "../store";
import { C } from "./theme";

const NODE_TYPES = { treeNode: TreeNodeComponent };

function buildFlowElements(
  storeNodes: Record<string, TreeNode>,
  selectedId: string | null
): { nodes: Node<TreeNode>[]; edges: Edge[] } {
  const nodes: Node<TreeNode>[] = [];
  const edges: Edge[] = [];

  for (const [id, treeNode] of Object.entries(storeNodes)) {
    nodes.push({
      id,
      type: "treeNode",
      position: treeNode.position,
      data: treeNode,
      selected: id === selectedId,
    });

    if (treeNode.parentId) {
      edges.push({
        id: `e-${treeNode.parentId}-${id}`,
        source: treeNode.parentId,
        target: id,
        type: "smoothstep",
        animated: treeNode.status === "side-quest",
        markerEnd: { type: MarkerType.ArrowClosed, color: C.surface2 },
        style: {
          stroke:
            treeNode.status === "branch"     ? C.blue :
            treeNode.status === "side-quest" ? C.yellow :
            treeNode.status === "ghost"      ? C.surface1 :
            C.surface2,
          strokeWidth: 1.5,
          strokeDasharray: treeNode.status === "ghost" ? "4 3" : undefined,
        },
      });
    }
  }
  return { nodes, edges };
}

export function ConversationTree() {
  const storeNodes = useBranchStore((s) => s.nodes);
  const selectedId = useBranchStore((s) => s.selectedNodeId);
  const selectNode = useBranchStore((s) => s.selectNode);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Track node IDs to detect structural changes (add/remove) vs drag-only moves
  const prevNodeIdsRef = useRef<string>("");

  useEffect(() => {
    const currentIds = Object.keys(storeNodes).sort().join(",");
    const idsChanged = currentIds !== prevNodeIdsRef.current;
    prevNodeIdsRef.current = currentIds;

    if (idsChanged) {
      // Structural change — rebuild everything including positions
      const { nodes: n, edges: e } = buildFlowElements(storeNodes, selectedId);
      setNodes(n);
      setEdges(e);
    } else {
      // Only selection changed — update selected flag without touching positions
      setNodes((prev) =>
        prev.map((n) => ({ ...n, selected: n.id === selectedId }))
      );
    }
  }, [storeNodes, selectedId, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<TreeNode>) => {
      if (node.data.status !== "ghost") selectNode(node.id);
    },
    [selectNode]
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
