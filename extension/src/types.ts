export type Session = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: { id: string; email?: string };
};

export type JobPayload = {
  source: string;
  company: string | null;
  role: string | null;
  location: string | null;
  salary: string | null;
  description: string | null;
  skills: string[];
  recruiter: string | null;
  apply_url: string;
  deadline: string | null; // ISO date
};

export type ExtMessage =
  | { type: "auth:set"; session: Session }
  | { type: "auth:get" }
  | { type: "auth:clear" }
  | { type: "job:extract" }
  | { type: "job:save"; job: JobPayload }
  | { type: "jobs:recent" }
  | { type: "ping" };
