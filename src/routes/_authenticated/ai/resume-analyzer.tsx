import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { analyzeResume, compareResumes, type ResumeAnalysis } from "@/features/ai/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useActiveResumeText } from "@/hooks/use-active-resume";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/state-views";
import { Loader2, Wand2, History, GitCompare, CheckCircle2, AlertTriangle, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/ai/resume-analyzer")({
  head: () => ({ meta: [{ title: "Resume Analyzer · CareerOS AI" }] }),
  component: ResumeAnalyzerPage,
});

type HistoryRow = { id: string; created_at: string; title: string | null; output: ResumeAnalysis; input: any };

function useAnalysisHistory() {
  return useQuery({
    queryKey: ["resume-analysis-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_analyses")
        .select("id, created_at, title, output, input")
        .eq("kind", "resume_analysis")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as HistoryRow[];
    },
  });
}

function ResumeAnalyzerPage() {
  return (
    <div>
      <PageHeader
        title="AI Resume Analyzer"
        description="Deep ATS analysis, section-wise scoring, keyword heatmap, skill-gap detection, and recruiter readability."
      />
      <Tabs defaultValue="analyze" className="w-full">
        <TabsList>
          <TabsTrigger value="analyze"><Sparkles className="size-3.5 mr-1.5" />Analyze</TabsTrigger>
          <TabsTrigger value="history"><History className="size-3.5 mr-1.5" />History</TabsTrigger>
          <TabsTrigger value="compare"><GitCompare className="size-3.5 mr-1.5" />Compare</TabsTrigger>
        </TabsList>
        <TabsContent value="analyze" className="mt-4"><AnalyzeTab /></TabsContent>
        <TabsContent value="history" className="mt-4"><HistoryTab /></TabsContent>
        <TabsContent value="compare" className="mt-4"><CompareTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function AnalyzeTab() {
  const fn = useServerFn(analyzeResume);
  const qc = useQueryClient();
  const active = useActiveResumeText();
  const [resume, setResume] = useState("");
  const [role, setRole] = useState("");
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResumeAnalysis | null>(null);

  const effectiveResume = resume.trim() || active.data?.text || "";

  async function run() {
    if (effectiveResume.trim().length < 50) return toast.error("Paste your resume or set an active resume (min 50 chars).");
    setLoading(true);
    try {
      const r = await fn({ data: { resume_text: effectiveResume, target_role: role || undefined, job_description: jd || undefined } });
      if (!r || typeof r.ats_score !== "number") throw new Error("Invalid AI response.");
      setResult(r);
      qc.invalidateQueries({ queryKey: ["resume-analysis-history"] });
      toast.success("Analysis complete");
    } catch (e: any) { toast.error(e.message ?? "Analysis failed"); }
    finally { setLoading(false); }
  }

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-4">
      <Card className="h-fit">
        <CardHeader><CardTitle className="text-base">Input</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {active.data?.name ? (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FileText className="size-3.5" /> Active resume: <span className="font-medium text-foreground">{active.data.name}</span>
            </div>
          ) : null}
          <div className="space-y-1.5"><Label>Target role</Label><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Senior Frontend Engineer" /></div>
          <div className="space-y-1.5"><Label>Job description (optional)</Label><Textarea rows={5} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the JD for tighter analysis…" /></div>
          <div className="space-y-1.5">
            <Label>Resume text {active.data?.text ? <span className="text-xs text-muted-foreground">(leave blank to use active resume)</span> : null}</Label>
            <Textarea rows={10} value={resume} onChange={(e) => setResume(e.target.value)} placeholder="Paste resume content…" />
          </div>
          <Button onClick={run} disabled={loading} className="w-full">
            {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Wand2 className="size-4 mr-2" />}
            {loading ? "Analyzing…" : "Analyze resume"}
          </Button>
        </CardContent>
      </Card>

      <div>
        {loading && !result ? (
          <Card><CardContent className="py-16 text-center text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin mx-auto mb-3" />Running deep analysis…</CardContent></Card>
        ) : !result ? (
          <EmptyState icon={Sparkles} title="No analysis yet" description="Run an analysis to get an ATS score, section-wise breakdown, keyword heatmap, skill gaps, readability, and an improvement checklist." />
        ) : <AnalysisView result={result} />}
      </div>
    </div>
  );
}

function scoreTone(n: number) {
  if (n >= 80) return "text-success";
  if (n >= 60) return "text-primary";
  if (n >= 40) return "text-warning-foreground";
  return "text-destructive";
}

function AnalysisView({ result }: { result: ResumeAnalysis }) {
  const sectionEntries = Object.entries(result.sections) as Array<[string, { score: number; findings: string[]; recommendations: string[] }]>;
  return (
    <div className="space-y-4">
      {/* Score header */}
      <Card>
        <CardContent className="p-6 flex flex-col sm:flex-row items-start gap-6">
          <div className="flex items-center gap-4">
            <div className={`size-24 rounded-full border-4 grid place-items-center font-semibold text-3xl ${scoreTone(result.ats_score)}`} style={{ borderColor: "currentColor" }}>
              {Math.round(result.ats_score)}
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground tracking-wide">ATS Score</div>
              <p className="text-sm max-w-md">{result.ats_explanation || result.summary}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 flex-1 sm:pl-6 sm:border-l">
            <MetricPill label="Readability" value={result.readability.score} suffix={result.readability.grade_level ? ` · ${result.readability.grade_level}` : ""} />
            <MetricPill label="Impact" value={result.experience_analysis.impact_score} />
            <MetricPill label="Quantified bullets" value={result.experience_analysis.quantified_bullets} total={result.experience_analysis.total_bullets} raw />
            <MetricPill label="Projects" value={result.project_analysis.count} raw />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
          <TabsTrigger value="skills">Skill gaps</TabsTrigger>
          <TabsTrigger value="experience">Experience</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid md:grid-cols-2 gap-4">
          <Chips title="Strengths" items={result.strengths} tone="success" />
          <Chips title="Missing skills" items={result.missing_skills} tone="warn" />
          <Chips title="Keyword matches" items={result.keyword_match} tone="info" />
          <Chips title="Formatting issues" items={result.formatting_issues} />
          <Chips title="Grammar issues" items={result.grammar_issues} />
          <Chips title="Top improvements" items={result.improvements} tone="primary" />
          {result.readability.notes.length ? (
            <Card className="md:col-span-2"><CardHeader><CardTitle className="text-sm">Recruiter readability notes</CardTitle></CardHeader><CardContent><ul className="text-sm list-disc pl-5 space-y-1">{result.readability.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></CardContent></Card>
          ) : null}
        </TabsContent>

        <TabsContent value="sections" className="mt-4 grid md:grid-cols-2 gap-3">
          {sectionEntries.map(([name, s]) => (
            <Card key={name}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm capitalize">{name}</CardTitle>
                  <span className={`text-sm font-semibold ${scoreTone(s.score)}`}>{Math.round(s.score)}</span>
                </div>
                <Progress value={s.score} className="h-1.5 mt-1" />
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {s.findings.length ? <div><div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Findings</div><ul className="list-disc pl-5 space-y-0.5">{s.findings.map((f, i) => <li key={i}>{f}</li>)}</ul></div> : null}
                {s.recommendations.length ? <div><div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Recommendations</div><ul className="list-disc pl-5 space-y-0.5">{s.recommendations.map((f, i) => <li key={i}>{f}</li>)}</ul></div> : null}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="keywords" className="mt-4">
          <Card><CardHeader><CardTitle className="text-sm">Keyword heatmap</CardTitle></CardHeader><CardContent>
            {result.keyword_heatmap.length === 0 ? <p className="text-sm text-muted-foreground">No heatmap data.</p> : (
              <div className="flex flex-wrap gap-2">
                {result.keyword_heatmap.map((k, i) => {
                  const intensity = Math.min(k.count, 6) / 6;
                  const missing = !k.present;
                  const bg = missing ? "hsl(var(--destructive) / 0.08)" : `hsl(var(--primary) / ${0.08 + intensity * 0.35})`;
                  const border = missing ? "hsl(var(--destructive) / 0.3)" : `hsl(var(--primary) / ${0.2 + intensity * 0.4})`;
                  return (
                    <span key={i} title={`${k.importance} · ${k.present ? `${k.count} occurrence(s)` : "missing"}`}
                      className="px-2.5 py-1 rounded-md text-xs border flex items-center gap-1.5"
                      style={{ background: bg, borderColor: border }}>
                      <span className="font-medium">{k.keyword}</span>
                      <span className="text-[10px] opacity-70">{missing ? "missing" : `×${k.count}`}</span>
                      {k.importance === "high" ? <Badge variant="secondary" className="h-4 px-1 text-[9px]">high</Badge> : null}
                    </span>
                  );
                })}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="skills" className="mt-4">
          <Card><CardHeader><CardTitle className="text-sm">Skill gap analysis</CardTitle></CardHeader><CardContent>
            {result.skill_gaps.length === 0 ? <p className="text-sm text-muted-foreground">No significant gaps detected.</p> : (
              <ul className="divide-y">
                {result.skill_gaps.map((g, i) => (
                  <li key={i} className="py-2.5 flex items-start gap-3">
                    <Badge variant={g.importance === "high" ? "destructive" : g.importance === "medium" ? "default" : "secondary"}>{g.importance}</Badge>
                    <div>
                      <div className="text-sm font-medium">{g.skill}</div>
                      <div className="text-xs text-muted-foreground">{g.why}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="experience" className="mt-4">
          <AnalysisBlock title="Experience analysis"
            stats={[
              { label: "Impact", value: `${Math.round(result.experience_analysis.impact_score)}/100` },
              { label: "Quantified", value: `${result.experience_analysis.quantified_bullets}/${result.experience_analysis.total_bullets}` },
            ]}
            findings={result.experience_analysis.findings}
            recommendations={result.experience_analysis.recommendations} />
        </TabsContent>
        <TabsContent value="projects" className="mt-4">
          <AnalysisBlock title="Project analysis" stats={[{ label: "Count", value: String(result.project_analysis.count) }]} findings={result.project_analysis.findings} recommendations={result.project_analysis.recommendations} />
        </TabsContent>
        <TabsContent value="education" className="mt-4">
          <AnalysisBlock title="Education analysis" findings={result.education_analysis.findings} recommendations={result.education_analysis.recommendations} />
        </TabsContent>
        <TabsContent value="achievements" className="mt-4">
          <AnalysisBlock title="Achievement analysis"
            findings={result.achievements_analysis.findings}
            recommendations={result.achievements_analysis.recommendations}
            extra={result.achievements_analysis.quantified.length ? (
              <div><div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Quantified metrics found</div>
                <div className="flex flex-wrap gap-1.5">{result.achievements_analysis.quantified.map((q, i) => <span key={i} className="px-2 py-0.5 rounded bg-success/10 text-success text-xs border border-success/20">{q}</span>)}</div>
              </div>
            ) : null} />
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          <Card><CardHeader><CardTitle className="text-sm">Improvement checklist</CardTitle></CardHeader><CardContent>
            <ChecklistView items={result.improvement_checklist} />
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChecklistView({ items }: { items: ResumeAnalysis["improvement_checklist"] }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nothing to improve — nice work.</p>;
  const groups = items.reduce<Record<string, Array<{ i: number; item: typeof items[0] }>>>((acc, item, i) => {
    const k = item.category || "General";
    (acc[k] ??= []).push({ i, item });
    return acc;
  }, {});
  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([cat, list]) => (
        <div key={cat}>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{cat}</div>
          <ul className="space-y-1.5">
            {list.map(({ i, item }) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <button onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))} className="mt-0.5 shrink-0" aria-label="toggle done">
                  {done[i] ? <CheckCircle2 className="size-4 text-success" /> : <div className="size-4 rounded-full border" />}
                </button>
                <div className={done[i] ? "line-through text-muted-foreground" : ""}>{item.item}</div>
                <Badge variant={item.priority === "high" ? "destructive" : item.priority === "medium" ? "default" : "secondary"} className="ml-auto text-[10px] h-5">{item.priority}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AnalysisBlock({ title, stats, findings, recommendations, extra }: { title: string; stats?: Array<{ label: string; value: string }>; findings: string[]; recommendations: string[]; extra?: React.ReactNode }) {
  return (
    <Card><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent className="space-y-3">
      {stats?.length ? (
        <div className="flex gap-2 flex-wrap">
          {stats.map((s) => <div key={s.label} className="px-3 py-1.5 rounded-md bg-muted text-xs"><span className="text-muted-foreground">{s.label}:</span> <span className="font-semibold">{s.value}</span></div>)}
        </div>
      ) : null}
      {extra}
      {findings.length ? <div><div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Findings</div><ul className="list-disc pl-5 text-sm space-y-0.5">{findings.map((f, i) => <li key={i}>{f}</li>)}</ul></div> : null}
      {recommendations.length ? <div><div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Recommendations</div><ul className="list-disc pl-5 text-sm space-y-0.5">{recommendations.map((f, i) => <li key={i}>{f}</li>)}</ul></div> : null}
      {!findings.length && !recommendations.length && !extra ? <p className="text-sm text-muted-foreground">No notes.</p> : null}
    </CardContent></Card>
  );
}

function MetricPill({ label, value, total, raw, suffix }: { label: string; value: number; total?: number; raw?: boolean; suffix?: string }) {
  const display = raw ? (total != null ? `${value}/${total}` : String(value)) : `${Math.round(value)}${suffix ?? ""}`;
  return (
    <div className="px-3 py-2 rounded-lg bg-accent/50 border">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${!raw ? scoreTone(value) : ""}`}>{display}</div>
    </div>
  );
}

function Chips({ title, items, tone }: { title: string; items: string[]; tone?: "success" | "warn" | "info" | "primary" }) {
  if (!items?.length) return null;
  const cls = tone === "success" ? "bg-success/10 text-success border-success/20"
    : tone === "warn" ? "bg-warning/15 text-warning-foreground border-warning/30"
    : tone === "info" ? "bg-accent text-accent-foreground border-border"
    : tone === "primary" ? "bg-primary/10 text-primary border-primary/20"
    : "bg-muted text-muted-foreground border-border";
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
    <CardContent><ul className="flex flex-wrap gap-1.5">
      {items.map((i, idx) => <li key={idx} className={`px-2.5 py-1 rounded-md text-xs border ${cls}`}>{i}</li>)}
    </ul></CardContent></Card>
  );
}

function HistoryTab() {
  const { data, isLoading } = useAnalysisHistory();
  const [selected, setSelected] = useState<HistoryRow | null>(null);

  const trend = useMemo(() => {
    if (!data) return [];
    return [...data].reverse().map((d) => ({ id: d.id, score: d.output?.ats_score ?? 0, when: d.created_at }));
  }, [data]);

  if (isLoading) return <Card><CardContent className="py-12 text-center"><Loader2 className="size-5 animate-spin mx-auto" /></CardContent></Card>;
  if (!data?.length) return <EmptyState icon={History} title="No history yet" description="Run your first analysis to build a score history." />;

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Score history</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <SparkTrend points={trend.map((p) => p.score)} />
          <div className="divide-y max-h-[520px] overflow-y-auto -mx-2">
            {data.map((row) => (
              <button key={row.id} onClick={() => setSelected(row)} className={`w-full text-left px-2 py-2.5 hover:bg-accent rounded-md transition-colors ${selected?.id === row.id ? "bg-accent" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium truncate">{row.title || "Analysis"}</div>
                  <span className={`text-sm font-semibold ${scoreTone(row.output?.ats_score ?? 0)}`}>{Math.round(row.output?.ats_score ?? 0)}</span>
                </div>
                <div className="text-xs text-muted-foreground">{format(new Date(row.created_at), "PP p")}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <div>
        {selected ? <AnalysisView result={selected.output} /> : <EmptyState icon={AlertTriangle} title="Pick an analysis" description="Select a run on the left to view details." />}
      </div>
    </div>
  );
}

function SparkTrend({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="text-xs text-muted-foreground">Run more analyses to see a trend.</div>;
  const w = 320, h = 60, pad = 4;
  const max = Math.max(100, ...points);
  const min = Math.min(0, ...points);
  const scaleX = (i: number) => pad + (i * (w - pad * 2)) / (points.length - 1);
  const scaleY = (v: number) => h - pad - ((v - min) * (h - pad * 2)) / (max - min || 1);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${scaleX(i)},${scaleY(p)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
      <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
      {points.map((p, i) => <circle key={i} cx={scaleX(i)} cy={scaleY(p)} r={2.5} fill="hsl(var(--primary))" />)}
    </svg>
  );
}

function CompareTab() {
  const fn = useServerFn(compareResumes);
  const { data: history } = useAnalysisHistory();
  const [a, setA] = useState(""); const [b, setB] = useState("");
  const [la, setLa] = useState("Version A"); const [lb, setLb] = useState("Version B");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function run() {
    if (a.trim().length < 50 || b.trim().length < 50) return toast.error("Paste both resumes (min 50 chars each).");
    setLoading(true);
    try {
      const r = await fn({ data: { resume_a: a, resume_b: b, label_a: la, label_b: lb, target_role: role || undefined } });
      if (!r || !("winner" in r)) throw new Error("Invalid AI response.");
      setResult(r);
      toast.success("Comparison complete");
    } catch (e: any) { toast.error(e.message ?? "Compare failed"); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Compare two resume versions</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Input value={la} onChange={(e) => setLa(e.target.value)} placeholder="Label A" />
            <Textarea rows={10} value={a} onChange={(e) => setA(e.target.value)} placeholder="Paste Resume A…" />
          </div>
          <div className="space-y-2">
            <Input value={lb} onChange={(e) => setLb(e.target.value)} placeholder="Label B" />
            <Textarea rows={10} value={b} onChange={(e) => setB(e.target.value)} placeholder="Paste Resume B…" />
          </div>
          <div className="md:col-span-2 flex flex-col sm:flex-row gap-2 sm:items-center">
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Target role (optional)" className="max-w-sm" />
            <Button onClick={run} disabled={loading} className="sm:ml-auto">{loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <GitCompare className="size-4 mr-2" />}Compare</Button>
          </div>
          {history && history.length >= 2 ? (
            <p className="md:col-span-2 text-xs text-muted-foreground">Tip: you have {history.length} past analyses in history — paste the same resume text used in those runs to compare directly.</p>
          ) : null}
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader><CardTitle className="text-sm">Result</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-lg border"><div className="text-xs text-muted-foreground">{la}</div><div className={`text-3xl font-semibold ${scoreTone(result.score_a)}`}>{Math.round(result.score_a)}</div></div>
              <div className="p-4 rounded-lg border"><div className="text-xs text-muted-foreground">{lb}</div><div className={`text-3xl font-semibold ${scoreTone(result.score_b)}`}>{Math.round(result.score_b)}</div></div>
              <div className="p-4 rounded-lg border bg-accent"><div className="text-xs text-muted-foreground">Winner</div><div className="text-lg font-semibold capitalize">{result.winner === "a" ? la : result.winner === "b" ? lb : "Tie"}</div></div>
            </div>
            {result.verdict ? <p className="text-sm">{result.verdict}</p> : null}
            <div className="grid md:grid-cols-2 gap-3">
              <Chips title={`Improvements ${la} → ${lb}`} items={result.improvements_a_to_b} tone="success" />
              <Chips title="Regressions" items={result.regressions_a_to_b} tone="warn" />
              <Chips title="Keywords added" items={result.keyword_delta?.added ?? []} tone="info" />
              <Chips title="Keywords removed" items={result.keyword_delta?.removed ?? []} />
              <Chips title="Recommendations" items={result.recommendations} tone="primary" />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
