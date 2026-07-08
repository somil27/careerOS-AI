import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { interviewPrep, generateStarAnswer, scoreInterviewAnswer } from "@/features/ai/ai.functions";
import { useActiveResumeText } from "@/hooks/use-active-resume";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, MessageSquare, Code2, Building2, Target, History, Wand2, Gauge, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ai/interview-coach")({
  head: () => ({ meta: [{ title: "Interview Coach · CareerOS AI" }] }),
  component: InterviewCoach,
});

type Difficulty = "easy" | "medium" | "hard";

function diffTone(d: Difficulty) {
  return d === "easy" ? "bg-success/15 text-success" : d === "hard" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning";
}

function scoreTone(n: number) {
  if (n >= 80) return "text-success";
  if (n >= 60) return "text-warning";
  return "text-destructive";
}

function InterviewCoach() {
  const qc = useQueryClient();
  const prepFn = useServerFn(interviewPrep);
  const starFn = useServerFn(generateStarAnswer);
  const scoreFn = useServerFn(scoreInterviewAnswer);
  const active = useActiveResumeText();

  const [tab, setTab] = useState("prep");

  // Prep state
  const [prepForm, setPrepForm] = useState<{ company: string; role: string; job_description: string; difficulty: "mixed" | Difficulty; use_resume: boolean }>({ company: "", role: "", job_description: "", difficulty: "mixed", use_resume: true });
  const [prepLoading, setPrepLoading] = useState(false);
  const [prep, setPrep] = useState<any>(null);

  // Practice state
  const [practice, setPractice] = useState({ question: "", answer: "", kind: "behavioral" as "behavioral" | "technical" | "coding" | "hr", difficulty: "medium" as Difficulty, role: "", company: "" });
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceResult, setPracticeResult] = useState<any>(null);

  // STAR state
  const [star, setStar] = useState({ question: "", notes: "", role: "", company: "" });
  const [starLoading, setStarLoading] = useState(false);
  const [starResult, setStarResult] = useState<any>(null);

  const history = useQuery({
    queryKey: ["ai_analyses", "interview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_analyses")
        .select("*")
        .in("kind", ["interview_prep", "interview_practice", "interview_star"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const avgScore = useMemo(() => {
    const rows = (history.data ?? []).filter((r: any) => r.kind === "interview_practice");
    if (!rows.length) return null;
    const total = rows.reduce((a: number, r: any) => a + (Number(r.output?.overall_score) || 0), 0);
    return Math.round(total / rows.length);
  }, [history.data]);

  async function runPrep() {
    if (!prepForm.company || !prepForm.role) { toast.error("Company and role are required"); return; }
    setPrepLoading(true);
    try {
      const res = await prepFn({
        data: {
          company: prepForm.company,
          role: prepForm.role,
          job_description: prepForm.job_description || undefined,
          difficulty: prepForm.difficulty,
          resume_text: prepForm.use_resume ? active.data?.text || undefined : undefined,
        },
      });
      setPrep(res);
      qc.invalidateQueries({ queryKey: ["ai_analyses", "interview"] });
      toast.success("Prep pack ready");
    } catch (e: any) { toast.error(e.message); } finally { setPrepLoading(false); }
  }

  async function runPractice() {
    if (!practice.question || !practice.answer) { toast.error("Enter question and your answer"); return; }
    setPracticeLoading(true);
    try {
      const res = await scoreFn({ data: { ...practice } });
      setPracticeResult(res);
      qc.invalidateQueries({ queryKey: ["ai_analyses", "interview"] });
    } catch (e: any) { toast.error(e.message); } finally { setPracticeLoading(false); }
  }

  async function runStar() {
    if (!star.question || !star.notes) { toast.error("Enter question and your notes"); return; }
    setStarLoading(true);
    try {
      const res = await starFn({ data: { ...star } });
      setStarResult(res);
      qc.invalidateQueries({ queryKey: ["ai_analyses", "interview"] });
    } catch (e: any) { toast.error(e.message); } finally { setStarLoading(false); }
  }

  function loadIntoPractice(q: string, kind: typeof practice.kind, difficulty: Difficulty) {
    setPractice((p) => ({ ...p, question: q, kind, difficulty, role: prepForm.role, company: prepForm.company, answer: "" }));
    setPracticeResult(null);
    setTab("practice");
  }

  return (
    <div>
      <PageHeader title="AI Interview Coach" description="Company research, question banks, STAR generator, and AI-graded mock practice — all persisted." />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="prep"><Building2 className="size-4" /> Prep</TabsTrigger>
          <TabsTrigger value="practice"><Gauge className="size-4" /> Practice</TabsTrigger>
          <TabsTrigger value="star"><Wand2 className="size-4" /> STAR</TabsTrigger>
          <TabsTrigger value="history"><History className="size-4" /> History{avgScore != null && <span className={`ml-2 text-xs ${scoreTone(avgScore)}`}>avg {avgScore}</span>}</TabsTrigger>
        </TabsList>

        {/* ============ PREP ============ */}
        <TabsContent value="prep" className="space-y-4">
          <Card>
            <CardContent className="p-4 grid md:grid-cols-4 gap-3">
              <div className="space-y-1.5"><Label>Company</Label><Input value={prepForm.company} onChange={(e) => setPrepForm({ ...prepForm, company: e.target.value })} placeholder="Stripe" /></div>
              <div className="space-y-1.5"><Label>Role</Label><Input value={prepForm.role} onChange={(e) => setPrepForm({ ...prepForm, role: e.target.value })} placeholder="Senior Backend Engineer" /></div>
              <div className="space-y-1.5">
                <Label>Difficulty</Label>
                <Select value={prepForm.difficulty} onValueChange={(v: any) => setPrepForm({ ...prepForm, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={runPrep} disabled={prepLoading} className="w-full">
                  {prepLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Generate prep
                </Button>
              </div>
              <div className="md:col-span-4 space-y-1.5">
                <Label>Job description (optional)</Label>
                <Textarea rows={3} value={prepForm.job_description} onChange={(e) => setPrepForm({ ...prepForm, job_description: e.target.value })} />
              </div>
              <div className="md:col-span-4 flex items-center gap-2 text-xs text-muted-foreground">
                <input id="use-resume" type="checkbox" checked={prepForm.use_resume} onChange={(e) => setPrepForm({ ...prepForm, use_resume: e.target.checked })} />
                <label htmlFor="use-resume">Tailor to my active resume{active.data ? ` (${active.data.name})` : " (no active resume)"}</label>
              </div>
            </CardContent>
          </Card>

          {prep && (
            <div className="grid lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="size-4" /> Company research</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="leading-relaxed">{prep.company_research}</p>
                  {prep.culture_notes?.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-1 text-muted-foreground uppercase tracking-wide">Culture</div>
                      <ul className="list-disc pl-5 space-y-1">{prep.culture_notes.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
                    </div>
                  )}
                  {prep.recent_news?.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-1 text-muted-foreground uppercase tracking-wide">Recent news</div>
                      <ul className="list-disc pl-5 space-y-1">{prep.recent_news.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="size-4" /> Questions to ask them</CardTitle></CardHeader>
                <CardContent>
                  <ol className="space-y-2 text-sm list-decimal pl-5">
                    {prep.questions_to_ask?.map((q: string, i: number) => <li key={i}>{q}</li>)}
                  </ol>
                </CardContent>
              </Card>

              <QuestionBank title="Behavioral" icon={<MessageSquare className="size-4" />} items={prep.behavioral} kind="behavioral" onPractice={loadIntoPractice} />
              <QuestionBank title="Technical" icon={<Code2 className="size-4" />} items={prep.technical} kind="technical" onPractice={loadIntoPractice} />
              <QuestionBank title="HR / Fit" icon={<MessageSquare className="size-4" />} items={prep.hr} kind="hr" onPractice={loadIntoPractice} />

              <Card className="lg:col-span-3">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Code2 className="size-4" /> Coding problems</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-3">
                  {prep.coding?.map((c: any, i: number) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm">{c.title}</div>
                        <Badge className={diffTone(c.difficulty)} variant="outline">{c.difficulty}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{c.prompt}</p>
                      <div className="flex flex-wrap gap-1">
                        {c.topics?.map((t: string, k: number) => <Badge key={k} variant="secondary" className="text-[10px]">{t}</Badge>)}
                      </div>
                      <div className="text-xs"><span className="font-medium">Approach: </span>{c.approach}</div>
                      <div className="text-xs text-muted-foreground">{c.complexity}</div>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => loadIntoPractice(`${c.title}\n\n${c.prompt}`, "coding", c.difficulty)}><ChevronRight className="size-3" /> Practice</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Coding tips</CardTitle></CardHeader>
                <CardContent><ul className="list-disc pl-5 space-y-1 text-sm">{prep.coding_tips?.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base text-destructive">Red flags to avoid</CardTitle></CardHeader>
                <CardContent><ul className="list-disc pl-5 space-y-1 text-sm">{prep.red_flags?.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ============ PRACTICE ============ */}
        <TabsContent value="practice" className="space-y-4">
          <Card>
            <CardContent className="p-4 grid md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>Question type</Label>
                <Select value={practice.kind} onValueChange={(v: any) => setPractice({ ...practice, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="behavioral">Behavioral</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="coding">Coding</SelectItem>
                    <SelectItem value="hr">HR / Fit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty</Label>
                <Select value={practice.difficulty} onValueChange={(v: any) => setPractice({ ...practice, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Role (optional)</Label><Input value={practice.role} onChange={(e) => setPractice({ ...practice, role: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Company (optional)</Label><Input value={practice.company} onChange={(e) => setPractice({ ...practice, company: e.target.value })} /></div>
              <div className="md:col-span-4 space-y-1.5"><Label>Question</Label><Textarea rows={2} value={practice.question} onChange={(e) => setPractice({ ...practice, question: e.target.value })} placeholder="Tell me about a time you disagreed with your manager…" /></div>
              <div className="md:col-span-4 space-y-1.5"><Label>Your answer</Label><Textarea rows={6} value={practice.answer} onChange={(e) => setPractice({ ...practice, answer: e.target.value })} placeholder="Type or paste your spoken answer here…" /></div>
              <div className="md:col-span-4">
                <Button onClick={runPractice} disabled={practiceLoading}>
                  {practiceLoading ? <Loader2 className="size-4 animate-spin" /> : <Gauge className="size-4" />} Grade my answer
                </Button>
              </div>
            </CardContent>
          </Card>

          {practiceResult && <ScoreCard result={practiceResult} />}
        </TabsContent>

        {/* ============ STAR ============ */}
        <TabsContent value="star" className="space-y-4">
          <Card>
            <CardContent className="p-4 grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5 md:col-span-2"><Label>Behavioral question</Label><Input value={star.question} onChange={(e) => setStar({ ...star, question: e.target.value })} placeholder="Tell me about a time you led a project under a tight deadline." /></div>
              <div className="space-y-1.5"><Label>Role (optional)</Label><Input value={star.role} onChange={(e) => setStar({ ...star, role: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Company (optional)</Label><Input value={star.company} onChange={(e) => setStar({ ...star, company: e.target.value })} /></div>
              <div className="md:col-span-2 space-y-1.5"><Label>Your raw notes / story</Label><Textarea rows={6} value={star.notes} onChange={(e) => setStar({ ...star, notes: e.target.value })} placeholder="What happened, what you did, numbers if you have them…" /></div>
              <div className="md:col-span-2"><Button onClick={runStar} disabled={starLoading}>{starLoading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Generate STAR answer</Button></div>
            </CardContent>
          </Card>

          {starResult && (
            <div className="grid md:grid-cols-2 gap-4">
              {(["situation", "task", "action", "result"] as const).map((k) => (
                <Card key={k}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm capitalize">{k}</CardTitle></CardHeader>
                  <CardContent><p className="text-sm leading-relaxed">{starResult[k]}</p></CardContent>
                </Card>
              ))}
              <Card className="md:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Polished spoken answer</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{starResult.polished_answer}</p>
                  {starResult.tips?.length > 0 && (
                    <div className="border-t pt-3">
                      <div className="text-xs font-medium mb-1 text-muted-foreground uppercase tracking-wide">Delivery tips</div>
                      <ul className="list-disc pl-5 space-y-1 text-sm">{starResult.tips.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ============ HISTORY ============ */}
        <TabsContent value="history" className="space-y-3">
          {history.isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>}
          {history.data?.length === 0 && <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No interview activity yet.</CardContent></Card>}
          {(history.data ?? []).map((row: any) => (
            <Card key={row.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{row.kind.replace("interview_", "")}</Badge>
                      <div className="font-medium text-sm truncate">{row.title || "(untitled)"}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{formatDate(row.created_at)}</div>
                  </div>
                  {row.kind === "interview_practice" && (
                    <div className={`text-2xl font-semibold ${scoreTone(row.output?.overall_score ?? 0)}`}>{row.output?.overall_score ?? 0}</div>
                  )}
                </div>
                {row.kind === "interview_practice" && row.output?.verdict && (
                  <p className="text-sm text-muted-foreground mt-2">{row.output.verdict}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuestionBank({ title, icon, items, kind, onPractice }: { title: string; icon: React.ReactNode; items: any[]; kind: "behavioral" | "technical" | "hr"; onPractice: (q: string, k: any, d: Difficulty) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2">{icon} {title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items?.map((q: any, i: number) => (
          <div key={i} className="border rounded-md p-2.5 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium leading-snug">{q.question}</div>
              <Badge className={diffTone(q.difficulty)} variant="outline">{q.difficulty}</Badge>
            </div>
            {q.why_asked && <div className="text-xs text-muted-foreground"><span className="font-medium">Signal: </span>{q.why_asked}</div>}
            {q.star_hint && <div className="text-xs text-muted-foreground"><span className="font-medium">Hint: </span>{q.star_hint}</div>}
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => onPractice(q.question, kind, q.difficulty)}><ChevronRight className="size-3" /> Practice</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ScoreCard({ result }: { result: any }) {
  const subs = [
    ["Clarity", result.clarity],
    ["Structure", result.structure],
    ["Relevance", result.relevance],
    ["Impact", result.impact],
    ["Confidence", result.confidence],
  ] as const;
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Overall</CardTitle></CardHeader>
        <CardContent>
          <div className={`text-5xl font-semibold ${scoreTone(result.overall_score)}`}>{result.overall_score}</div>
          <p className="text-sm text-muted-foreground mt-2">{result.verdict}</p>
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Rubric</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {subs.map(([label, val]) => (
            <div key={label}>
              <div className="flex items-center justify-between text-xs mb-1"><span>{label}</span><span className={scoreTone(val)}>{val}</span></div>
              <Progress value={val} />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-success">Strengths</CardTitle></CardHeader>
        <CardContent><ul className="list-disc pl-5 space-y-1 text-sm">{result.strengths?.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-destructive">Weaknesses</CardTitle></CardHeader>
        <CardContent><ul className="list-disc pl-5 space-y-1 text-sm">{result.weaknesses?.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Improvements</CardTitle></CardHeader>
        <CardContent><ul className="list-disc pl-5 space-y-1 text-sm">{result.improvements?.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></CardContent>
      </Card>
      <Card className="md:col-span-3">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Model answer</CardTitle></CardHeader>
        <CardContent><p className="text-sm leading-relaxed whitespace-pre-wrap">{result.model_answer}</p></CardContent>
      </Card>
    </div>
  );
}
