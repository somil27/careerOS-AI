import { extractJob } from "./extractors";
import type { ExtMessage } from "./types";

chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {
  if (msg?.type === "job:extract") {
    try {
      const job = extractJob();
      sendResponse({ ok: true, job });
    } catch (e) {
      sendResponse({ ok: false, error: (e as Error).message });
    }
    return true;
  }
  if (msg?.type === "ping") {
    sendResponse({ ok: true });
    return true;
  }
  return undefined;
});
