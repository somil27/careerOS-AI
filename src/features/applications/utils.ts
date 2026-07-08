export type App = {
  id: string;
  user_id: string;
  company: string;
  role: string;
  location: string | null;
  salary: string | null;
  application_date: string | null;
  deadline: string | null;
  status: string;
  job_url: string | null;
  recruiter: string | null;
  notes: string | null;
  referral_status: string | null;
  follow_up_at: string | null;
  deleted_at: string | null;
  board_order: number;
  created_at: string;
  updated_at: string;
};

export const STATUSES = ["applied", "oa", "interview", "hr", "offer", "rejected", "joined"] as const;
export type Status = (typeof STATUSES)[number];

export type FilterState = {
  q: string;
  statuses: string[];
  locations: string[];
  companies: string[];
  hasDeadline: boolean;
  hasFollowUp: boolean;
  hasReferral: boolean;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortDir: "asc" | "desc";
};

export const emptyFilter: FilterState = {
  q: "",
  statuses: [],
  locations: [],
  companies: [],
  hasDeadline: false,
  hasFollowUp: false,
  hasReferral: false,
  dateFrom: "",
  dateTo: "",
  sortBy: "created_at",
  sortDir: "desc",
};

/** Smart search: matches tokens against multiple fields; supports company:foo status:offer */
export function smartMatch(a: App, q: string): boolean {
  if (!q.trim()) return true;
  const tokens = q.toLowerCase().match(/(\w+:[^\s]+|"[^"]+"|\S+)/g) ?? [];
  for (const raw of tokens) {
    const t = raw.replace(/^"|"$/g, "");
    const kv = t.match(/^(\w+):(.+)$/);
    if (kv) {
      const key = kv[1];
      const val = kv[2];
      const hay = String((a as unknown as Record<string, unknown>)[key] ?? "").toLowerCase();
      if (!hay.includes(val)) return false;
    } else {
      const blob = [a.company, a.role, a.location, a.recruiter, a.notes, a.status, a.referral_status]
        .filter(Boolean).join(" ").toLowerCase();
      if (!blob.includes(t)) return false;
    }
  }
  return true;
}

export function applyFilter(apps: App[], f: FilterState): App[] {
  let r = apps.filter((a) => !a.deleted_at);
  if (f.statuses.length) r = r.filter((a) => f.statuses.includes(a.status));
  if (f.locations.length) r = r.filter((a) => a.location && f.locations.includes(a.location));
  if (f.companies.length) r = r.filter((a) => f.companies.includes(a.company));
  if (f.hasDeadline) r = r.filter((a) => !!a.deadline);
  if (f.hasFollowUp) r = r.filter((a) => !!a.follow_up_at);
  if (f.hasReferral) r = r.filter((a) => !!a.referral_status);
  if (f.dateFrom) r = r.filter((a) => (a.application_date ?? "") >= f.dateFrom);
  if (f.dateTo) r = r.filter((a) => (a.application_date ?? "") <= f.dateTo);
  r = r.filter((a) => smartMatch(a, f.q));
  r = [...r].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[f.sortBy] as string | number | null;
    const bv = (b as unknown as Record<string, unknown>)[f.sortBy] as string | number | null;
    if (av == null) return 1;
    if (bv == null) return -1;
    const c = av < bv ? -1 : av > bv ? 1 : 0;
    return f.sortDir === "asc" ? c : -c;
  });
  return r;
}

const SF_KEY = "careeros:saved-filters:v1";
const DRAFT_KEY = "careeros:app-draft:v1";

export type SavedFilter = { id: string; name: string; filter: FilterState };

export function loadSavedFilters(): SavedFilter[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SF_KEY) ?? "[]");
  } catch {
    return [];
  }
}
export function persistSavedFilters(list: SavedFilter[]) {
  localStorage.setItem(SF_KEY, JSON.stringify(list));
}

export function loadDraft(): Partial<App> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
  } catch {
    return null;
  }
}
export function saveDraft(d: Partial<App> | null) {
  if (!d) localStorage.removeItem(DRAFT_KEY);
  else localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
}
