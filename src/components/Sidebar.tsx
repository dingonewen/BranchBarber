import { useState, useEffect, useRef, useCallback } from "react";
import { useBranchStore } from "../store";
import { ConversationTree } from "./ConversationTree";
import { NodeDetail } from "./NodeDetail";
import { DriftAlert } from "./DriftAlert";
import { SettingsPanel } from "./SettingsPanel";
import { ErrorBoundary } from "./ErrorBoundary";
import { C, branchColor } from "./theme";

export { C };

const MIN_W = 280;
const MAX_W = 700;
const DEFAULT_W = 340;
const NODE_W = 240;

export function Sidebar() {
  const [open, setOpen]   = useState(true);
  const [tab, setTab]     = useState<"tree" | "settings">("tree");
  const [width, setWidth] = useState(DEFAULT_W);
  const dragging = useRef(false);
  const startX   = useRef(0);
  const startW   = useRef(DEFAULT_W);

  const nodes        = useBranchStore((s) => s.nodes);
  const nodeCount    = Object.keys(nodes).length;
  const driftAlert   = useBranchStore((s) => s.driftAlert);
  const selectedId   = useBranchStore((s) => s.selectedNodeId);
  const isProcessing = useBranchStore((s) => s.isProcessing);

  // ── Dynamic legend — reflects actual node statuses + branch columns ───────
  const legend = (() => {
    const vals = Object.values(nodes);
    if (vals.length === 0) return [];
    const items: { color: string; label: string }[] = [];
    if (vals.some((n) => n.status === "root"))
      items.push({ color: C.mauve, label: "Root" });
    if (vals.some((n) => n.status === "normal"))
      items.push({ color: C.surface2, label: "Main Thread" });
    if (vals.some((n) => n.status === "pending"))
      items.push({ color: C.peach, label: "Side Quest?" });
    // One entry per unique branch column, with its actual color
    const branchCols = [...new Set(
      vals.filter((n) => n.status === "side-quest")
          .map((n) => Math.round(n.position.x / NODE_W))
    )].sort((a, b) => a - b);
    branchCols.forEach((col, i) => {
      items.push({ color: branchColor(col * NODE_W), label: branchCols.length === 1 ? "Branch" : `Branch ${i + 1}` });
    });
    if (vals.some((n) => n.status === "ghost"))
      items.push({ color: C.overlay1, label: "Placeholder" });
    if (vals.some((n) => n.status !== "root" && n.parentId === null && n.status !== "ghost"))
      items.push({ color: C.overlay0, label: "Isolated" });
    return items;
  })();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("bb-show", handler);
    return () => window.removeEventListener("bb-show", handler);
  }, []);

  // ── Resize drag handlers ─────────────────────────────────────────────────
  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    startX.current   = e.clientX;
    startW.current   = width;
  }, [width]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX; // dragging left = wider
      const newW  = Math.min(MAX_W, Math.max(MIN_W, startW.current + delta));
      setWidth(newW);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const TOGGLE_W = 28;

  return (
    <div
      style={{
        position: "fixed", top: 0, right: 0,
        width: open ? width + TOGGLE_W : TOGGLE_W,
        height: "100vh",
        zIndex: 2147483647,
        pointerEvents: "none",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: 13,
        transition: dragging.current ? "none" : "width 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* ── Toggle tab — sticks to left edge of the whole wrapper ── */}
      <div
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((v) => !v); }}
        title={open ? "Close panel" : "Open BranchBarber"}
        style={{
          pointerEvents: "auto",
          position: "absolute", left: 0, top: "50%",
          transform: "translateY(-50%)",
          width: TOGGLE_W, height: 64,
          background: C.surface0,
          border: `1px solid ${C.surface1}`,
          borderRight: "none",
          borderRadius: "8px 0 0 8px",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: C.subtext0, fontSize: 16,
          userSelect: "none", boxShadow: "-2px 0 6px rgba(0,0,0,0.06)",
        }}
      >
        {open ? "›" : "‹"}
      </div>

      {/* ── Sliding panel ── */}
      <div
        style={{
          pointerEvents: "auto",
          position: "absolute", top: 0, right: 0,
          width: width, height: "100vh",
          background: C.base,
          borderLeft: `1px solid ${C.surface1}`,
          // Rounded top-left and bottom-left corners
          borderRadius: "12px 0 0 12px",
          display: "flex", flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.08)",
        }}
      >
        {/* Resize handle — draggable left edge strip */}
        <div
          onMouseDown={onResizeMouseDown}
          style={{
            position: "absolute", left: 0, top: 0,
            width: 5, height: "100%",
            cursor: "ew-resize",
            zIndex: 10,
            borderRadius: "12px 0 0 12px",
          }}
        />

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 12px",
          background: C.mantle,
          borderBottom: `1px solid ${C.surface0}`,
          flexShrink: 0,
        }}>
          <img src={chrome.runtime.getURL("icons/icon48.png")} style={{ width: 20, height: 20, objectFit: "contain" }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: C.text, letterSpacing: "-0.01em" }}>
                BranchBarber
              </span>
              {isProcessing && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.mauve, display: "inline-block" }} />
              )}
            </div>
            <div style={{ fontSize: 10, color: C.overlay1, marginTop: 1 }}>
              {nodeCount} node{nodeCount !== 1 ? "s" : ""}
            </div>
          </div>
          <button
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.overlay1, fontSize: 14, padding: "2px 6px", borderRadius: 4, lineHeight: 1 }}
          >✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.surface0}`, flexShrink: 0, background: C.mantle }}>
          {(["tree", "settings"] as const).map((t) => (
            <button
              key={t}
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setTab(t); }}
              style={{
                flex: 1, padding: "8px 0",
                fontSize: 11, fontWeight: tab === t ? 600 : 400,
                color: tab === t ? C.mauve : C.overlay1,
                background: "none", border: "none",
                borderBottom: tab === t ? `2px solid ${C.mauve}` : "2px solid transparent",
                cursor: "pointer", marginBottom: -1,
              }}
            >
              {t === "tree" ? "Tree View" : "Settings"}
            </button>
          ))}
        </div>

        {/* Body */}
        {tab === "tree" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            {driftAlert && <div style={{ padding: "8px 12px 0", flexShrink: 0 }}><DriftAlert /></div>}
            {selectedId  && <div style={{ padding: "8px 12px 0", flexShrink: 0 }}><NodeDetail /></div>}
            <div style={{ flex: 1, minHeight: 0 }}>
              <ErrorBoundary><ConversationTree /></ErrorBoundary>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", padding: "6px 12px", borderTop: `1px solid ${C.surface0}`, flexShrink: 0, background: C.mantle }}>
              {legend.map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.overlay1 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <ErrorBoundary><SettingsPanel /></ErrorBoundary>
          </div>
        )}
      </div>
    </div>
  );
}
