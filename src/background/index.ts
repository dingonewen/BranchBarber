// Background Service Worker (Manifest V3)
// Handles message passing and extension lifecycle

chrome.runtime.onInstalled.addListener(() => {
  console.log("[BranchBarber] Extension installed");
});

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; payload?: unknown },
    _sender,
    sendResponse: (response: unknown) => void
  ) => {
    if (message.type === "GET_STATUS") {
      sendResponse({ status: "active" });
    }
    return true;
  }
);

// Keep service worker alive for message handling
chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    // Heartbeat
  }
});