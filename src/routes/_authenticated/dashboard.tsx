import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, MessageSquare, Trophy, XCircle, Clock, Activity, ArrowUpRight, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { STATUS_COLORS, STATUS_LABELS, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · CareerOS AI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("applications").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = apps.length;
  const interviews = apps.filter((a) => a.status === "interview" || a.status === "hr").length;
  const offers = apps.filter((a) => a.status === "offer" || a.status === "joined").length;
  const rejected = apps.filter((a) => a.status === "rejected").length;
  const pending = apps.filter((a) => ["applied", "oa"].includes(a.status)).length;
  const responseRate = total ? Math.round(((interviews + offers + rejected) / total) * 100) : 0;
  const successRate = total ? Math.round((offers / total) * 100) : 0;

  // Monthly chart
  const monthly: Record<string, number> = {};
  apps.forEach((a) => {
    const d = new Date(a.created_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthly[k] = (monthly[k] ?? 0) + 1;
  });
  const monthlyData = Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([k, v]) => ({ month: k.slice(5), count: v }));

  const statusCounts = Object.entries(
    apps.reduce<Record<string, number>>((acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name: STATUS_LABELS[name] ?? name, value }));

  const companyCounts = Object.entries(
    apps.reduce<Record<string, number>>((acc, a) => { acc[a.company] = (acc[a.company] ?? 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([company, count]) => ({ company, count }));

  const upcoming = apps
    .filter((a) => a.deadline && new Date(a.deadline) >= new Date())
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5);

  const recent = apps.slice(0, 6);

  const COLORS = ["oklch(0.54 0.23 277)", "oklch(0.62 0.17 160)", "oklch(0.7 0.18 50)", "oklch(0.58 0.22 25)", "oklch(0.52 0.16 220)", "oklch(0.45 0.1 290)", "oklch(0.7 0.1 30)"];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Your career pipeline at a glance."
        actions={
          <Link to="/applications"><Button><Plus className="size-4" /> Add application</Button></Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <Stat label="Applications" value={total} icon={Briefcase} loading={isLoading} />
        <Stat label="Interviews" value={interviews} icon={MessageSquare} loading={isLoading} />
        <Stat label="Offers" value={offers} icon={Trophy} loading={isLoading} accent />
        <Stat label="Rejections" value={rejected} icon={XCircle} loading={isLoading} />
        <Stat label="Pending" value={pending} icon={Clock} loading={isLoading} />
        <Stat label="Response rate" value={`${responseRate}%`} icon={Activity} loading={isLoading} />
        <Stat label="Success rate" value={`${successRate}%`} icon={ArrowUpRight} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base font-semibold">Monthly applications</CardTitle></CardHeader>
          <CardContent className="h-64">
            {monthlyData.length === 0 ? (
              <Empty label="No applications yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--primary)" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Status breakdown</CardTitle></CardHeader>
          <CardContent className="h-64">
            {statusCounts.length === 0 ? (
              <Empty label="No data yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusCounts} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {statusCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base font-semibold">Top companies</CardTitle></CardHeader>
          <CardContent className="h-56">
            {companyCounts.length === 0 ? <Empty label="No applications yet" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={companyCounts}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="company" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Upcoming deadlines</CardTitle></CardHeader>
          <CardContent>
            {upcoming.length === 0 ? <Empty label="Nothing on the horizon" /> : (
              <ul className="space-y-3">
                {upcoming.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{a.role}</div>
                      <div className="text-xs text-muted-foreground">{a.company}</div>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(a.deadline)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent activity</CardTitle>
            <Link to="/applications" className="text-xs text-primary hover:underline">View all →</Link>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? <Empty label="No applications yet — add your first one" cta /> : (
              <ul className="divide-y divide-border">
                {recent.map((a) => (
                  <li key={a.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{a.role} · <span className="text-muted-foreground font-normal">{a.company}</span></div>
                      <div className="text-xs text-muted-foreground">{formatDate(a.created_at)}{a.location ? ` · ${a.location}` : ""}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[a.status]}`}>{STATUS_LABELS[a.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Quick actions</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            <QuickLink to="/applications" label="Track a new application" />
            <QuickLink to="/ai/resume-analyzer" label="Analyze my resume" />
            <QuickLink to="/ai/cover-letter" label="Generate a cover letter" />
            <QuickLink to="/ai/interview-coach" label="Prepare for an interview" />
            <QuickLink to="/ai/career-coach" label="Build my weekly plan" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, loading, accent }: { label: string; value: number | string; icon: React.ElementType; loading?: boolean; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/[0.03]" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className={`size-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div className="text-2xl font-semibold tracking-tight">
          {loading ? <span className="inline-block h-7 w-12 bg-muted rounded animate-pulse" /> : value}
        </div>
      </CardContent>
    </Card>
  );
}

function Empty({ label, cta }: { label: string; cta?: boolean }) {
  return (
    <div className="h-full grid place-items-center text-center py-6">
      <div>
        <div className="size-10 rounded-lg bg-muted grid place-items-center mx-auto mb-2"><Sparkles className="size-5 text-muted-foreground" /></div>
        <p className="text-sm text-muted-foreground">{label}</p>
        {cta ? <Link to="/applications" className="mt-3 inline-block"><Button size="sm" variant="outline">Add application</Button></Link> : null}
      </div>
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-sm hover:bg-accent hover:border-primary/30 transition">
      <span>{label}</span>
      <ArrowUpRight className="size-4 text-muted-foreground" />
    </Link>
  );
}
