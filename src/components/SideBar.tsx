import { useState } from "react";
import { useBranchStore } from "../store";
import { ConversationTree } from "./ConversationTree";
import { NodeDetail } from "./NodeDetail";
import { DriftAlert } from "./DriftAlert";
import { SettingsPanel } from "./SettingsPanel";

const TAB_TREE = "tree";
const TAB_SETTINGS = "settings";

export function Sidebar() {
  const sidebarVisible = useBranchStore((s) => s.sidebarVisible);
  const setSidebarVisible = useBranchStore((s) => s.setSidebarVisible);
  const sidebarTab = useBranchStore((s) => s.sidebarTab);
  const setSidebarTab = useBranchStore((s) => s.setSidebarTab);
  const nodeCount = useBranchStore((s) => Object.keys(s.nodes).length);
  const driftAlert = useBranchStore((s) => s.driftAlert);
  const selectedNodeId = useBranchStore((s) => s.selectedNodeId);
  const isProcessing = useBranchStore((s) => s.isProcessing);

  const [collapsed, setCollapsed] = useState(false);

  if (!sidebarVisible) {
    return (
      <button
        onClick={() => setSidebarVisible(true)}
        className="absolute top-4 right-2 w-8 h-8 bg-purple-700 hover:bg-purple-600 text-white rounded-lg shadow-lg flex items-center justify-center text-sm transition-colors"
        title="Open BranchBarber"
      >
        🌿
      </button>
    );
  }

  if (collapsed) {
    return (
      <div className="absolute top-4 right-2 flex flex-col items-center gap-2">
        <button
          onClick={() => setCollapsed(false)}
          className="w-8 h-8 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white rounded-lg shadow-lg flex items-center justify-center text-sm transition-colors"
          title="Expand BranchBarber"
        >
          🌿
        </button>
        {driftAlert && (
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Drift detected" />
        )}
        <span className="text-[10px] text-zinc-500 font-mono">{nodeCount}</span>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-y-0 right-0 w-full flex flex-col bg-zinc-950 border-l border-zinc-800 shadow-2xl overflow-hidden"
      style={{ colorScheme: "dark" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm shrink-0">
        <span className="text-sm">🌿</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white tracking-tight">
              BranchBarber
            </span>
            {isProcessing && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            )}
          </div>
          <span className="text-[10px] text-zinc-500">
            {nodeCount} node{nodeCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setCollapsed(true)}
            className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-300 rounded transition-colors text-sm"
            title="Collapse"
          >
            →
          </button>
          <button
            onClick={() => setSidebarVisible(false)}
            className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-300 rounded transition-colors text-xs"
            title="Hide sidebar"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 shrink-0">
        <button
          onClick={() => setSidebarTab(TAB_TREE)}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            sidebarTab === TAB_TREE
              ? "text-white border-b-2 border-purple-500"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Tree View
        </button>
        <button
          onClick={() => setSidebarTab(TAB_SETTINGS)}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            sidebarTab === TAB_SETTINGS
              ? "text-white border-b-2 border-purple-500"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Settings
        </button>
      </div>

      {sidebarTab === TAB_TREE ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Drift alert */}
          {driftAlert && (
            <div className="pt-3 shrink-0">
              <DriftAlert />
            </div>
          )}

          {/* Node detail panel */}
          {selectedNodeId && (
            <div className="px-3 pt-3 shrink-0">
              <NodeDetail />
            </div>
          )}

          {/* Tree */}
          <div className="flex-1 min-h-0">
            <ConversationTree />
          </div>

          {/* Legend */}
          <div className="px-3 py-2 border-t border-zinc-800 shrink-0">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {[
                { color: "bg-purple-600", label: "Root" },
                { color: "bg-blue-500", label: "Branch" },
                { color: "bg-amber-500", label: "Side Quest" },
                { color: "bg-zinc-600", label: "Normal" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-[10px] text-zinc-500">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <SettingsPanel />
        </div>
      )}
    </div>
  );
}