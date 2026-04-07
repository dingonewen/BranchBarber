import { initObserver, destroyObserver, rescaleLayout } from "./observer";
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

// Re-layout when user saves settings with Auto-scale ON
window.addEventListener("bb-rescale", (e) => {
  const threshold = (e as CustomEvent<{ threshold: number }>).detail.threshold;
  rescaleLayout(threshold);
});

// Cleanup on unload
window.addEventListener("unload", destroyObserver);
