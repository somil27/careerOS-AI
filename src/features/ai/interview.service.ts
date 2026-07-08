import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGemini, parseJSON } from "@/lib/gemini";
import { interviewSchema, starSchema, scoreSchema } from "./schemas";
import { emptyInterviewPrep } from "./types";

export const interviewPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    company: z.string().min(1),
    role: z.string().min(1),
    job_description: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
    resume_text: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const system = "You are a Principal-level interview coach who has prepped engineers for FAANG, unicorn startups, and top consultancies. Be specific, evidence-based, and opinionated. Output STRICT JSON matching the schema exactly.";
    const diff = data.difficulty === "mixed" ? "a realistic mix of easy/medium/hard" : `weighted toward ${data.difficulty}`;
    const user = `Build a comprehensive interview prep package for ${data.role} at ${data.company}. Question difficulty should be ${diff}.

Rules:
- company_research: 4-6 sentence overview (mission, products, scale, engineering culture, interview reputation).
- culture_notes: 4-6 bullets on what they value.
- recent_news: 3-5 concrete recent developments (label older items with year).
- behavioral: 8 questions with difficulty, why_asked, star_hint.
- technical: 8 role-specific questions. Same shape.
- coding: 5 problems with title, prompt (2-4 sentences), difficulty, topics, approach (optimal strategy), complexity (Big-O).
- hr: 5 questions (comp, notice, motivation, offers). Same shape.
- coding_tips: 6 actionable execution tips.
- red_flags: 4-6 answers/behaviors to AVOID for this specific company.
- questions_to_ask: 6 sharp questions the candidate should ask.

${data.job_description ? `JOB DESCRIPTION:\n${data.job_description}\n\n` : ""}${data.resume_text ? `CANDIDATE RESUME (tailor to gaps/strengths):\n${data.resume_text.slice(0, 4000)}\n` : ""}`;
    const out = await callGemini(system, user, interviewSchema);
    const parsed = { ...emptyInterviewPrep, ...parseJSON(out, emptyInterviewPrep) };
    for (const k of ["culture_notes", "recent_news", "behavioral", "technical", "coding", "hr", "coding_tips", "red_flags", "questions_to_ask"] as const) {
      if (!Array.isArray((parsed as any)[k])) (parsed as any)[k] = [];
    }
    await context.supabase.from("ai_analyses").insert({
      user_id: context.userId,
      kind: "interview_prep",
      title: `${data.role} @ ${data.company}`,
      input: { company: data.company, role: data.role, difficulty: data.difficulty },
      output: parsed,
    });
    return parsed;
  });

export const generateStarAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    question: z.string().min(3),
    notes: z.string().min(3),
    role: z.string().optional(),
    company: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const system = "You are an executive interview coach. Craft STAR (Situation, Task, Action, Result) answers that are specific, quantified, and 60-90 seconds when spoken. Strict JSON.";
    const user = `Question: ${data.question}\n${data.role ? `Role: ${data.role}\n` : ""}${data.company ? `Company: ${data.company}\n` : ""}Candidate notes / raw story:\n${data.notes}\n\nReturn a full STAR breakdown plus a polished_answer that reads as a single spoken response (~150-220 words), and 3-5 delivery tips.`;
    const out = await callGemini(system, user, starSchema);
    const parsed = parseJSON(out, { situation: "", task: "", action: "", result: "", polished_answer: "", tips: [] as string[] });
    await context.supabase.from("ai_analyses").insert({
      user_id: context.userId,
      kind: "interview_star",
      title: data.question.slice(0, 100),
      input: { question: data.question, role: data.role, company: data.company },
      output: parsed,
    });
    return parsed;
  });

export const scoreInterviewAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    question: z.string().min(3),
    answer: z.string().min(3),
    kind: z.enum(["behavioral", "technical", "coding", "hr"]).default("behavioral"),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    role: z.string().optional(),
    company: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const system = "You are a strict but fair FAANG interview grader. Score honestly on 0-100 for each rubric. Reference specific phrases from the candidate's answer. Strict JSON.";
    const user = `Grade this ${data.kind} answer (${data.difficulty} difficulty)${data.role ? ` for ${data.role}` : ""}${data.company ? ` at ${data.company}` : ""}.

QUESTION:
${data.question}

CANDIDATE ANSWER:
${data.answer}

Return overall_score (0-100), sub-scores clarity/structure/relevance/impact/confidence (0-100 each), strengths, weaknesses, improvements (specific + actionable), model_answer (~150-220 words) showing an excellent response, and a 1-2 sentence verdict.`;
    const out = await callGemini(system, user, scoreSchema);
    const fallback = { overall_score: 0, clarity: 0, structure: 0, relevance: 0, impact: 0, confidence: 0, strengths: [], weaknesses: [], improvements: [], model_answer: "", verdict: "" };
    const parsed: any = { ...fallback, ...parseJSON(out, fallback) };
    for (const k of ["overall_score", "clarity", "structure", "relevance", "impact", "confidence"]) {
      parsed[k] = Math.max(0, Math.min(100, Number(parsed[k]) || 0));
    }
    for (const k of ["strengths", "weaknesses", "improvements"]) {
      if (!Array.isArray(parsed[k])) parsed[k] = [];
    }
    await context.supabase.from("ai_analyses").insert({
      user_id: context.userId,
      kind: "interview_practice",
      title: `${data.kind} · ${data.question.slice(0, 80)}`,
      input: { question: data.question, kind: data.kind, difficulty: data.difficulty, role: data.role, company: data.company, answer: data.answer.slice(0, 4000) },
      output: parsed,
    });
    return parsed;
  });
