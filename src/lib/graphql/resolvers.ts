import { GraphQLError, GraphQLScalarType, Kind } from "graphql";
import type { Ctx } from "./server.server";
import { afterCursorFilter, clampPageSize, decodeCursor, encodeCursor, paginate } from "./pagination";

const DateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "ISO-8601 timestamp",
  serialize(v) {
    if (v == null) return null;
    if (v instanceof Date) return v.toISOString();
    return String(v);
  },
  parseValue(v) {
    if (typeof v !== "string") throw new GraphQLError("DateTime must be an ISO string");
    return v;
  },
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) throw new GraphQLError("DateTime must be an ISO string");
    return ast.value;
  },
});

const CursorScalar = new GraphQLScalarType({
  name: "Cursor",
  serialize: (v) => (v == null ? null : String(v)),
  parseValue: (v) => (typeof v === "string" ? v : String(v)),
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? ast.value : null),
});

const JSONScalar = new GraphQLScalarType({
  name: "JSON",
  serialize: (v) => v,
  parseValue: (v) => v,
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? JSON.parse(ast.value) : null),
});

const SORT_FIELD_MAP: Record<string, string> = {
  CREATED_AT: "created_at",
  UPDATED_AT: "updated_at",
  COMPANY: "company",
  ROLE: "role",
  DEADLINE: "deadline",
  NAME: "name",
  VERSION: "version",
  DOWNLOAD_COUNT: "download_count",
};

function toRow<T extends Record<string, any>>(row: T | null | undefined) {
  if (!row) return null;
  return {
    ...row,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    targetRole: row.target_role,
    jobUrl: row.job_url,
    followUpAt: row.follow_up_at,
    applicationDate: row.application_date,
    interviewDate: row.interview_date,
    fileSize: row.file_size,
    isActive: row.is_active,
    extractedText: row.extracted_text,
    downloadCount: row.download_count,
    lastDownloadedAt: row.last_downloaded_at,
    referrerName: row.referrer_name,
    reminderDate: row.reminder_date,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    interviewType: row.interview_type,
    overallScore: row.overall_score,
    confidenceScore: row.confidence_score,
    communicationScore: row.communication_score,
    technicalScore: row.technical_score,
    behavioralScore: row.behavioral_score,
    durationSeconds: row.duration_seconds,
  };
}

async function count(ctx: Ctx, table: string, filters: (q: any) => any = (q) => q) {
  ctx.requireAuth();
  const q = filters(ctx.supabase.from(table as any).select("id", { count: "exact", head: true }));
  const { count: c } = await q;
  return c ?? 0;
}

export function buildResolvers() {
  return {
    DateTime: DateTimeScalar,
    Cursor: CursorScalar,
    JSON: JSONScalar,

    Query: {
      apiInfo: () => ({
        name: "CareerOS AI GraphQL API",
        version: "1.0.0",
        pagination: "Relay-style cursor connections",
        auth: "Send Authorization: Bearer <supabase access token>",
        playground: "/api/graphql",
      }),

      async me(_: unknown, __: unknown, ctx: Ctx) {
        if (!ctx.userId) return null;
        const [appsC, resC, intC, refC, aiC] = await Promise.all([
          ctx.supabase.from("applications").select("id", { count: "exact", head: true }).is("deleted_at", null),
          ctx.supabase.from("resumes").select("id", { count: "exact", head: true }).is("deleted_at", null),
          ctx.supabase.from("interview_sessions").select("id", { count: "exact", head: true }),
          ctx.supabase.from("referrals").select("id", { count: "exact", head: true }),
          ctx.supabase.from("ai_analyses").select("id", { count: "exact", head: true }),
        ]);
        const profile = await ctx.loaders.profileById.load(ctx.userId);
        return {
          id: ctx.userId,
          email: ctx.email,
          profile: toRow(profile),
          stats: {
            applications: appsC.count ?? 0,
            resumes: resC.count ?? 0,
            interviews: intC.count ?? 0,
            referrals: refC.count ?? 0,
            aiAnalyses: aiC.count ?? 0,
          },
        };
      },

      async profile(_: unknown, args: { id: string }, ctx: Ctx) {
        ctx.requireAuth();
        return toRow(await ctx.loaders.profileById.load(args.id));
      },

      async applications(_: unknown, args: any, ctx: Ctx) {
        ctx.requireAuth();
        const limit = clampPageSize(args.first);
        const after = decodeCursor(args.after);
        const field = SORT_FIELD_MAP[args.sort?.field ?? "CREATED_AT"] ?? "created_at";
        const asc = (args.sort?.direction ?? "DESC") === "ASC";
        return paginate(async () => {
          let q = ctx.supabase
            .from("applications")
            .select("*", { count: "exact" })
            .is("deleted_at", null)
            .order(field, { ascending: asc })
            .order("id", { ascending: asc })
            .limit(limit + 1);
          const f = args.filter ?? {};
          if (f.status) q = q.eq("status", f.status);
          if (f.company) q = q.ilike("company", `%${f.company}%`);
          if (f.search) q = q.or(`company.ilike.%${f.search}%,role.ilike.%${f.search}%,notes.ilike.%${f.search}%`);
          if (f.createdAfter) q = q.gte("created_at", f.createdAfter);
          if (f.createdBefore) q = q.lte("created_at", f.createdBefore);
          const ac = afterCursorFilter(after);
          if (ac.orClause) q = q.or(ac.orClause);
          const res = await q;
          return { data: (res.data ?? []).map(toRow) as any, error: res.error, count: res.count };
        }, limit);
      },

      async application(_: unknown, args: { id: string }, ctx: Ctx) {
        ctx.requireAuth();
        return toRow(await ctx.loaders.applicationById.load(args.id));
      },

      async resumes(_: unknown, args: any, ctx: Ctx) {
        ctx.requireAuth();
        const limit = clampPageSize(args.first);
        const after = decodeCursor(args.after);
        const field = SORT_FIELD_MAP[args.sort?.field ?? "CREATED_AT"] ?? "created_at";
        const asc = (args.sort?.direction ?? "DESC") === "ASC";
        return paginate(async () => {
          let q = ctx.supabase
            .from("resumes")
            .select("*", { count: "exact" })
            .is("deleted_at", null)
            .order(field, { ascending: asc })
            .order("id", { ascending: asc })
            .limit(limit + 1);
          const f = args.filter ?? {};
          if (f.search) q = q.or(`name.ilike.%${f.search}%,notes.ilike.%${f.search}%`);
          if (f.tag) q = q.contains("tags", [f.tag]);
          if (f.activeOnly) q = q.eq("is_active", true);
          const ac = afterCursorFilter(after);
          if (ac.orClause) q = q.or(ac.orClause);
          const res = await q;
          return { data: (res.data ?? []).map(toRow) as any, error: res.error, count: res.count };
        }, limit);
      },

      async resume(_: unknown, args: { id: string }, ctx: Ctx) {
        ctx.requireAuth();
        return toRow(await ctx.loaders.resumeById.load(args.id));
      },

      aiAnalyses: (_: unknown, args: any, ctx: Ctx) => listAi(ctx, args),
      resumeAnalyses: (_: unknown, args: any, ctx: Ctx) => listAi(ctx, { ...args, filter: { kind: "resume_analysis" } }),
      jobMatches: (_: unknown, args: any, ctx: Ctx) => listAi(ctx, { ...args, filter: { kind: "job_match" } }),
      interviewCoachSessions: (_: unknown, args: any, ctx: Ctx) => listAi(ctx, { ...args, filter: { kind: "interview_prep" } }),
      careerCoachPlans: (_: unknown, args: any, ctx: Ctx) => listAi(ctx, { ...args, filter: { kind: "career_plan" } }),

      async interviewSessions(_: unknown, args: any, ctx: Ctx) {
        ctx.requireAuth();
        const limit = clampPageSize(args.first);
        const after = decodeCursor(args.after);
        return paginate(async () => {
          let q = ctx.supabase
            .from("interview_sessions")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(limit + 1);
          const f = args.filter ?? {};
          if (f.interviewType) q = q.eq("interview_type", f.interviewType);
          if (f.company) q = q.ilike("company", `%${f.company}%`);
          if (f.status) q = q.eq("status", f.status);
          const ac = afterCursorFilter(after);
          if (ac.orClause) q = q.or(ac.orClause);
          const res = await q;
          return { data: (res.data ?? []).map(toRow) as any, error: res.error, count: res.count };
        }, limit);
      },

      async interviewNotes(_: unknown, args: any, ctx: Ctx) {
        ctx.requireAuth();
        const limit = clampPageSize(args.first);
        const after = decodeCursor(args.after);
        return paginate(async () => {
          let q = ctx.supabase
            .from("interview_notes")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(limit + 1);
          const ac = afterCursorFilter(after);
          if (ac.orClause) q = q.or(ac.orClause);
          const res = await q;
          return { data: (res.data ?? []).map(toRow) as any, error: res.error, count: res.count };
        }, limit);
      },

      async referrals(_: unknown, args: any, ctx: Ctx) {
        ctx.requireAuth();
        const limit = clampPageSize(args.first);
        const after = decodeCursor(args.after);
        return paginate(async () => {
          let q = ctx.supabase
            .from("referrals")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(limit + 1);
          const ac = afterCursorFilter(after);
          if (ac.orClause) q = q.or(ac.orClause);
          const res = await q;
          return { data: (res.data ?? []).map(toRow) as any, error: res.error, count: res.count };
        }, limit);
      },

      async analytics(_: unknown, __: unknown, ctx: Ctx) {
        ctx.requireAuth();
        const [apps, sessions, resumes] = await Promise.all([
          ctx.supabase.from("applications").select("status, created_at").is("deleted_at", null),
          ctx.supabase.from("interview_sessions").select("overall_score, created_at"),
          count(ctx, "resumes", (q) => q.is("deleted_at", null)),
        ]);
        const rows = apps.data ?? [];
        const byStatusMap = new Map<string, number>();
        for (const r of rows) byStatusMap.set(r.status as string, (byStatusMap.get(r.status as string) ?? 0) + 1);
        const byStatus = Array.from(byStatusMap.entries()).map(([status, c]) => ({ status, count: c }));
        const weekMap = new Map<string, number>();
        for (const r of rows) {
          const d = new Date(r.created_at as string);
          const monday = new Date(d);
          monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
          const key = monday.toISOString().slice(0, 10);
          weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
        }
        const applicationsPerWeek = Array.from(weekMap.entries())
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([date, c]) => ({ date, count: c }));
        const scores = (sessions.data ?? []).map((s) => Number(s.overall_score)).filter((n) => Number.isFinite(n));
        const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
        const last = rows.length ? rows.map((r) => r.created_at as string).sort().pop() : null;
        const bucketFor = (needle: string) => byStatusMap.get(needle) ?? 0;
        return {
          totalApplications: rows.length,
          activeApplications: rows.filter((r) => !["rejected", "withdrawn", "offer"].includes(String(r.status))).length,
          interviewsScheduled: bucketFor("interview") + bucketFor("interviewing"),
          offers: bucketFor("offer"),
          rejections: bucketFor("rejected"),
          byStatus,
          applicationsPerWeek,
          averageInterviewScore: avg,
          resumeCount: resumes,
          lastActivityAt: last,
        };
      },

      async notifications(_: unknown, args: any, ctx: Ctx) {
        ctx.requireAuth();
        const limit = clampPageSize(args.first);
        const after = decodeCursor(args.after);
        let q = ctx.supabase
          .from("application_activities")
          .select("id, type, message, meta, application_id, created_at", { count: "exact" })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(limit + 1);
        const ac = afterCursorFilter(after);
        if (ac.orClause) q = q.or(ac.orClause);
        const res = await q;
        if (res.error) throw new GraphQLError(res.error.message);
        const rows = res.data ?? [];
        const hasNext = rows.length > limit;
        const trimmed = hasNext ? rows.slice(0, limit) : rows;
        const nodes = trimmed.map((r) => ({
          id: r.id,
          kind: r.type,
          title: r.message ?? r.type,
          body: null,
          entityId: r.application_id,
          createdAt: r.created_at,
          read: false,
        }));
        return {
          nodes,
          totalCount: res.count ?? nodes.length,
          pageInfo: {
            hasNextPage: hasNext,
            hasPreviousPage: false,
            startCursor: nodes[0] ? encodeCursor({ ts: nodes[0].createdAt as string, id: nodes[0].id }) : null,
            endCursor: nodes.at(-1) ? encodeCursor({ ts: nodes.at(-1)!.createdAt as string, id: nodes.at(-1)!.id }) : null,
          },
        };
      },
    },

    Application: {
      activities: async (parent: { id: string }, args: { first?: number }, ctx: Ctx) => {
        const rows = await ctx.loaders.activitiesByApplication.load(parent.id);
        const limit = clampPageSize(args.first, 20, 100);
        return rows.slice(0, limit).map(toRow);
      },
    },

    Mutation: {
      async updateProfile(_: unknown, args: { input: any }, ctx: Ctx) {
        const uid = ctx.requireAuth();
        const patch: Record<string, unknown> = {};
        if (args.input.fullName !== undefined) patch.full_name = args.input.fullName;
        if (args.input.headline !== undefined) patch.headline = args.input.headline;
        if (args.input.targetRole !== undefined) patch.target_role = args.input.targetRole;
        if (args.input.avatarUrl !== undefined) patch.avatar_url = args.input.avatarUrl;
        const { data, error } = await ctx.supabase.from("profiles").update(patch as any).eq("id", uid).select("*").maybeSingle();
        if (error) throw new GraphQLError(error.message);
        return toRow(data);
      },

      async createApplication(_: unknown, args: { input: any }, ctx: Ctx) {
        const uid = ctx.requireAuth();
        const i = args.input;
        if (!i.company?.trim() || !i.role?.trim()) throw new GraphQLError("company and role are required", { extensions: { code: "BAD_USER_INPUT" } });
        const { data, error } = await ctx.supabase
          .from("applications")
          .insert({
            user_id: uid,
            company: i.company,
            role: i.role,
            location: i.location,
            salary: i.salary,
            status: i.status ?? "saved",
            job_url: i.jobUrl,
            recruiter: i.recruiter,
            notes: i.notes,
            deadline: i.deadline,
          })
          .select("*")
          .single();
        if (error) throw new GraphQLError(error.message);
        return toRow(data);
      },

      async updateApplication(_: unknown, args: { id: string; input: any }, ctx: Ctx) {
        ctx.requireAuth();
        const i = args.input as Record<string, unknown>;
        const patch: Record<string, unknown> = {};
        const map: Record<string, string> = {
          company: "company", role: "role", location: "location", salary: "salary",
          status: "status", jobUrl: "job_url", recruiter: "recruiter", notes: "notes",
          deadline: "deadline", followUpAt: "follow_up_at",
        };
        for (const [gql, col] of Object.entries(map)) if (i[gql] !== undefined) patch[col] = i[gql];
        const { data, error } = await ctx.supabase.from("applications").update(patch as any).eq("id", args.id).select("*").maybeSingle();
        if (error) throw new GraphQLError(error.message);
        if (!data) throw new GraphQLError("Application not found", { extensions: { code: "NOT_FOUND" } });
        return toRow(data);
      },

      async deleteApplication(_: unknown, args: { id: string }, ctx: Ctx) {
        ctx.requireAuth();
        const { error } = await ctx.supabase.from("applications").update({ deleted_at: new Date().toISOString() }).eq("id", args.id);
        if (error) throw new GraphQLError(error.message);
        return true;
      },

      async createReferral(_: unknown, args: { input: any }, ctx: Ctx) {
        const uid = ctx.requireAuth();
        const i = args.input;
        const { data, error } = await ctx.supabase
          .from("referrals")
          .insert({
            user_id: uid,
            referrer_name: i.referrerName,
            company: i.company,
            email: i.email,
            linkedin: i.linkedin,
            status: i.status ?? "pending",
            notes: i.notes,
            reminder_date: i.reminderDate,
          })
          .select("*")
          .single();
        if (error) throw new GraphQLError(error.message);
        return toRow(data);
      },

      async deleteReferral(_: unknown, args: { id: string }, ctx: Ctx) {
        ctx.requireAuth();
        const { error } = await ctx.supabase.from("referrals").delete().eq("id", args.id);
        if (error) throw new GraphQLError(error.message);
        return true;
      },

      async createInterviewNote(_: unknown, args: { input: any }, ctx: Ctx) {
        const uid = ctx.requireAuth();
        const i = args.input;
        const { data, error } = await ctx.supabase
          .from("interview_notes")
          .insert({
            user_id: uid,
            application_id: i.applicationId ?? null,
            company: i.company,
            round: i.round,
            questions: i.questions,
            feedback: i.feedback,
            mistakes: i.mistakes,
            learning: i.learning,
            rating: i.rating,
            interview_date: i.interviewDate,
          })
          .select("*")
          .single();
        if (error) throw new GraphQLError(error.message);
        return toRow(data);
      },

      async deleteInterviewNote(_: unknown, args: { id: string }, ctx: Ctx) {
        ctx.requireAuth();
        const { error } = await ctx.supabase.from("interview_notes").delete().eq("id", args.id);
        if (error) throw new GraphQLError(error.message);
        return true;
      },

      async deleteAiAnalysis(_: unknown, args: { id: string }, ctx: Ctx) {
        ctx.requireAuth();
        const { error } = await ctx.supabase.from("ai_analyses").delete().eq("id", args.id);
        if (error) throw new GraphQLError(error.message);
        return true;
      },
    },
  };
}

async function listAi(ctx: Ctx, args: any) {
  ctx.requireAuth();
  const limit = clampPageSize(args.first);
  const after = decodeCursor(args.after);
  return paginate(async () => {
    let q = ctx.supabase
      .from("ai_analyses")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);
    const f = args.filter ?? {};
    if (f.kind) q = q.eq("kind", f.kind);
    if (f.search) q = q.ilike("title", `%${f.search}%`);
    const ac = afterCursorFilter(after);
    if (ac.orClause) q = q.or(ac.orClause);
    const res = await q;
    return { data: (res.data ?? []).map(toRow) as any, error: res.error, count: res.count };
  }, limit);
}
