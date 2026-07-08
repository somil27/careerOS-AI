import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getSharedResume = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; referrer?: string; userAgent?: string }) =>
    z.object({ slug: z.string().min(1), referrer: z.string().optional(), userAgent: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: share, error } = await supabaseAdmin
      .from("resume_shares")
      .select("id, resume_id, expires_at, view_count, is_active, created_at")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!share || !share.is_active) return { ok: false as const, reason: "not_found" as const };
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return { ok: false as const, reason: "expired" as const };
    }
    const { data: resume, error: rerr } = await supabaseAdmin
      .from("resumes")
      .select("id, name, template, tags, file_path, file_size, created_at, version, extracted_text")
      .eq("id", share.resume_id)
      .maybeSingle();
    if (rerr) throw new Error(rerr.message);
    if (!resume) return { ok: false as const, reason: "not_found" as const };

    const { data: signed, error: uerr } = await supabaseAdmin.storage
      .from("resumes")
      .createSignedUrl(resume.file_path, 60 * 60);
    if (uerr) throw new Error(uerr.message);

    // Log view + increment counter (best-effort)
    await supabaseAdmin.from("resume_views").insert({
      share_id: share.id,
      resume_id: resume.id,
      referrer: data.referrer ?? null,
      user_agent: data.userAgent ?? null,
    });
    await supabaseAdmin
      .from("resume_shares")
      .update({ view_count: (share.view_count ?? 0) + 1 })
      .eq("id", share.id);

    return {
      ok: true as const,
      resume: {
        id: resume.id,
        name: resume.name,
        template: resume.template,
        tags: resume.tags ?? [],
        version: resume.version,
        created_at: resume.created_at,
        file_ext: (resume.file_path.split(".").pop() ?? "").toLowerCase(),
        preview_url: signed.signedUrl,
        extracted_text: resume.extracted_text ?? "",
      },
      share: {
        expires_at: share.expires_at,
        view_count: (share.view_count ?? 0) + 1,
        created_at: share.created_at,
      },
    };
  });
