import React from "react";
import ReactDOM from "react-dom/client";
import { Sidebar } from "../components/Sidebar";

let sidebarRoot: ReactDOM.Root | null = null;
let sidebarContainer: HTMLDivElement | null = null;

export function injectSidebar(): void {
  if (sidebarContainer) return;

  sidebarContainer = document.createElement("div");
  sidebarContainer.id = "branchbarber-sidebar-root";
  sidebarContainer.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 340px;
    height: 100vh;
    z-index: 2147483647;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  `;

  document.body.appendChild(sidebarContainer);

  // Inject shadow DOM for style isolation
  const shadow = sidebarContainer.attachShadow({ mode: "open" });

  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = chrome.runtime.getURL("content.css");
  shadow.appendChild(styleLink);

  const mountPoint = document.createElement("div");
  mountPoint.id = "branchbarber-mount";
  mountPoint.style.cssText = "width:100%; height:100%; pointer-events:auto;";
  shadow.appendChild(mountPoint);

  sidebarRoot = ReactDOM.createRoot(mountPoint);
  sidebarRoot.render(React.createElement(Sidebar));
}

export function destroySidebar(): void {
  sidebarRoot?.unmount();
  sidebarContainer?.remove();
  sidebarRoot = null;
  sidebarContainer = null;
}