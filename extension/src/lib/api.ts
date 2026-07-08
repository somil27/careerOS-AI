import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config";
import type { JobPayload, Session } from "../types";

function headers(session: Session) {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session.access_token}`,
  } as Record<string, string>;
}

export async function refreshSession(session: Session): Promise<Session | null> {
  if (!session.refresh_token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    user: { id: data.user?.id ?? session.user.id, email: data.user?.email ?? session.user.email },
  };
}

async function withAuth<T>(session: Session, fn: (s: Session) => Promise<Response>): Promise<{ data: T; session: Session }> {
  let s = session;
  if (s.expires_at && s.expires_at * 1000 < Date.now() + 60_000) {
    const refreshed = await refreshSession(s);
    if (refreshed) s = refreshed;
  }
  let res = await fn(s);
  if (res.status === 401) {
    const refreshed = await refreshSession(s);
    if (refreshed) {
      s = refreshed;
      res = await fn(s);
    }
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = res.status === 204 ? (undefined as unknown as T) : ((await res.json()) as T);
  return { data, session: s };
}

export async function findDuplicate(session: Session, job: JobPayload) {
  const filters: string[] = [];
  if (job.apply_url) filters.push(`job_url.eq.${encodeURIComponent(job.apply_url)}`);
  const nameFilter =
    job.company && job.role ? `and(company.ilike.${encodeURIComponent(job.company)},role.ilike.${encodeURIComponent(job.role)})` : null;
  if (nameFilter) filters.push(nameFilter);
  if (!filters.length) return { data: [] as { id: string }[], session };
  const or = filters.join(",");
  const url = `${SUPABASE_URL}/rest/v1/applications?select=id,company,role,job_url,created_at&deleted_at=is.null&or=(${or})&limit=1`;
  return withAuth<{ id: string }[]>(session, (s) => fetch(url, { headers: headers(s) }));
}

export async function insertApplication(session: Session, job: JobPayload) {
  const noteLines = [
    `Saved via CareerOS Extension · source: ${job.source}`,
    job.skills.length ? `Skills: ${job.skills.join(", ")}` : "",
    job.description ? `\n---\n${job.description.slice(0, 8000)}` : "",
  ].filter(Boolean);
  const body = [
    {
      user_id: session.user.id,
      company: job.company ?? "Unknown company",
      role: job.role ?? "Unknown role",
      location: job.location,
      salary: job.salary,
      job_url: job.apply_url,
      recruiter: job.recruiter,
      deadline: job.deadline,
      status: "saved",
      notes: noteLines.join("\n"),
    },
  ];
  const url = `${SUPABASE_URL}/rest/v1/applications`;
  return withAuth<{ id: string; company: string; role: string }[]>(session, (s) =>
    fetch(url, { method: "POST", headers: { ...headers(s), Prefer: "return=representation" }, body: JSON.stringify(body) }),
  );
}

export async function recentApplications(session: Session) {
  const url = `${SUPABASE_URL}/rest/v1/applications?select=id,company,role,job_url,status,created_at&deleted_at=is.null&order=created_at.desc&limit=6`;
  return withAuth<{ id: string; company: string; role: string; job_url: string | null; status: string; created_at: string }[]>(
    session,
    (s) => fetch(url, { headers: headers(s) }),
  );
}
