import { AUTH_STORAGE_KEY, APP_URL, LINK_PATH } from "./config";
import { findDuplicate, insertApplication, recentApplications } from "./lib/api";
import type { ExtMessage, Session } from "./types";

async function getSession(): Promise<Session | null> {
  const out = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  return (out[AUTH_STORAGE_KEY] as Session | undefined) ?? null;
}
async function setSession(session: Session | null) {
  if (session) await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: session });
  else await chrome.storage.local.remove(AUTH_STORAGE_KEY);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.create({ url: `${APP_URL}${LINK_PATH}?welcome=1` }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "auth:set") {
        await setSession(msg.session);
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === "auth:get") {
        const s = await getSession();
        sendResponse({ ok: true, session: s });
        return;
      }
      if (msg.type === "auth:clear") {
        await setSession(null);
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === "job:save") {
        const s = await getSession();
        if (!s) return sendResponse({ ok: false, error: "not_authenticated" });
        const dupe = await findDuplicate(s, msg.job);
        if (dupe.data.length) {
          if (dupe.session !== s) await setSession(dupe.session);
          return sendResponse({ ok: true, duplicate: true, application: dupe.data[0] });
        }
        const created = await insertApplication(dupe.session, msg.job);
        await setSession(created.session);
        sendResponse({ ok: true, duplicate: false, application: created.data[0] });
        try {
          chrome.notifications?.create({
            type: "basic",
            iconUrl: "icon.png",
            title: "Saved to CareerOS",
            message: `${msg.job.role ?? "Job"} @ ${msg.job.company ?? "Unknown"}`,
          });
        } catch { /* ignore */ }
        return;
      }
      if (msg.type === "jobs:recent") {
        const s = await getSession();
        if (!s) return sendResponse({ ok: false, error: "not_authenticated" });
        const out = await recentApplications(s);
        if (out.session !== s) await setSession(out.session);
        sendResponse({ ok: true, items: out.data });
        return;
      }
      sendResponse({ ok: false, error: "unknown_message" });
    } catch (e) {
      sendResponse({ ok: false, error: (e as Error).message });
    }
  })();
  return true;
});
