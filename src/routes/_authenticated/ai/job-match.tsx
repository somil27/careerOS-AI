import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { matchJob, type JobMatchResult } from "@/features/ai/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useActiveResumeText } from "@/hooks/use-active-resume";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Target, DollarSign, TrendingUp, GraduationCap, Award, FolderKanban,
  CheckCircle2, XCircle, Sparkles, History, FileText,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ai/job-match")({
  head: () => ({ meta: [{ title: "Job Match · CareerOS AI" }] }),
  component: JobMatch,
});

function JobMatch() {
  const fn = useServerFn(matchJob);
  const qc = useQueryClient();
  const { data: activeResume } = useActiveResumeText();

  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [years, setYears] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JobMatchResult | null>(null);
  const [tab, setTab] = useState<"analyze" | "history">("analyze");

  const history = useQuery({
    queryKey: ["job-match-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_analyses")
        .select("id,title,created_at,input,output")
        .eq("kind", "job_match")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const effectiveResume = resume || activeResume?.text || "";

  async function run() {
    if (!effectiveResume.trim() || effectiveResume.trim().length < 20) {
      toast.error("Add resume text (or set an active resume in Resumes).");
      return;
    }
    if (jd.trim().length < 20) {
      toast.error("Add a job description (min 20 characters).");
      return;
    }
    setLoading(true);
    try {
      const yearsNum = years ? Number(years) : undefined;
      const res = await fn({
        data: {
          resume_text: effectiveResume,
          job_description: jd,
          company: company || undefined,
          role: role || undefined,
          location: location || undefined,
          years_experience: Number.isFinite(yearsNum) ? yearsNum : undefined,
        },
      });
      setResult(res);
      qc.invalidateQueries({ queryKey: ["job-match-history"] });
      toast.success("Match analysis complete");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to analyze");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI Job Match Pro"
        description="Enterprise-grade fit analysis: skills, salary, interview odds, roadmap."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="analyze"><Sparkles className="size-3.5 mr-1.5" />Analyze</TabsTrigger>
          <TabsTrigger value="history"><History className="size-3.5 mr-1.5" />History</TabsTrigger>
        </TabsList>

        <TabsContent value="analyze" className="mt-4">
          <div className="grid lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Inputs</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Role</Label><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Senior SWE" /></div>
                  <div className="space-y-1.5"><Label>Company</Label><Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Stripe" /></div>
                  <div className="space-y-1.5"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote · US" /></div>
                  <div className="space-y-1.5"><Label>Years exp.</Label><Input type="number" min={0} value={years} onChange={(e) => setYears(e.target.value)} placeholder="5" /></div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Resume text</Label>
                    {activeResume?.text ? (
                      <button
                        type="button"
                        onClick={() => setResume(activeResume.text)}
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <FileText className="size-3" />
                        Use active ({activeResume.name})
                      </button>
                    ) : null}
                  </div>
                  <Textarea rows={8} value={resume} onChange={(e) => setResume(e.target.value)} placeholder={activeResume?.text ? "Leaving blank uses your active resume." : "Paste your resume text…"} />
                </div>
                <div className="space-y-1.5"><Label>Job description</Label><Textarea rows={10} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the JD…" /></div>
                <Button onClick={run} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Target className="size-4 mr-2" />}
                  Analyze fit
                </Button>
              </CardContent>
            </Card>

            <div className="lg:col-span-3">
              {!result ? (
                <Card className="h-full">
                  <CardContent className="h-full min-h-[400px] grid place-items-center text-center">
                    <div className="space-y-2 max-w-sm">
                      <Sparkles className="size-8 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Run a match to see fit, skills, salary, interview odds, and a personalized roadmap.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <ResultView result={result} />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryList
            items={history.data ?? []}
            loading={history.isLoading}
            onOpen={(o) => { setResult(o); setTab("analyze"); }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResultView({ result }: { result: JobMatchResult }) {
  const salary = useMemo(() => {
    const fmt = (n: number) => {
      if (!n) return "—";
      try { return new Intl.NumberFormat(undefined, { style: "currency", currency: result.salary_estimate.currency || "USD", maximumFractionDigits: 0 }).format(n); }
      catch { return `${result.salary_estimate.currency} ${n.toLocaleString()}`; }
    };
    return { min: fmt(result.salary_estimate.min), median: fmt(result.salary_estimate.median), max: fmt(result.salary_estimate.max) };
  }, [result.salary_estimate]);

  return (
    <div className="space-y-4">
      {/* Top scores */}
      <div className="grid sm:grid-cols-3 gap-3">
        <ScoreCard icon={<Target className="size-4" />} label="Overall match" value={result.match_percentage} />
        <ScoreCard icon={<CheckCircle2 className="size-4" />} label="Skills match" value={result.skills_match.score} />
        <ScoreCard icon={<Sparkles className="size-4" />} label="Tech match" value={result.technology_match.score} />
      </div>

      {result.verdict ? (
        <Card><CardContent className="pt-4 text-sm">{result.verdict}</CardContent></Card>
      ) : null}

      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="size-4" />Salary estimate</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-semibold">{salary.median}</div>
              <div className="text-xs text-muted-foreground">median</div>
            </div>
            <div className="text-xs text-muted-foreground">Range: {salary.min} – {salary.max}{result.salary_estimate.region ? ` · ${result.salary_estimate.region}` : ""}</div>
            {result.salary_estimate.notes ? <p className="text-xs text-muted-foreground">{result.salary_estimate.notes}</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="size-4" />Interview probability</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-semibold">{result.interview_probability.score}%</div>
              <div className="text-xs text-muted-foreground">first-round odds</div>
            </div>
            <Progress value={result.interview_probability.score} />
            {result.interview_probability.reasoning ? <p className="text-xs text-muted-foreground">{result.interview_probability.reasoning}</p> : null}
          </CardContent>
        </Card>
      </div>

      {/* Matched / partial / missing */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Skills & technologies</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <ChipRow title="Matched skills" items={result.skills_match.matched} tone="success" />
          <ChipRow title="Partial skills" items={result.skills_match.partial} tone="warn" />
          <Separator />
          <ChipRow title="Matched technologies" items={result.technology_match.matched} tone="success" />
          <ChipRow title="Partial technologies" items={result.technology_match.partial} tone="warn" />
          <Separator />
          <ChipRow title="Missing skills" items={result.missing_skills} tone="danger" />
          <ChipRow title="Missing technologies" items={result.missing_technologies} tone="danger" />
          <ChipRow title="Missing soft skills" items={result.missing_soft_skills} tone="danger" />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <ListCard title="Strengths" items={result.strengths} icon={<CheckCircle2 className="size-4 text-success" />} />
        <ListCard title="Weaknesses" items={result.weaknesses} icon={<XCircle className="size-4 text-warning" />} />
      </div>

      {result.improvements.length ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Improvements</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {result.improvements.map((i, idx) => <li key={idx} className="flex gap-2"><span className="text-primary">→</span><span>{i}</span></li>)}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {result.learning_roadmap.length ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><GraduationCap className="size-4" />Learning roadmap</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {result.learning_roadmap.map((step, i) => (
                <li key={i} className="border-l-2 border-primary pl-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-primary">{step.week}</div>
                  <div className="text-sm font-medium">{step.focus}</div>
                  {step.resources.length ? (
                    <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4">
                      {step.resources.map((r, ri) => <li key={ri}>{r}</li>)}
                    </ul>
                  ) : null}
                  {step.outcome ? <div className="text-xs text-muted-foreground mt-1"><span className="font-medium text-foreground">Outcome:</span> {step.outcome}</div> : null}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid md:grid-cols-2 gap-3">
        {result.recommended_certifications.length ? (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Award className="size-4" />Certifications</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.recommended_certifications.map((c, i) => (
                  <li key={i} className="text-sm">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.provider}</div>
                    {c.why ? <div className="text-xs text-muted-foreground mt-0.5">{c.why}</div> : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {result.recommended_projects.length ? (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FolderKanban className="size-4" />Portfolio projects</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {result.recommended_projects.map((p, i) => (
                  <li key={i} className="text-sm">
                    <div className="font-medium">{p.title}</div>
                    {p.description ? <div className="text-xs text-muted-foreground mt-0.5">{p.description}</div> : null}
                    {p.skills.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.skills.map((s, si) => <Badge key={si} variant="secondary" className="text-[10px]">{s}</Badge>)}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function ScoreCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
        <div className="mt-2 flex items-baseline gap-2">
          <div className="text-3xl font-semibold tabular-nums">{Math.round(value)}</div>
          <div className="text-xs text-muted-foreground">/ 100</div>
        </div>
        <Progress value={value} className="mt-2" />
      </CardContent>
    </Card>
  );
}

function ChipRow({ title, items, tone }: { title: string; items: string[]; tone: "success" | "warn" | "danger" }) {
  if (!items?.length) return null;
  const cls = tone === "success"
    ? "bg-success/10 text-success border-success/20"
    : tone === "warn"
      ? "bg-warning/15 text-warning-foreground border-warning/30"
      : "bg-destructive/10 text-destructive border-destructive/20";
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</div>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((i, idx) => <li key={idx} className={`px-2.5 py-1 rounded-md text-xs border ${cls}`}>{i}</li>)}
      </ul>
    </div>
  );
}

function ListCard({ title, items, icon }: { title: string; items: string[]; icon?: React.ReactNode }) {
  if (!items?.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-sm">
          {items.map((i, idx) => <li key={idx} className="flex gap-2"><span className="text-muted-foreground">•</span><span>{i}</span></li>)}
        </ul>
      </CardContent>
    </Card>
  );
}

function HistoryList({ items, loading, onOpen }: { items: Array<{ id: string; title: string | null; created_at: string; input: any; output: any }>; loading: boolean; onOpen: (o: JobMatchResult) => void }) {
  if (loading) return <Card><CardContent className="pt-6 text-sm text-muted-foreground">Loading history…</CardContent></Card>;
  if (!items.length) return <Card><CardContent className="pt-6 text-sm text-muted-foreground">No past matches yet. Run an analysis to build history.</CardContent></Card>;
  return (
    <Card>
      <CardContent className="pt-4">
        <ScrollArea className="h-[560px] pr-2">
          <ul className="divide-y">
            {items.map((it) => {
              const out = it.output as JobMatchResult | null;
              const pct = Math.round(Number(out?.match_percentage) || 0);
              return (
                <li key={it.id} className="py-3 flex items-center gap-3">
                  <div className="size-12 rounded-full border-2 border-primary/40 grid place-items-center text-sm font-semibold tabular-nums">{pct}%</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{it.title || "Job match"}</div>
                    <div className="text-xs text-muted-foreground">{new Date(it.created_at).toLocaleString()}{it.input?.location ? ` · ${it.input.location}` : ""}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => out && onOpen(out)} disabled={!out}>Open</Button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
