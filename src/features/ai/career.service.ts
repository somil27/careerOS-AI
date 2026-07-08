import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGemini, parseJSON } from "@/lib/gemini";
import { careerSchema } from "./schemas";
import { emptyCareerPlan, type CareerPlan } from "./types";

function verifyCareerPlan(x: any): CareerPlan {
  const base = emptyCareerPlan;
  const out: any = { ...base, ...(x ?? {}) };
  out.insights = String(x?.insights ?? "");
  for (const k of Object.keys(base)) {
    if (k === "insights") continue;
    if (!Array.isArray(out[k])) out[k] = [];
  }
  return out as CareerPlan;
}

export const careerCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    resume_text: z.string().optional(),
    target_role: z.string().optional(),
    years_experience: z.number().optional(),
    location: z.string().optional(),
    current_title: z.string().optional(),
    context_summary: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: apps }, { data: goals }, { data: skills }] = await Promise.all([
      context.supabase.from("applications").select("status, company, role, created_at").order("created_at", { ascending: false }).limit(50),
      context.supabase.from("career_goals").select("title, category, status, progress, priority, target_date").order("created_at", { ascending: false }).limit(30),
      context.supabase.from("career_skills").select("name, category, current_level, target_level, priority").order("priority", { ascending: true }).limit(50),
    ]);
    const stats = (apps ?? []).reduce<Record<string, number>>((acc, a: any) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc; }, {});

    const system = "You are a Principal-level career strategist with FAANG hiring experience. Give specific, opinionated, evidence-based, personalized guidance. Reference the user's actual goals, skills, and application activity. Output STRICT JSON matching the schema exactly.";
    const user = `Build a deeply personalized career development plan.

USER CONTEXT
- Target role: ${data.target_role ?? "not specified"}
- Current title: ${data.current_title ?? "not specified"}
- Years experience: ${data.years_experience ?? "n/a"}
- Location: ${data.location ?? "remote / n/a"}
- Notes: ${data.context_summary ?? "none"}

APPLICATION ACTIVITY (last 50): ${JSON.stringify(stats)}
CURRENT GOALS: ${JSON.stringify(goals ?? [])}
TRACKED SKILLS: ${JSON.stringify(skills ?? [])}
${data.resume_text ? `RESUME:\n${data.resume_text.slice(0, 5000)}` : ""}

Rules:
- insights: 4-6 sentence narrative that references the user's actual data.
- weekly_roadmap: 7 items (Monday..Sunday) with day, focus, 3-5 tasks, hours (0.5-6), concrete outcome.
- monthly_roadmap: 4 items (Week 1..Week 4) with theme, 2-4 milestones, 2-4 concrete deliverables.
- skill_recommendations: 6-10 skills with realistic current_level/target_level (0-100) grounded in resume+tracked skills; do NOT duplicate skills already tracked at same or higher level.
- goal_recommendations: 4-6 SMART goals with timeframe_weeks (1-24); do NOT duplicate existing goals.
- learning_recommendations: 6-10 concrete real resources (Coursera/Udemy/Frontend Masters/O'Reilly/official docs/YouTube channels) with duration and why.
- internship_recommendations: 4-8 realistic internship, apprenticeship, fellowship, or residency targets appropriate to the user's level.
- company_recommendations: 8-12 companies split across tier reach/target/safety with 1-3 open-ish roles each.
- technology_recommendations: 6-10 technologies/tools/frameworks with priority + why.
- certification_recommendations: 4-6 real certifications with realistic cost_estimate and duration.
Every recommendation must include a "why" tied to this user's context.`;
    const out = await callGemini(system, user, careerSchema);
    const parsed = verifyCareerPlan(parseJSON(out, emptyCareerPlan));

    await context.supabase.from("career_profile").upsert({
      user_id: context.userId,
      target_role: data.target_role ?? null,
      years_experience: data.years_experience ?? null,
      location: data.location ?? null,
      current_title: data.current_title ?? null,
      context_summary: data.context_summary ?? null,
    });

    await context.supabase.from("ai_analyses").insert({
      user_id: context.userId,
      kind: "career_coach",
      title: data.target_role ? `Career plan · ${data.target_role}` : "Career plan",
      input: { target_role: data.target_role, years_experience: data.years_experience, location: data.location, current_title: data.current_title, context_summary: data.context_summary },
      output: parsed,
    });
    return parsed;
  });
