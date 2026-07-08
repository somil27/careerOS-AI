import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGemini, parseJSON as safeJSON } from "@/lib/gemini";

const callAI = callGemini;


// ============= Schemas =============
const InterviewType = z.enum(["hr", "technical", "behavioral", "system_design", "product", "coding"]);
const Difficulty = z.enum(["easy", "medium", "hard"]);
const Mode = z.enum(["text", "voice", "webcam"]);

const questionsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["intro", "questions"],
  properties: {
    intro: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["prompt", "focus", "difficulty"],
        properties: {
          prompt: { type: "string" },
          focus: { type: "string" },
          difficulty: { type: "string" },
        },
      },
    },
  },
} as const;

// ============= Start Interview =============
export const startInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      interview_type: InterviewType,
      company: z.string().max(200).optional().default(""),
      role: z.string().max(200).optional().default(""),
      difficulty: Difficulty.default("medium"),
      mode: Mode.default("text"),
      resume_text: z.string().max(20000).optional().default(""),
      job_description: z.string().max(10000).optional().default(""),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const typeLabel: Record<string, string> = {
      hr: "HR / cultural fit",
      technical: "Technical (fundamentals + role-specific)",
      behavioral: "Behavioral (STAR)",
      system_design: "System Design",
      product: "Product Management",
      coding: "Coding / DSA",
    };
    const system = `You are a senior interviewer running a ${typeLabel[data.interview_type]} interview at ${data.company || "a top company"} for a ${data.role || "candidate"} role. Difficulty: ${data.difficulty}. Generate a warm 1-2 sentence intro, then 6-8 opening questions escalating in difficulty. Return strict JSON.`;
    const user = `Candidate resume:\n${data.resume_text || "(not provided)"}\n\nJob description:\n${data.job_description || "(not provided)"}\n\nProduce the intro and initial question set.`;
    const raw = await callAI(system, user, questionsSchema);
    const parsed = safeJSON<{ intro: string; questions: Array<{ prompt: string; focus: string; difficulty: string }> }>(raw, { intro: "Let's begin.", questions: [] });

    const { data: row, error } = await supabase
      .from("interview_sessions")
      .insert({
        user_id: userId,
        interview_type: data.interview_type,
        company: data.company || null,
        role: data.role || null,
        difficulty: data.difficulty,
        mode: data.mode,
        status: "in_progress",
        questions: parsed.questions,
        transcript: [{ role: "interviewer", content: parsed.intro, ts: Date.now() }],
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { session: row, intro: parsed.intro, questions: parsed.questions };
  });

// ============= Follow-up question =============
export const nextQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      session_id: z.string().uuid(),
      last_answer: z.string().max(8000),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: s, error } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", data.session_id)
      .eq("user_id", userId)
      .single();
    if (error || !s) throw new Error("Session not found");

    const transcript = Array.isArray(s.transcript) ? (s.transcript as Array<{ role: string; content: string }>) : [];
    const lastQ = [...transcript].reverse().find((m) => m.role === "interviewer")?.content ?? "";
    const updated = [...transcript, { role: "candidate", content: data.last_answer, ts: Date.now() }];

    const system = `You are a senior ${s.interview_type} interviewer at ${s.company ?? "a top company"} for ${s.role ?? "the candidate"}. Ask ONE focused follow-up question based on the candidate's last answer, or transition to a new topic if they answered thoroughly. Keep it under 2 sentences. Return JSON: {"question": string, "should_end": boolean, "reason": string}.`;
    const user = `Recent question: ${lastQ}\n\nCandidate answered: ${data.last_answer}\n\nEntire transcript so far has ${transcript.length} turns. If we've covered 8+ meaningful exchanges, set should_end=true.`;
    const raw = await callAI(system, user, {
      type: "object",
      additionalProperties: false,
      required: ["question", "should_end", "reason"],
      properties: { question: { type: "string" }, should_end: { type: "boolean" }, reason: { type: "string" } },
    });
    const parsed = safeJSON<{ question: string; should_end: boolean; reason: string }>(raw, { question: "Can you tell me more?", should_end: false, reason: "" });

    const nextTranscript = parsed.should_end
      ? updated
      : [...updated, { role: "interviewer", content: parsed.question, ts: Date.now() }];

    await supabase.from("interview_sessions").update({ transcript: nextTranscript }).eq("id", s.id);
    return { question: parsed.question, should_end: parsed.should_end, reason: parsed.reason };
  });

// ============= Analyze Interview =============
const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "overall_score", "confidence_score", "communication_score", "technical_score", "behavioral_score",
    "sentiment", "grammar_review", "vocabulary_quality", "star_evaluation",
    "strengths", "weaknesses", "improvement_suggestions", "study_topics", "prep_plan",
    "sample_answers",
  ],
  properties: {
    overall_score: { type: "number" },
    confidence_score: { type: "number" },
    communication_score: { type: "number" },
    technical_score: { type: "number" },
    behavioral_score: { type: "number" },
    sentiment: { type: "string" },
    grammar_review: { type: "string" },
    vocabulary_quality: { type: "string" },
    star_evaluation: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    improvement_suggestions: { type: "array", items: { type: "string" } },
    study_topics: { type: "array", items: { type: "string" } },
    prep_plan: { type: "array", items: { type: "string" } },
    sample_answers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "better_answer"],
        properties: { question: { type: "string" }, better_answer: { type: "string" } },
      },
    },
  },
} as const;

export const analyzeInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      session_id: z.string().uuid(),
      client_metrics: z.object({
        wpm: z.number().nullable().optional(),
        filler_count: z.number().nullable().optional(),
        filler_words: z.record(z.string(), z.number()).optional(),
        duration_seconds: z.number().nullable().optional(),
        eye_contact_score: z.number().nullable().optional(),
        facial_expression: z.string().optional(),
      }).default({}),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: s, error } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", data.session_id)
      .eq("user_id", userId)
      .single();
    if (error || !s) throw new Error("Session not found");

    const transcript = Array.isArray(s.transcript) ? (s.transcript as Array<{ role: string; content: string }>) : [];
    const conversation = transcript.map((t) => `${t.role === "interviewer" ? "Q" : "A"}: ${t.content}`).join("\n\n");
    const metrics = data.client_metrics ?? {};

    const system = `You are an elite interview evaluator. Score each dimension 0-100 based on the transcript and objective speaking metrics. Be specific, cite exact phrases where relevant, and be honest. Return strict JSON.`;
    const user = `Interview type: ${s.interview_type}\nCompany: ${s.company ?? "-"}\nRole: ${s.role ?? "-"}\nDifficulty: ${s.difficulty}\nMode: ${s.mode}\n\nObjective metrics:\n- Words per minute: ${metrics.wpm ?? "n/a"}\n- Filler words total: ${metrics.filler_count ?? "n/a"}\n- Filler breakdown: ${JSON.stringify(metrics.filler_words ?? {})}\n- Duration (s): ${metrics.duration_seconds ?? "n/a"}\n- Eye contact score (0-100): ${metrics.eye_contact_score ?? "n/a"}\n- Facial expression summary: ${metrics.facial_expression ?? "n/a"}\n\nTranscript:\n${conversation}\n\nProduce scores + qualitative feedback + at least 3 sample better answers for the weakest responses.`;

    const raw = await callAI(system, user, analysisSchema);
    const parsed = safeJSON(raw, null as unknown as {
      overall_score: number; confidence_score: number; communication_score: number;
      technical_score: number; behavioral_score: number;
      sentiment: string; grammar_review: string; vocabulary_quality: string; star_evaluation: string;
      strengths: string[]; weaknesses: string[]; improvement_suggestions: string[];
      study_topics: string[]; prep_plan: string[];
      sample_answers: Array<{ question: string; better_answer: string }>;
    });
    if (!parsed) throw new Error("Could not parse AI analysis. Try again.");

    const feedback = {
      strengths: parsed.strengths,
      weaknesses: parsed.weaknesses,
      improvement_suggestions: parsed.improvement_suggestions,
      study_topics: parsed.study_topics,
      prep_plan: parsed.prep_plan,
      sample_answers: parsed.sample_answers,
    };

    const { error: uerr } = await supabase
      .from("interview_sessions")
      .update({
        status: "completed",
        analysis: { ...parsed, metrics },
        feedback,
        overall_score: parsed.overall_score,
        confidence_score: parsed.confidence_score,
        communication_score: parsed.communication_score,
        technical_score: parsed.technical_score,
        behavioral_score: parsed.behavioral_score,
        duration_seconds: metrics.duration_seconds ?? null,
      })
      .eq("id", s.id);
    if (uerr) throw new Error(uerr.message);

    return { analysis: parsed, feedback };
  });

// ============= CRUD =============
export const listInterviewSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("interview_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteInterviewSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("interview_sessions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= Voice transcription (Google Gemini audio) =============
export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      audio_base64: z.string().min(10),
      mime: z.string().default("audio/webm"),
    }).parse(raw),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Transcribe this audio verbatim. Return only the plain text transcript, no commentary." },
            { inlineData: { mimeType: data.mime, data: data.audio_base64 } },
          ],
        },
      ],
    });
    return { text: (response.text ?? "").trim() };
  });

