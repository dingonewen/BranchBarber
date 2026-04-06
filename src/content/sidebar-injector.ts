import ReactDOM from "react-dom/client";
import { Sidebar } from "../components/Sidebar";
import React from "react";

let sidebarRoot: ReactDOM.Root | null = null;
let sidebarContainer: HTMLDivElement | null = null;

export function injectSidebar(): void {
  if (sidebarContainer) return;

  injectStyles();

  sidebarContainer = document.createElement("div");
  sidebarContainer.id = "bb-root";
  // Inject into <html> not <body> — avoids Gemini's body transforms
  // that break position:fixed child elements
  document.documentElement.appendChild(sidebarContainer);

  sidebarRoot = ReactDOM.createRoot(sidebarContainer);
  sidebarRoot.render(React.createElement(Sidebar));
}

function injectStyles(): void {
  if (document.getElementById("bb-styles")) return;
  let href: string;
  try { href = chrome.runtime.getURL("content.css"); } catch { return; }
  const link = document.createElement("link");
  link.id = "bb-styles";
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export function destroySidebar(): void {
  sidebarRoot?.unmount();
  sidebarContainer?.remove();
  document.getElementById("bb-styles")?.remove();
  sidebarRoot = null;
  sidebarContainer = null;
}
