import { useEffect, useState } from "react";

type Status = "idle" | "active" | "loading";

export function PopupApp() {
  const [status, setStatus] = useState<Status>("loading");
  const [tabUrl, setTabUrl] = useState<string>("");

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? "";
      setTabUrl(url);

      const isSupported =
        url.includes("chatgpt.com") ||
        url.includes("chat.openai.com") ||
        url.includes("gemini.google.com");

      if (!isSupported) {
        setStatus("idle");
        return;
      }

      chrome.tabs.sendMessage(
        tabs[0].id!,
        { type: "GET_STATUS" },
        (response) => {
          if (chrome.runtime.lastError || !response) {
            setStatus("idle");
          } else {
            setStatus("active");
          }
        }
      );
    });
  }, []);

  const openSidebar = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id!, { type: "SHOW_SIDEBAR" });
    });
  };

  const isSupported =
    tabUrl.includes("chatgpt.com") ||
    tabUrl.includes("chat.openai.com") ||
    tabUrl.includes("gemini.google.com");

  return (
    <div className="w-72 bg-zinc-950 text-white p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <span className="text-2xl">🌿</span>
        <div>
          <h1 className="text-sm font-bold tracking-tight">BranchBarber</h1>
          <p className="text-[10px] text-zinc-500">Conversation Tree Extension</p>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 bg-zinc-900 rounded-lg px-3 py-2">
        <div
          className={`w-2 h-2 rounded-full ${
            status === "active"
              ? "bg-emerald-500"
              : status === "loading"
              ? "bg-amber-400 animate-pulse"
              : "bg-zinc-600"
          }`}
        />
        <span className="text-xs text-zinc-400">
          {status === "active"
            ? "Active on this page"
            : status === "loading"
            ? "Checking..."
            : isSupported
            ? "Ready to activate"
            : "Navigate to ChatGPT or Gemini"}
        </span>
      </div>

      {/* Info */}
      {!isSupported ? (
        <div className="flex flex-col gap-1.5 text-xs text-zinc-500">
          <p>BranchBarber works on:</p>
          <ul className="space-y-0.5 pl-2">
            {[
              "chatgpt.com",
              "chat.openai.com",
              "gemini.google.com",
            ].map((host) => (
              <li key={host} className="flex items-center gap-1.5">
                <span className="text-zinc-700">•</span>
                <span>{host}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-xs text-zinc-400">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-purple-400">✂</span>
            <span>Click "Branch Here" on any AI response to mark a branch point</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-amber-400">⚠</span>
            <span>Automatic drift detection highlights context shifts</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-blue-400">🌿</span>
            <span>Tree panel shows your full conversation structure</span>
          </div>
        </div>
      )}

      {/* Open sidebar button */}
      {isSupported && (
        <button
          onClick={openSidebar}
          className="w-full py-2 bg-purple-700 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Open Tree Panel
        </button>
      )}

      <div className="text-[10px] text-zinc-700 text-center">
        v1.0.0 · Local-first · No telemetry
      </div>
    </div>
  );
}
