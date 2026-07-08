// Runs on the CareerOS app origin. Listens for a postMessage from the app's
// /extension/connect page carrying the current Supabase session, and forwards
// it to the background service worker for storage.
type LinkMessage = {
  source: "careeros-extension-link";
  session: {
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
    user: { id: string; email?: string };
  };
};

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data as LinkMessage | undefined;
  if (!data || data.source !== "careeros-extension-link") return;
  const session = data.session;
  if (!session?.access_token || !session?.user?.id) return;
  chrome.runtime.sendMessage({ type: "auth:set", session }, (resp) => {
    window.postMessage(
      { source: "careeros-extension-ack", ok: !!resp?.ok, extensionId: chrome.runtime.id },
      window.location.origin,
    );
  });
});

// Announce presence so the app can render a "connected" badge.
window.postMessage(
  { source: "careeros-extension-present", extensionId: chrome.runtime.id, version: chrome.runtime.getManifest().version },
  window.location.origin,
);
