import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { careerCoach, type CareerPlan } from "@/features/ai/ai.functions";
import {
  getCareerProfile, upsertCareerProfile,
  listGoals, createGoal, updateGoal, deleteGoal,
  listSkills, createSkill, updateSkill, deleteSkill,
  listCareerPlans, getCareerDashboard,
  adoptRecommendedGoal, adoptRecommendedSkill,
} from "@/features/career/career.functions";
import { useActiveResumeText } from "@/hooks/use-active-resume";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  Loader2, Compass, Target, TrendingUp, BookOpen, Briefcase, Building2, Cpu, Award,
  Plus, Trash2, CheckCircle2, History, Sparkles, GraduationCap, FileText,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ai/career-coach")({
  head: () => ({ meta: [{ title: "Career Coach · CareerOS AI" }] }),
  component: CareerCoachPage,
});

type Goal = Awaited<ReturnType<typeof listGoals>>[number];
type Skill = Awaited<ReturnType<typeof listSkills>>[number];

function CareerCoachPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "plan" | "goals" | "skills" | "history">("overview");

  const dashFn = useServerFn(getCareerDashboard);
  const profFn = useServerFn(getCareerProfile);
  const goalsFn = useServerFn(listGoals);
  const skillsFn = useServerFn(listSkills);
  const plansFn = useServerFn(listCareerPlans);

  const dashboard = useQuery({ queryKey: ["career", "dashboard"], queryFn: () => dashFn() });
  const profile = useQuery({ queryKey: ["career", "profile"], queryFn: () => profFn() });
  const goals = useQuery({ queryKey: ["career", "goals"], queryFn: () => goalsFn() });
  const skills = useQuery({ queryKey: ["career", "skills"], queryFn: () => skillsFn() });
  const plans = useQuery({ queryKey: ["career", "plans"], queryFn: () => plansFn() });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["career"] });
  };

  return (
    <div>
      <PageHeader title="AI Career Coach" description="Personalized roadmaps, goal & skill tracking, and tailored recommendations." />
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="overview"><TrendingUp className="size-3.5 mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="plan"><Compass className="size-3.5 mr-1.5" />Plan</TabsTrigger>
          <TabsTrigger value="goals"><Target className="size-3.5 mr-1.5" />Goals</TabsTrigger>
          <TabsTrigger value="skills"><Sparkles className="size-3.5 mr-1.5" />Skills</TabsTrigger>
          <TabsTrigger value="history"><History className="size-3.5 mr-1.5" />History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab dashboard={dashboard.data} goals={goals.data ?? []} skills={skills.data ?? []} onJump={setTab} />
        </TabsContent>
        <TabsContent value="plan" className="mt-4">
          <PlanTab profile={profile.data} onGenerated={invalidateAll} />
        </TabsContent>
        <TabsContent value="goals" className="mt-4">
          <GoalsTab goals={goals.data ?? []} onChange={invalidateAll} />
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <SkillsTab skills={skills.data ?? []} onChange={invalidateAll} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab plans={plans.data ?? []} onAdopt={invalidateAll} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ Overview ============

function OverviewTab({ dashboard, goals, skills, onJump }: {
  dashboard: any; goals: Goal[]; skills: Skill[]; onJump: (t: "overview" | "plan" | "goals" | "skills" | "history") => void;
}) {
  if (!dashboard) return <Loader />;
  const activeGoals = goals.filter((g) => g.status === "active").slice(0, 5);
  const topSkills = [...skills].sort((a, b) => (b.current_level ?? 0) - (a.current_level ?? 0)).slice(0, 6);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active goals" value={dashboard.counts.goals_active} icon={<Target className="size-4" />} />
        <StatCard label="Completed goals" value={dashboard.counts.goals_completed} icon={<CheckCircle2 className="size-4" />} />
        <StatCard label="Skills tracked" value={dashboard.counts.skills_tracked} icon={<Sparkles className="size-4" />} />
        <StatCard label="Applications" value={dashboard.counts.applications} icon={<Briefcase className="size-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="size-4" /> Goal progress</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">Average completion</span><span className="font-medium">{dashboard.goal_progress}%</span></div>
              <Progress value={dashboard.goal_progress} />
            </div>
            {activeGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active goals yet. <button className="underline" onClick={() => onJump("goals")}>Add one</button> or <button className="underline" onClick={() => onJump("plan")}>generate a plan</button>.</p>
            ) : (
              <ul className="space-y-2">
                {activeGoals.map((g) => (
                  <li key={g.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{g.title}</span>
                      <span className="text-muted-foreground">{g.progress}%</span>
                    </div>
                    <Progress value={g.progress ?? 0} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="size-4" /> Skill mastery</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">Toward target</span><span className="font-medium">{dashboard.skill_progress}%</span></div>
              <Progress value={dashboard.skill_progress} />
            </div>
            {topSkills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skills tracked. <button className="underline" onClick={() => onJump("skills")}>Add a skill</button>.</p>
            ) : (
              <ul className="space-y-2">
                {topSkills.map((s) => (
                  <li key={s.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{s.name}</span>
                      <span className="text-muted-foreground">{s.current_level}/{s.target_level}</span>
                    </div>
                    <Progress value={Math.min(100, ((s.current_level ?? 0) / Math.max(1, s.target_level ?? 100)) * 100)} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            {dashboard.last_plan_at
              ? <>Last plan generated <span className="font-medium">{new Date(dashboard.last_plan_at).toLocaleDateString()}</span>. Refresh it whenever your goals or skills change.</>
              : "No AI plan yet. Generate your first personalized roadmap."}
          </div>
          <Button onClick={() => onJump("plan")}><Compass className="size-4 mr-1.5" /> {dashboard.last_plan_at ? "Refresh plan" : "Generate plan"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs">{label}{icon}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

// ============ Plan ============

function PlanTab({ profile, onGenerated }: { profile: any; onGenerated: () => void }) {
  const fn = useServerFn(careerCoach);
  const saveProfile = useServerFn(upsertCareerProfile);
  const activeResume = useActiveResumeText();

  const [form, setForm] = useState({
    target_role: "",
    current_title: "",
    years_experience: "",
    location: "",
    context_summary: "",
    resume_text: "",
  });
  const [useResume, setUseResume] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CareerPlan | null>(null);

  useEffect(() => {
    if (profile) {
      setForm((f) => ({
        ...f,
        target_role: profile.target_role ?? "",
        current_title: profile.current_title ?? "",
        years_experience: profile.years_experience?.toString() ?? "",
        location: profile.location ?? "",
        context_summary: profile.context_summary ?? "",
      }));
    }
  }, [profile]);

  async function run() {
    setLoading(true);
    try {
      const payload = {
        target_role: form.target_role || undefined,
        current_title: form.current_title || undefined,
        years_experience: form.years_experience ? Number(form.years_experience) : undefined,
        location: form.location || undefined,
        context_summary: form.context_summary || undefined,
        resume_text: (useResume && activeResume.data?.text) ? activeResume.data.text : (form.resume_text || undefined),
      };
      const res = await fn({ data: payload });
      setResult(res);
      await saveProfile({ data: {
        target_role: payload.target_role ?? null,
        current_title: payload.current_title ?? null,
        years_experience: payload.years_experience ?? null,
        location: payload.location ?? null,
        context_summary: payload.context_summary ?? null,
      } }).catch(() => {});
      onGenerated();
      toast.success("Personalized career plan generated");
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Target role"><Input value={form.target_role} onChange={(e) => setForm({ ...form, target_role: e.target.value })} placeholder="Staff ML Engineer" /></Field>
            <Field label="Current title"><Input value={form.current_title} onChange={(e) => setForm({ ...form, current_title: e.target.value })} placeholder="Senior Frontend Engineer" /></Field>
            <Field label="Years experience"><Input type="number" min={0} value={form.years_experience} onChange={(e) => setForm({ ...form, years_experience: e.target.value })} placeholder="4" /></Field>
            <Field label="Location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Remote · EU" /></Field>
          </div>
          <Field label="Your situation (optional)">
            <Textarea rows={2} value={form.context_summary} onChange={(e) => setForm({ ...form, context_summary: e.target.value })} placeholder="Bootcamp grad transitioning from marketing…" />
          </Field>
          {activeResume.data?.text ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useResume} onChange={(e) => setUseResume(e.target.checked)} />
              <FileText className="size-3.5" /> Use active resume ({activeResume.data.name})
            </label>
          ) : (
            <Field label="Resume text (optional)">
              <Textarea rows={4} value={form.resume_text} onChange={(e) => setForm({ ...form, resume_text: e.target.value })} />
            </Field>
          )}
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Compass className="size-4 mr-1.5" />}
            Build my personalized plan
          </Button>
        </CardContent>
      </Card>

      {result && <PlanResult result={result} onAdopt={onGenerated} />}
    </div>
  );
}

function PlanResult({ result, onAdopt }: { result: CareerPlan; onAdopt: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="size-4" /> Insights</CardTitle></CardHeader>
        <CardContent><p className="text-sm leading-relaxed whitespace-pre-wrap">{result.insights}</p></CardContent>
      </Card>

      <WeeklyRoadmapCard items={result.weekly_roadmap} />
      <MonthlyRoadmapCard items={result.monthly_roadmap} />

      <RecommendedSkillsCard items={result.skill_recommendations} onAdopt={onAdopt} />
      <RecommendedGoalsCard items={result.goal_recommendations} onAdopt={onAdopt} />
      <LearningCard items={result.learning_recommendations} />
      <TechCard items={result.technology_recommendations} />
      <CompaniesCard items={result.company_recommendations} />
      <InternshipsCard items={result.internship_recommendations} />
      <CertificationsCard items={result.certification_recommendations} />
    </div>
  );
}

function WeeklyRoadmapCard({ items }: { items: CareerPlan["weekly_roadmap"] }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Compass className="size-4" /> Weekly roadmap</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.map((d, i) => (
          <div key={i} className="border-l-2 border-primary/40 pl-3">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>{d.day} · {d.focus}</span>
              <span className="text-xs text-muted-foreground">{d.hours}h</span>
            </div>
            <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground list-disc pl-4">
              {d.tasks.map((t, j) => <li key={j}>{t}</li>)}
            </ul>
            <div className="text-xs mt-1"><span className="text-muted-foreground">Outcome: </span>{d.outcome}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MonthlyRoadmapCard({ items }: { items: CareerPlan["monthly_roadmap"] }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="size-4" /> Monthly roadmap</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.map((w, i) => (
          <div key={i} className="rounded-md border border-border p-3">
            <div className="text-sm font-medium">{w.week} · {w.theme}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Milestones</div>
                <ul className="text-sm list-disc pl-4 space-y-0.5">{w.milestones.map((m, j) => <li key={j}>{m}</li>)}</ul>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Deliverables</div>
                <ul className="text-sm list-disc pl-4 space-y-0.5">{w.deliverables.map((m, j) => <li key={j}>{m}</li>)}</ul>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RecommendedSkillsCard({ items, onAdopt }: { items: CareerPlan["skill_recommendations"]; onAdopt: () => void }) {
  const adopt = useServerFn(adoptRecommendedSkill);
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="size-4" /> Recommended skills</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.map((s, i) => (
          <div key={i} className="border-b border-border last:border-0 pb-3 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{s.name} <span className="text-xs text-muted-foreground font-normal">· {s.category}</span></div>
                <p className="text-xs text-muted-foreground mt-0.5">{s.why}</p>
              </div>
              <PriorityBadge value={s.priority} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Progress value={Math.min(100, (s.current_level / Math.max(1, s.target_level)) * 100)} className="flex-1" />
              <span className="text-xs text-muted-foreground shrink-0">{s.current_level}/{s.target_level}</span>
              <Button size="sm" variant="outline" onClick={async () => { await adopt({ data: { name: s.name, category: s.category, current_level: s.current_level, target_level: s.target_level, priority: s.priority } }); toast.success("Skill added"); onAdopt(); }}>
                <Plus className="size-3.5" /> Track
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RecommendedGoalsCard({ items, onAdopt }: { items: CareerPlan["goal_recommendations"]; onAdopt: () => void }) {
  const adopt = useServerFn(adoptRecommendedGoal);
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="size-4" /> Recommended goals</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.map((g, i) => (
          <div key={i} className="border-b border-border last:border-0 pb-3 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{g.title}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>
              </div>
              <PriorityBadge value={g.priority} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{g.category} · {g.timeframe_weeks}w</span>
              <Button size="sm" variant="outline" onClick={async () => { await adopt({ data: g }); toast.success("Goal added"); onAdopt(); }}>
                <Plus className="size-3.5" /> Add goal
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LearningCard({ items }: { items: CareerPlan["learning_recommendations"] }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><BookOpen className="size-4" /> Learning</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.map((l, i) => (
          <div key={i} className="text-sm">
            <div className="font-medium flex items-center gap-2">{l.title} <Badge variant="outline" className="text-[10px]">{l.type}</Badge></div>
            <div className="text-xs text-muted-foreground">{l.provider} · {l.duration}</div>
            <p className="text-xs mt-1">{l.why}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function InternshipsCard({ items }: { items: CareerPlan["internship_recommendations"] }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><GraduationCap className="size-4" /> Internships & fellowships</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.map((r, i) => (
          <div key={i} className="text-sm">
            <div className="font-medium">{r.role} @ {r.company} <span className="text-xs text-muted-foreground font-normal">· {r.type}</span></div>
            <p className="text-xs text-muted-foreground mt-0.5">{r.why}</p>
            <p className="text-xs mt-1"><span className="text-muted-foreground">How: </span>{r.how_to_apply}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CompaniesCard({ items }: { items: CareerPlan["company_recommendations"] }) {
  if (!items.length) return null;
  const grouped = { reach: [] as typeof items, target: [] as typeof items, safety: [] as typeof items };
  items.forEach((c) => grouped[c.tier].push(c));
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="size-4" /> Target companies</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {(["reach", "target", "safety"] as const).map((tier) => grouped[tier].length ? (
          <div key={tier}>
            <div className="text-xs uppercase text-muted-foreground mb-1">{tier}</div>
            <ul className="space-y-2">
              {grouped[tier].map((c, i) => (
                <li key={i} className="text-sm">
                  <div className="font-medium">{c.name}</div>
                  <p className="text-xs text-muted-foreground">{c.why}</p>
                  <div className="flex flex-wrap gap-1 mt-1">{c.roles.map((r, j) => <Badge key={j} variant="outline" className="text-[10px]">{r}</Badge>)}</div>
                </li>
              ))}
            </ul>
          </div>
        ) : null)}
      </CardContent>
    </Card>
  );
}

function TechCard({ items }: { items: CareerPlan["technology_recommendations"] }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cpu className="size-4" /> Technologies to learn</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map((t, i) => (
          <div key={i} className="flex items-start justify-between gap-2 text-sm">
            <div className="min-w-0">
              <div className="font-medium">{t.name} <span className="text-xs text-muted-foreground font-normal">· {t.category}</span></div>
              <p className="text-xs text-muted-foreground">{t.why}</p>
            </div>
            <PriorityBadge value={t.priority} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CertificationsCard({ items }: { items: CareerPlan["certification_recommendations"] }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Award className="size-4" /> Certifications</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map((c, i) => (
          <div key={i} className="text-sm">
            <div className="font-medium">{c.name} <span className="text-xs text-muted-foreground font-normal">· {c.provider}</span></div>
            <div className="text-xs text-muted-foreground">{c.difficulty} · {c.duration} · {c.cost_estimate}</div>
            <p className="text-xs mt-0.5">{c.why}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============ Goals ============

function GoalsTab({ goals, onChange }: { goals: Goal[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const create = useServerFn(createGoal);
  const update = useServerFn(updateGoal);
  const del = useServerFn(deleteGoal);

  const active = goals.filter((g) => g.status !== "archived");
  const grouped = useMemo(() => ({
    active: active.filter((g) => g.status === "active"),
    completed: active.filter((g) => g.status === "completed"),
    paused: active.filter((g) => g.status === "paused"),
  }), [active]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{active.length} goals</p>
        <GoalDialog open={open} onOpenChange={setOpen} onSubmit={async (v) => { await create({ data: v }); toast.success("Goal created"); onChange(); setOpen(false); }} />
      </div>
      {(["active", "paused", "completed"] as const).map((s) => grouped[s].length ? (
        <div key={s}>
          <h3 className="text-sm font-medium capitalize mb-2">{s} ({grouped[s].length})</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {grouped[s].map((g) => (
              <GoalCard key={g.id} goal={g}
                onUpdate={async (patch) => { await update({ data: { id: g.id, patch } }); onChange(); }}
                onDelete={async () => { await del({ data: { id: g.id } }); toast.success("Deleted"); onChange(); }}
              />
            ))}
          </div>
        </div>
      ) : null)}
      {active.length === 0 && <EmptyState label="No goals yet. Add one or generate a plan for AI-recommended goals." />}
    </div>
  );
}

function GoalDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (b: boolean) => void; onSubmit: (v: any) => void }) {
  const [form, setForm] = useState({ title: "", description: "", category: "", target_date: "", priority: "medium" as "high" | "medium" | "low" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" /> New goal</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New goal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Learning, Job Search…" /></Field>
            <Field label="Target date"><Input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} /></Field>
          </div>
          <Field label="Priority">
            <Select value={form.priority} onValueChange={(v: any) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button disabled={!form.title} onClick={() => onSubmit({ ...form, target_date: form.target_date || undefined, description: form.description || undefined, category: form.category || undefined })}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GoalCard({ goal, onUpdate, onDelete }: { goal: Goal; onUpdate: (patch: any) => Promise<void>; onDelete: () => void }) {
  const [progress, setProgress] = useState(goal.progress ?? 0);
  useEffect(() => setProgress(goal.progress ?? 0), [goal.progress]);
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{goal.title}</div>
            {goal.description && <p className="text-xs text-muted-foreground mt-0.5">{goal.description}</p>}
          </div>
          <PriorityBadge value={goal.priority as any} />
        </div>
        <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
          {goal.category && <span>{goal.category}</span>}
          {goal.target_date && <span>· due {new Date(goal.target_date).toLocaleDateString()}</span>}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs"><span>Progress</span><span>{progress}%</span></div>
          <Slider min={0} max={100} step={5} value={[progress]} onValueChange={(v) => setProgress(v[0])} onValueCommit={(v) => onUpdate({ progress: v[0], status: v[0] >= 100 ? "completed" : goal.status })} />
        </div>
        <div className="flex justify-between items-center pt-1">
          <Select value={goal.status} onValueChange={(v) => onUpdate({ status: v })}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="size-3.5" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Skills ============

function SkillsTab({ skills, onChange }: { skills: Skill[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const create = useServerFn(createSkill);
  const update = useServerFn(updateSkill);
  const del = useServerFn(deleteSkill);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{skills.length} skills tracked</p>
        <SkillDialog open={open} onOpenChange={setOpen} onSubmit={async (v) => { await create({ data: v }); toast.success("Skill added"); onChange(); setOpen(false); }} />
      </div>
      {skills.length === 0 ? (
        <EmptyState label="No skills yet. Add a skill or generate a plan for AI-recommended skills." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {skills.map((s) => (
            <SkillCard key={s.id} skill={s}
              onUpdate={async (patch) => { await update({ data: { id: s.id, patch } }); onChange(); }}
              onDelete={async () => { await del({ data: { id: s.id } }); toast.success("Deleted"); onChange(); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SkillDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (b: boolean) => void; onSubmit: (v: any) => void }) {
  const [form, setForm] = useState({ name: "", category: "", current_level: 20, target_level: 100, priority: "medium" as "high" | "medium" | "low", notes: "" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" /> New skill</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Track a skill</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Skill"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="TypeScript" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Language" /></Field>
            <Field label="Priority">
              <Select value={form.priority} onValueChange={(v: any) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
              </Select>
            </Field>
          </div>
          <Field label={`Current level: ${form.current_level}`}>
            <Slider min={0} max={100} step={5} value={[form.current_level]} onValueChange={(v) => setForm({ ...form, current_level: v[0] })} />
          </Field>
          <Field label={`Target level: ${form.target_level}`}>
            <Slider min={0} max={100} step={5} value={[form.target_level]} onValueChange={(v) => setForm({ ...form, target_level: v[0] })} />
          </Field>
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button disabled={!form.name} onClick={() => onSubmit({ ...form, category: form.category || undefined, notes: form.notes || undefined })}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SkillCard({ skill, onUpdate, onDelete }: { skill: Skill; onUpdate: (patch: any) => Promise<void>; onDelete: () => void }) {
  const [level, setLevel] = useState(skill.current_level ?? 0);
  useEffect(() => setLevel(skill.current_level ?? 0), [skill.current_level]);
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{skill.name}</div>
            <div className="text-xs text-muted-foreground">{skill.category ?? "Uncategorized"}</div>
          </div>
          <PriorityBadge value={skill.priority as any} />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs"><span>Level</span><span>{level} / {skill.target_level}</span></div>
          <Slider min={0} max={100} step={5} value={[level]} onValueChange={(v) => setLevel(v[0])} onValueCommit={(v) => onUpdate({ current_level: v[0], last_practiced_at: new Date().toISOString() })} />
        </div>
        {skill.notes && <p className="text-xs text-muted-foreground">{skill.notes}</p>}
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="size-3.5" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ History ============

function HistoryTab({ plans, onAdopt }: { plans: any[]; onAdopt: () => void }) {
  const [selected, setSelected] = useState<any | null>(null);
  if (!plans.length) return <EmptyState label="No plans yet. Generate your first plan on the Plan tab." />;
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardContent className="p-2">
          <ul className="space-y-1">
            {plans.map((p) => (
              <li key={p.id}>
                <button onClick={() => setSelected(p)} className={`w-full text-left p-2 rounded-md text-sm hover:bg-muted ${selected?.id === p.id ? "bg-muted" : ""}`}>
                  <div className="font-medium truncate">{p.title ?? "Career plan"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</div>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <div>
        {selected ? <PlanResult result={selected.output as CareerPlan} onAdopt={onAdopt} /> : <EmptyState label="Select a plan to view." />}
      </div>
    </div>
  );
}

// ============ Shared ============

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function PriorityBadge({ value }: { value?: "high" | "medium" | "low" }) {
  const v = value ?? "medium";
  const cls = v === "high" ? "border-destructive/40 text-destructive" : v === "low" ? "border-muted-foreground/40 text-muted-foreground" : "";
  return <Badge variant="outline" className={`text-[10px] capitalize ${cls}`}>{v}</Badge>;
}

function EmptyState({ label }: { label: string }) {
  return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{label}</CardContent></Card>;
}

function Loader() {
  return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="size-4 animate-spin mr-2" /> Loading…</div>;
}
