import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { APP_URL, LINK_PATH } from "./config";
import type { ExtMessage, JobPayload, Session } from "./types";

function send<T = any>(msg: ExtMessage): Promise<T> {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

async function activeTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function extractFromActiveTab(): Promise<JobPayload | null> {
  const tab = await activeTab();
  if (!tab?.id) return null;
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id!, { type: "job:extract" }, (resp) => {
      if (chrome.runtime.lastError || !resp?.ok) return resolve(null);
      resolve(resp.job as JobPayload);
    });
  });
}

type RecentItem = { id: string; company: string; role: string; job_url: string | null; status: string; created_at: string };

function Popup() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [job, setJob] = useState<JobPayload | null>(null);
  const [scanning, setScanning] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "dup"; text: string; id?: string } | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  useEffect(() => {
    (async () => {
      const s = await send<{ ok: boolean; session: Session | null }>({ type: "auth:get" });
      setSession(s?.session ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      setScanning(true);
      const j = await extractFromActiveTab();
      setJob(j);
      setScanning(false);
      const r = await send<{ ok: boolean; items: RecentItem[] }>({ type: "jobs:recent" });
      if (r?.ok) setRecent(r.items);
    })();
  }, [session]);

  const isSupportedPage = useMemo(() => !!job?.company || !!job?.role, [job]);

  async function connect() {
    await chrome.tabs.create({ url: `${APP_URL}${LINK_PATH}` });
  }
  async function signOut() {
    await send({ type: "auth:clear" });
    setSession(null);
    setJob(null);
    setRecent([]);
  }
  async function save() {
    if (!job) return;
    setSaving(true);
    setMsg(null);
    const res = await send<{ ok: boolean; duplicate?: boolean; application?: { id: string }; error?: string }>({
      type: "job:save",
      job,
    });
    setSaving(false);
    if (!res?.ok) {
      setMsg({ kind: "err", text: res?.error === "not_authenticated" ? "Please sign in first." : res?.error ?? "Save failed" });
      return;
    }
    if (res.duplicate) setMsg({ kind: "dup", text: "Already saved — opened existing entry.", id: res.application?.id });
    else setMsg({ kind: "ok", text: "Saved to CareerOS", id: res.application?.id });
    const r = await send<{ ok: boolean; items: RecentItem[] }>({ type: "jobs:recent" });
    if (r?.ok) setRecent(r.items);
  }
  function openApp(path: string) {
    chrome.tabs.create({ url: `${APP_URL}${path}` });
  }

  if (session === undefined) return <div className="pad muted">Loading…</div>;

  if (!session) {
    return (
      <div className="wrap">
        <Header email={null} onSignOut={signOut} />
        <div className="pad">
          <h2>Connect your account</h2>
          <p className="muted">Sign in to CareerOS AI to save jobs directly from any supported job portal.</p>
          <button className="btn primary block" onClick={connect}>Sign in / Connect</button>
          <div className="hint">You'll be taken to CareerOS and returned automatically once linked.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <Header email={session.user.email ?? null} onSignOut={signOut} />
      <div className="pad">
        <section className="card">
          <div className="row between">
            <h3>Current page</h3>
            {job?.source ? <span className="pill">{job.source}</span> : null}
          </div>
          {scanning ? (
            <div className="muted">Scanning page…</div>
          ) : isSupportedPage ? (
            <>
              <div className="job-title">{job!.role ?? "Untitled role"}</div>
              <div className="job-sub">
                <span>{job!.company ?? "Unknown company"}</span>
                {job!.location ? <><span className="dot">·</span><span>{job!.location}</span></> : null}
              </div>
              {job!.salary ? <div className="muted small">💰 {job!.salary}</div> : null}
              {job!.deadline ? <div className="muted small">🗓 Apply by {job!.deadline}</div> : null}
              {job!.skills.length ? (
                <div className="chips">
                  {job!.skills.slice(0, 8).map((s) => <span key={s} className="chip">{s}</span>)}
                </div>
              ) : null}
              <div className="row gap mt">
                <button className="btn primary grow" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "⚡ Save to CareerOS"}
                </button>
              </div>
              {msg?.id ? (
                <div className="row gap mt">
                  <button className="btn ghost" onClick={() => openApp(`/ai/job-match?applicationId=${msg.id}`)}>AI Job Match</button>
                  <button className="btn ghost" onClick={() => openApp(`/ai/resume-analyzer?applicationId=${msg.id}`)}>Resume Match</button>
                </div>
              ) : null}
              {msg ? <div className={`toast ${msg.kind}`}>{msg.text}</div> : null}
            </>
          ) : (
            <div className="muted">
              No job posting detected here. Open a listing on LinkedIn, Wellfound, Internshala, Naukri, Indeed, Glassdoor, Greenhouse, Lever, or Ashby.
            </div>
          )}
        </section>

        <section className="card">
          <div className="row between">
            <h3>Recent saves</h3>
            <button className="link" onClick={() => openApp("/applications")}>Open Applications →</button>
          </div>
          {recent.length ? (
            <ul className="list">
              {recent.map((r) => (
                <li key={r.id}>
                  <div className="j-title">{r.role}</div>
                  <div className="muted small">{r.company} · {new Date(r.created_at).toLocaleDateString()}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="muted small">No saved jobs yet.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function Header({ email, onSignOut }: { email: string | null; onSignOut: () => void }) {
  return (
    <header className="head">
      <div className="row gap">
        <img src="icon.png" width={22} height={22} alt="" />
        <div>
          <div className="brand">CareerOS AI</div>
          <div className="muted xs">{email ?? "Not signed in"}</div>
        </div>
      </div>
      {email ? <button className="link" onClick={onSignOut}>Sign out</button> : null}
    </header>
  );
}

const el = document.getElementById("root")!;
createRoot(el).render(<Popup />);
