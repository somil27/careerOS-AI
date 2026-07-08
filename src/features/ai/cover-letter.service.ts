import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGemini } from "@/lib/gemini";

export const generateCoverLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    resume_text: z.string().min(20),
    job_description: z.string().min(20),
    company: z.string().min(1),
    role: z.string().min(1),
    tone: z.enum(["professional", "friendly", "formal"]).default("professional"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const system = `You are an elite career coach. Write a compelling, specific cover letter in a ${data.tone} tone. Use concrete achievements from the resume. 3-4 short paragraphs. No clichés. No "I am writing to apply".`;
    const user = `Company: ${data.company}\nRole: ${data.role}\n\nJOB DESCRIPTION:\n${data.job_description}\n\nRESUME:\n${data.resume_text}`;
    const out = await callGemini(system, user);
    await context.supabase.from("ai_analyses").insert({
      user_id: context.userId,
      kind: "cover_letter",
      title: `${data.role} @ ${data.company}`,
      input: { company: data.company, role: data.role, tone: data.tone },
      output: { letter: out },
    });
    return { letter: out };
  });
