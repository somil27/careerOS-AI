import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { STATUS_LABELS } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics · CareerOS AI" }] }),
  component: Analytics,
});

function Analytics() {
  const { data: apps = [] } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => (await supabase.from("applications").select("*")).data ?? [],
  });

  const total = apps.length || 1;
  const interview = apps.filter((a) => ["interview", "hr"].includes(a.status)).length;
  const offers = apps.filter((a) => ["offer", "joined"].includes(a.status)).length;
  const responded = apps.filter((a) => a.status !== "applied").length;

  const monthly: Record<string, number> = {};
  apps.forEach((a) => { const d = new Date(a.created_at); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; monthly[k] = (monthly[k] ?? 0) + 1; });
  const monthlyData = Object.entries(monthly).sort().slice(-12).map(([k, v]) => ({ month: k.slice(2), count: v }));

  const byRole = Object.entries(apps.reduce<Record<string, number>>((acc, a) => { acc[a.role] = (acc[a.role] ?? 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([role, count]) => ({ role, count }));
  const byCompany = Object.entries(apps.reduce<Record<string, number>>((acc, a) => { acc[a.company] = (acc[a.company] ?? 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([company, count]) => ({ company, count }));
  const status = Object.entries(apps.reduce<Record<string, number>>((acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc; }, {})).map(([name, value]) => ({ name: STATUS_LABELS[name] ?? name, value }));
  const COLORS = ["oklch(0.54 0.23 277)", "oklch(0.62 0.17 160)", "oklch(0.7 0.18 50)", "oklch(0.58 0.22 25)", "oklch(0.52 0.16 220)", "oklch(0.45 0.1 290)", "oklch(0.7 0.1 30)"];

  return (
    <div>
      <PageHeader title="Analytics" description="Insights into your job search performance." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Metric label="Response rate" value={`${Math.round((responded / total) * 100)}%`} />
        <Metric label="Interview rate" value={`${Math.round((interview / total) * 100)}%`} />
        <Metric label="Offer rate" value={`${Math.round((offers / total) * 100)}%`} />
        <Metric label="Total applications" value={apps.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Applications by month</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2.5} dot />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Status distribution</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={status} dataKey="value" nameKey="name" outerRadius={90}>
                  {status.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">By role</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byRole}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="role" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">By company</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCompany}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="company" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </CardContent></Card>
  );
}
