// Background Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  console.log("[BranchBarber] Extension installed");
  chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    // Heartbeat — keeps service worker alive
  }
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