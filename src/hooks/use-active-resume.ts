import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useActiveResumeText() {
  return useQuery({
    queryKey: ["active-resume-text"],
    queryFn: async () => {
      const { data: r } = await supabase.from("resumes").select("*").eq("is_active", true).maybeSingle();
      if (!r) return null;
      if (r.extracted_text) return { name: r.name, text: r.extracted_text };
      return { name: r.name, text: "" };
    },
  });
}
