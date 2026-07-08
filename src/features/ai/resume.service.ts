import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGemini, parseJSON } from "@/lib/gemini";
import { resumeAnalysisSchema, resumeCompareSchema } from "./schemas";
import { emptyResumeAnalysis, type ResumeAnalysis } from "./types";

function verifyResumeAnalysis(x: any): ResumeAnalysis {
  const base = emptyResumeAnalysis;
  const out: any = { ...base, ...x };
  out.ats_score = Math.max(0, Math.min(100, Number(x?.ats_score) || 0));
  out.sections = { ...base.sections, ...(x?.sections ?? {}) };
  for (const k of Object.keys(base.sections) as Array<keyof typeof base.sections>) {
    const s = out.sections[k] ?? {};
    out.sections[k] = {
      score: Math.max(0, Math.min(100, Number(s.score) || 0)),
      findings: Array.isArray(s.findings) ? s.findings : [],
      recommendations: Array.isArray(s.recommendations) ? s.recommendations : [],
    };
  }
  out.readability = { ...base.readability, ...(x?.readability ?? {}) };
  out.readability.score = Math.max(0, Math.min(100, Number(out.readability.score) || 0));
  out.experience_analysis = { ...base.experience_analysis, ...(x?.experience_analysis ?? {}) };
  out.project_analysis = { ...base.project_analysis, ...(x?.project_analysis ?? {}) };
  out.education_analysis = { ...base.education_analysis, ...(x?.education_analysis ?? {}) };
  out.achievements_analysis = { ...base.achievements_analysis, ...(x?.achievements_analysis ?? {}) };
  for (const k of ["strengths", "missing_skills", "keyword_match", "grammar_issues", "formatting_issues", "improvements", "keyword_heatmap", "skill_gaps", "improvement_checklist"]) {
    if (!Array.isArray(out[k])) out[k] = [];
  }
  return out as ResumeAnalysis;
}

export const analyzeResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    resume_text: z.string().min(20),
    target_role: z.string().optional(),
    job_description: z.string().optional(),
    resume_id: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const system = "You are a Principal-level technical recruiter, ATS specialist, and resume coach. Be precise, opinionated, and evidence-based. Output STRICT JSON matching the schema exactly.";
    const user = `Deeply analyze this resume${data.target_role ? ` for target role "${data.target_role}"` : ""}${data.job_description ? " against the provided job description" : ""}. Fill every field.

Rules:
- ats_score (0-100) with a 2-3 sentence ats_explanation grounded in specific evidence (missing sections, keyword coverage, formatting risks, quantification).
- sections.{contact,summary,experience,education,skills,projects,achievements}: each with score (0-100), findings (evidence), recommendations (actionable).
- keyword_heatmap: 15-25 role-relevant keywords with count (occurrences in resume), importance, present.
- skill_gaps: top skills missing vs target/JD with why they matter.
- readability: recruiter readability score (0-100), grade_level (e.g., "Grade 9"), notes (sentence length, jargon, bullet clarity).
- experience_analysis: impact_score (0-100), count quantified vs total bullets, findings, recommendations.
- project_analysis, education_analysis, achievements_analysis: findings + recommendations. achievements_analysis.quantified lists concrete metrics found.
- improvement_checklist: 8-15 items with priority and category (Keywords|Formatting|Impact|Skills|Grammar|Section).
- improvements: prioritized specific rewrites.
- missing_skills, keyword_match, strengths, grammar_issues, formatting_issues: concise arrays.

${data.job_description ? `JOB DESCRIPTION:\n${data.job_description}\n\n` : ""}RESUME:\n${data.resume_text}`;
    const out = await callGemini(system, user, resumeAnalysisSchema);
    const parsed = verifyResumeAnalysis(parseJSON(out, emptyResumeAnalysis));
    await context.supabase.from("ai_analyses").insert({
      user_id: context.userId,
      kind: "resume_analysis",
      title: data.target_role ?? "Resume analysis",
      input: { target_role: data.target_role, job_description: data.job_description, resume_id: data.resume_id },
      output: parsed,
    });
    return parsed;
  });

export const compareResumes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    resume_a: z.string().min(20),
    resume_b: z.string().min(20),
    label_a: z.string().optional(),
    label_b: z.string().optional(),
    target_role: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const system = "You are a senior technical recruiter comparing two resume versions. Be specific and evidence-based. Strict JSON only.";
    const user = `Compare Resume A ("${data.label_a ?? "A"}") vs Resume B ("${data.label_b ?? "B"}")${data.target_role ? ` for target role "${data.target_role}"` : ""}. Score both (0-100), pick a winner, list improvements B made over A, regressions, keyword_delta (added/removed keywords going A→B), and recommendations.\n\nRESUME A:\n${data.resume_a}\n\nRESUME B:\n${data.resume_b}`;
    const out = await callGemini(system, user, resumeCompareSchema);
    const fallback = { winner: "tie", verdict: "", score_a: 0, score_b: 0, improvements_a_to_b: [], regressions_a_to_b: [], keyword_delta: { added: [], removed: [] }, recommendations: [] };
    const parsed = parseJSON(out, fallback);
    await context.supabase.from("ai_analyses").insert({
      user_id: context.userId,
      kind: "resume_compare",
      title: `${data.label_a ?? "A"} vs ${data.label_b ?? "B"}`,
      input: { label_a: data.label_a, label_b: data.label_b, target_role: data.target_role },
      output: parsed,
    });
    return parsed;
  });
