import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGemini, parseJSON } from "@/lib/gemini";
import { jobMatchSchema } from "./schemas";
import { emptyJobMatch, type JobMatchResult } from "./types";

function verifyJobMatch(x: any): JobMatchResult {
  const base = emptyJobMatch;
  const out: any = { ...base, ...(x ?? {}) };
  out.match_percentage = Math.max(0, Math.min(100, Number(x?.match_percentage) || 0));
  out.skills_match = { ...base.skills_match, ...(x?.skills_match ?? {}) };
  out.skills_match.score = Math.max(0, Math.min(100, Number(out.skills_match.score) || 0));
  out.technology_match = { ...base.technology_match, ...(x?.technology_match ?? {}) };
  out.technology_match.score = Math.max(0, Math.min(100, Number(out.technology_match.score) || 0));
  out.interview_probability = { ...base.interview_probability, ...(x?.interview_probability ?? {}) };
  out.interview_probability.score = Math.max(0, Math.min(100, Number(out.interview_probability.score) || 0));
  out.salary_estimate = { ...base.salary_estimate, ...(x?.salary_estimate ?? {}) };
  for (const k of ["missing_skills", "missing_technologies", "missing_soft_skills", "strengths", "weaknesses", "improvements", "learning_roadmap", "recommended_certifications", "recommended_projects"]) {
    if (!Array.isArray(out[k])) out[k] = [];
  }
  for (const g of ["skills_match", "technology_match"] as const) {
    if (!Array.isArray(out[g].matched)) out[g].matched = [];
    if (!Array.isArray(out[g].partial)) out[g].partial = [];
  }
  return out as JobMatchResult;
}

export const matchJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    resume_text: z.string().min(20),
    job_description: z.string().min(20),
    company: z.string().optional(),
    role: z.string().optional(),
    location: z.string().optional(),
    years_experience: z.number().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const system = "You are a Principal-level technical recruiter and career strategist at a FAANG company. Be precise, opinionated, and evidence-based. Output STRICT JSON matching the schema exactly.";
    const user = `Deeply analyze fit between the resume and the job description${data.role ? ` for ${data.role}` : ""}${data.company ? ` at ${data.company}` : ""}${data.location ? ` in ${data.location}` : ""}. Fill every field.

Rules:
- match_percentage (0-100) is overall fit; verdict is a 1-2 sentence recruiter-style summary.
- skills_match: score (0-100), matched hard skills (present in both), partial (adjacent/related).
- technology_match: same shape but for specific technologies/tools/frameworks/languages.
- missing_skills, missing_technologies, missing_soft_skills: prioritized concise arrays.
- salary_estimate: realistic market range for ${data.location || "the role's typical region"} with currency (ISO), min/median/max annual base in that currency, region label, and a 1-2 sentence notes explaining assumptions.
- interview_probability: score (0-100) that this candidate lands a first-round interview, with 2-3 sentence reasoning.
- learning_roadmap: 4-8 items covering ~1-8 weeks with week label ("Week 1", "Weeks 2-3"), focus, 2-4 resources (books/courses/docs), concrete outcome.
- recommended_certifications: 2-5 real, relevant certifications (name, provider, why).
- recommended_projects: 2-4 portfolio project ideas (title, 1-2 sentence description, skills exercised).
- strengths, weaknesses, improvements: concise, specific, evidence-based.

${data.years_experience ? `Candidate years of experience: ${data.years_experience}\n` : ""}JOB DESCRIPTION:
${data.job_description}

RESUME:
${data.resume_text}`;
    const out = await callGemini(system, user, jobMatchSchema);
    const parsed = verifyJobMatch(parseJSON(out, emptyJobMatch));
    await context.supabase.from("ai_analyses").insert({
      user_id: context.userId,
      kind: "job_match",
      title: [data.role, data.company].filter(Boolean).join(" @ ") || "Job match",
      input: { company: data.company, role: data.role, location: data.location, years_experience: data.years_experience, job_description: data.job_description.slice(0, 4000) },
      output: parsed,
    });
    return parsed;
  });
