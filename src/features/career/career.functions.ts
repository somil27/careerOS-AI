import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ===== Profile =====
export const getCareerProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("career_profile").select("*").eq("user_id", context.userId).maybeSingle();
    return data;
  });

export const upsertCareerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    target_role: z.string().nullable().optional(),
    years_experience: z.number().nullable().optional(),
    location: z.string().nullable().optional(),
    current_title: z.string().nullable().optional(),
    context_summary: z.string().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("career_profile")
      .upsert({ user_id: context.userId, ...data })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ===== Goals =====
export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("career_goals").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const goalInput = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  target_date: z.string().nullable().optional(),
  status: z.enum(["active", "completed", "paused", "archived"]).default("active"),
  progress: z.number().min(0).max(100).default(0),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
});

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => goalInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("career_goals").insert({ user_id: context.userId, ...data }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    patch: goalInput.partial(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("career_goals").update(data.patch).eq("id", data.id).eq("user_id", context.userId).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("career_goals").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Skills =====
export const listSkills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("career_skills").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const skillInput = z.object({
  name: z.string().min(1),
  category: z.string().nullable().optional(),
  current_level: z.number().min(0).max(100).default(0),
  target_level: z.number().min(0).max(100).default(100),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  notes: z.string().nullable().optional(),
  last_practiced_at: z.string().nullable().optional(),
});

export const createSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => skillInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("career_skills").insert({ user_id: context.userId, ...data }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    patch: skillInput.partial(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("career_skills").update(data.patch).eq("id", data.id).eq("user_id", context.userId).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("career_skills").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Plan history =====
export const listCareerPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_analyses").select("id, title, created_at, output, input").eq("kind", "career_coach").order("created_at", { ascending: false }).limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ===== Dashboard =====
export const getCareerDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: goals }, { data: skills }, { data: apps }, { data: plans }] = await Promise.all([
      context.supabase.from("career_goals").select("status, progress, priority"),
      context.supabase.from("career_skills").select("current_level, target_level, priority"),
      context.supabase.from("applications").select("status, created_at"),
      context.supabase.from("ai_analyses").select("created_at").eq("kind", "career_coach").order("created_at", { ascending: false }).limit(1),
    ]);
    const gs = goals ?? [];
    const ss = skills ?? [];
    const as = apps ?? [];
    const goalProgress = gs.length ? Math.round(gs.reduce((s: number, g: any) => s + (g.progress || 0), 0) / gs.length) : 0;
    const skillProgress = ss.length
      ? Math.round(
          ss.reduce((s: number, sk: any) => {
            const target = Math.max(1, Number(sk.target_level) || 100);
            return s + Math.min(100, (Number(sk.current_level) || 0) / target * 100);
          }, 0) / ss.length,
        )
      : 0;
    return {
      counts: {
        goals_active: gs.filter((g: any) => g.status === "active").length,
        goals_completed: gs.filter((g: any) => g.status === "completed").length,
        skills_tracked: ss.length,
        applications: as.length,
      },
      goal_progress: goalProgress,
      skill_progress: skillProgress,
      last_plan_at: plans?.[0]?.created_at ?? null,
    };
  });

// ===== Adopt AI recommendations =====
export const adoptRecommendedGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string(), description: z.string().optional(), category: z.string().optional(),
    priority: z.enum(["high", "medium", "low"]).default("medium"), timeframe_weeks: z.number().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const target_date = data.timeframe_weeks
      ? new Date(Date.now() + data.timeframe_weeks * 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
      : null;
    const { data: row, error } = await context.supabase
      .from("career_goals").insert({
        user_id: context.userId, title: data.title, description: data.description ?? null,
        category: data.category ?? null, priority: data.priority, target_date, status: "active", progress: 0,
      }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adoptRecommendedSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    name: z.string(), category: z.string().optional(),
    current_level: z.number().default(0), target_level: z.number().default(100),
    priority: z.enum(["high", "medium", "low"]).default("medium"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("career_skills").insert({
        user_id: context.userId, name: data.name, category: data.category ?? null,
        current_level: data.current_level, target_level: data.target_level, priority: data.priority,
      }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });
