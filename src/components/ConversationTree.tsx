import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ReactFlowInstance,
  BackgroundVariant,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import Dagre from "@dagrejs/dagre";
import { toPng } from "html-to-image";
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
const SNAP_DIST  = 90;
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

function computeDagrePositions(
  storeNodes: Record<string, TreeNode>
): Record<string, { x: number; y: number }> {
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 60, marginx: 20, marginy: 20 });

  for (const id of Object.keys(storeNodes)) {
    g.setNode(id, { width: NODE_W, height: NODE_H });
  }
  for (const [id, n] of Object.entries(storeNodes)) {
    if (n.parentId && storeNodes[n.parentId]) {
      g.setEdge(n.parentId, id);
    }
  }

  Dagre.layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  for (const id of Object.keys(storeNodes)) {
    const node = g.node(id);
    // Dagre centers nodes; ReactFlow positions from top-left corner
    positions[id] = { x: node.x - NODE_W / 2, y: node.y - NODE_H / 2 };
  }
  return positions;
}

function buildFlowElements(
  storeNodes: Record<string, TreeNode>,
  selectedId: string | null,
  dark: boolean,
  positionOverrides?: Record<string, { x: number; y: number }>
): { nodes: Node<TreeNode>[]; edges: Edge[] } {
  const nodes: Node<TreeNode>[] = [];
  const edges: Edge[] = [];
  const P = tc(dark);

  for (const [id, n] of Object.entries(storeNodes)) {
    const pos = positionOverrides?.[id] ?? n.position;
    nodes.push({ id, type: "treeNode", position: pos, data: n, selected: id === selectedId });

    if (n.parentId) {
      // Use stored position.x for color so branch colors are stable in both layout modes
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

function triggerDownload(href: string, filename: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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

  const [autoLayout, setAutoLayout] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const prevStructureRef = useRef("");

  useEffect(() => {
    const positionOverrides = autoLayout ? computeDagrePositions(storeNodes) : undefined;

    // Include autoLayout flag so toggling always triggers a rebuild
    const structure = Object.values(storeNodes)
      .map((n) => `${n.id}:${n.parentId ?? ""}:${n.status}:${n.position.x}`)
      .sort()
      .join("|") + `@${layoutKey}@${autoLayout ? 1 : 0}`;

    if (structure !== prevStructureRef.current) {
      prevStructureRef.current = structure;
      const { nodes: n, edges: e } = buildFlowElements(storeNodes, selectedId, dark, positionOverrides);
      setNodes(n);
      setEdges(e);
    } else {
      setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === selectedId })));
    }
  }, [storeNodes, selectedId, layoutKey, dark, autoLayout, setNodes, setEdges]);

  const toggleAutoLayout = useCallback(() => {
    setAutoLayout((v) => {
      const next = !v;
      if (next) setTimeout(() => rfInstance.current?.fitView({ padding: 0.3 }), 50);
      return next;
    });
  }, []);

  const exportJSON = useCallback(() => {
    setShowExportMenu(false);
    const snap = useBranchStore.getState();
    const data = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      conversationId: snap.conversationId,
      nodes: Object.values(snap.nodes).map((n) => ({
        id: n.id,
        label: n.label,
        prompt: n.prompt,
        response: n.response,
        summary: n.summary,
        parentId: n.parentId,
        status: n.status,
        depth: n.depth,
        driftScore: n.driftScore,
        domIndex: n.domIndex,
        position: n.position,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `branch-barber-${snap.conversationId ?? "tree"}.json`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const exportPNG = useCallback(async () => {
    if (!containerRef.current) return;
    setShowExportMenu(false);
    setExporting(true);
    try {
      const dataUrl = await toPng(containerRef.current, {
        backgroundColor: P.base,
        pixelRatio: 2,
        // Strip UI chrome — export only the canvas + nodes + edges
        filter: (el) => {
          const cls = (el as HTMLElement).classList;
          return !cls?.contains("react-flow__panel") && !cls?.contains("react-flow__controls");
        },
      });
      triggerDownload(dataUrl, `branch-barber-${useBranchStore.getState().conversationId ?? "tree"}.png`);
    } catch (e) {
      console.error("[BranchBarber] PNG export failed:", e);
    } finally {
      setExporting(false);
    }
  }, [P.base]);

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

    for (const [id, n] of Object.entries(restoredNodes)) {
      if (!prevNodes[id]) {
        await db.nodes.put(treeNodeToDbNode(n, conversationId));
      }
    }

    for (const id of Object.keys(prevNodes)) {
      if (!restoredNodes[id]) {
        await db.nodes.delete(id);
      }
    }

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

  // ── Magnetic snap (disabled in auto-layout mode) ──────────────────────────
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, draggedNode: Node<TreeNode>) => {
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

      const existingChildren = Object.values(storeNodes).filter(
        (n) => n.parentId === nearest!.id && n.id !== draggedNode.id
      );
      const maxChildX = existingChildren.length
        ? Math.max(...existingChildren.map((c) => c.position.x))
        : nearest.position.x - NODE_W;
      const snapPos = { x: maxChildX + NODE_W, y: nearest.position.y + NODE_H };

      const origPos = storeNodes[draggedNode.id]?.position ?? dragPos;
      const dx = snapPos.x - origPos.x;
      const dy = snapPos.y - origPos.y;

      const subtreeIds = getSubtreeIds(storeNodes, draggedNode.id);

      shiftSubtree(draggedNode.id, dx, dy);
      reparentNode(draggedNode.id, nearest.id);
      bumpLayoutKey();

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
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
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
        onNodeDragStop={autoLayout ? undefined : onNodeDragStop}
        onInit={(instance) => { rfInstance.current = instance; }}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={!autoLayout}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color={P.surface0} />
        <Controls showInteractive={false} position="bottom-right"
          style={{ background: P.surface0, border: `1px solid ${P.surface1}`, borderRadius: 8 }} />
        <Panel position="bottom-left" style={{ display: "flex", gap: 6 }}>
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
          <button
            onClick={toggleAutoLayout}
            title={autoLayout ? "Switch to manual layout" : "Apply Dagre auto-layout"}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer",
              background: autoLayout ? P.mauve : P.surface1,
              color: autoLayout ? (dark ? P.crust : "#fff") : P.subtext1,
              fontSize: 11, fontWeight: 600, fontFamily: "inherit",
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            ⊞ Auto
          </button>

          {/* Export dropdown */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              disabled={exporting}
              title="Export tree"
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "6px 10px", borderRadius: 8, border: "none",
                cursor: exporting ? "default" : "pointer",
                background: showExportMenu ? P.mauve : P.surface1,
                color: showExportMenu ? (dark ? P.crust : "#fff") : P.subtext1,
                fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                transition: "background 0.15s, color 0.15s",
                opacity: exporting ? 0.6 : 1,
              }}
            >
              {exporting ? "…" : "⬇ Export"}
            </button>
            {showExportMenu && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 6px)", left: 0,
                background: P.mantle, border: `1px solid ${P.surface1}`,
                borderRadius: 8, overflow: "hidden",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                minWidth: 130, zIndex: 10,
              }}>
                {[
                  { label: "As JSON", action: exportJSON },
                  { label: "As PNG", action: exportPNG },
                ].map(({ label, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    style={{
                      display: "block", width: "100%",
                      padding: "8px 14px", border: "none",
                      background: "none", cursor: "pointer",
                      textAlign: "left", fontSize: 11,
                      color: P.text, fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = P.surface0; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
