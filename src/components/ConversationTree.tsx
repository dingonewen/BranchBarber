import React, { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnConnect,
  addEdge,
  BackgroundVariant,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { useBranchStore } from "../store";
import { TreeNodeComponent } from "./TreeNode";
import type { TreeNode } from "../store";

const NODE_TYPES = { treeNode: TreeNodeComponent };

function treeNodesToFlow(
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
        markerEnd: { type: MarkerType.ArrowClosed, color: "#6b7280" },
        style: {
          stroke:
            treeNode.status === "branch"
              ? "#60a5fa"
              : treeNode.status === "side-quest"
              ? "#fbbf24"
              : "#6b7280",
          strokeWidth: 1.5,
        },
      });
    }
  }

  return { nodes, edges };
}

export function ConversationTree() {
  const storeNodes = useBranchStore((s) => s.nodes);
  const selectedNodeId = useBranchStore((s) => s.selectedNodeId);
  const selectNode = useBranchStore((s) => s.selectNode);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => treeNodesToFlow(storeNodes, selectedNodeId),
    [storeNodes, selectedNodeId]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync with store changes
  React.useEffect(() => {
    const { nodes: n, edges: e } = treeNodesToFlow(storeNodes, selectedNodeId);
    setNodes(n);
    setEdges(e);
  }, [storeNodes, selectedNodeId, setNodes, setEdges]);

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<TreeNode>) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  if (Object.keys(storeNodes).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-xs px-4 text-center gap-2">
        <div className="text-3xl">🌿</div>
        <p className="font-medium text-zinc-400">No conversation yet</p>
        <p>Start chatting and BranchBarber will build your tree automatically.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#3f3f46" />
        <Controls
          className="!bg-zinc-800 !border-zinc-700 !rounded-lg"
          showInteractive={false}
        />
        <MiniMap
          nodeColor={(node: Node<TreeNode>) => {
            const status = node.data?.status;
            if (status === "root") return "#7c3aed";
            if (status === "branch") return "#3b82f6";
            if (status === "side-quest") return "#f59e0b";
            return "#52525b";
          }}
          className="!bg-zinc-900 !border-zinc-700 !rounded-lg"
          maskColor="rgba(0,0,0,0.4)"
        />
      </ReactFlow>
    </div>
  );
}