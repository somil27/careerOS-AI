import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateCoverLetter } from "@/features/ai/ai.functions";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileSignature, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ai/cover-letter")({
  head: () => ({ meta: [{ title: "Cover Letter · CareerOS AI" }] }),
  component: CoverLetter,
});

function CoverLetter() {
  const fn = useServerFn(generateCoverLetter);
  const [form, setForm] = useState({ company: "", role: "", resume_text: "", job_description: "", tone: "professional" as const });
  const [loading, setLoading] = useState(false);
  const [letter, setLetter] = useState("");

  async function run() {
    setLoading(true);
    try {
      const r = await fn({ data: form });
      setLetter(r.letter);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <PageHeader title="AI Cover Letter Generator" description="Personalized, specific cover letters in seconds." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Inputs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Role</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Tone</Label>
              <Select value={form.tone} onValueChange={(v: any) => setForm({ ...form, tone: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Job description</Label><Textarea rows={6} value={form.job_description} onChange={(e) => setForm({ ...form, job_description: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Your resume text</Label><Textarea rows={8} value={form.resume_text} onChange={(e) => setForm({ ...form, resume_text: e.target.value })} /></div>
            <Button onClick={run} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : <FileSignature className="size-4" />} Generate</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Cover letter</CardTitle>
            {letter && <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(letter); toast.success("Copied"); }}><Copy className="size-4" /></Button>}
          </CardHeader>
          <CardContent>
            {letter ? <div className="whitespace-pre-wrap text-sm leading-relaxed">{letter}</div> : <p className="text-sm text-muted-foreground">Your cover letter will appear here.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
