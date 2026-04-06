import { initObserver, destroyObserver } from "./observer";
import { injectSidebar } from "./sidebar-injector";
import { initNavigator } from "./navigator";
import { detectPlatform } from "./selectors";

// Initialize once DOM is ready
function bootstrap(): void {
  const platform = detectPlatform();
  initObserver();
  injectSidebar();
  initNavigator(platform);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}

// Re-init when popup requests a fresh tree
window.addEventListener("bb-reset", () => {
  destroyObserver();
  initObserver();
});

// Cleanup on unload
window.addEventListener("unload", destroyObserver);
