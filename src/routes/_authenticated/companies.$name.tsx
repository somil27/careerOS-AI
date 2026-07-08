import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2 } from "lucide-react";
import { STATUS_COLORS, STATUS_LABELS, formatDate } from "@/lib/format";
import type { App } from "@/features/applications/utils";

export const Route = createFileRoute("/_authenticated/companies/$name")({
  head: ({ params }) => ({ meta: [{ title: `${decodeURIComponent(params.name)} · Companies` }] }),
  component: CompanyProfile,
});

function CompanyProfile() {
  const { name } = Route.useParams();
  const company = decodeURIComponent(name);
  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["company-apps", company],
    queryFn: async () => {
      const { data, error } = await supabase.from("applications").select("*").eq("company", company).is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as App[];
    },
  });

  const totals = apps.reduce<Record<string, number>>((acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc; }, {});
  const contacts = Array.from(new Set(apps.map((a) => a.recruiter).filter(Boolean))) as string[];

  return (
    <div>
      <PageHeader
        title={company}
        description={`${apps.length} application${apps.length === 1 ? "" : "s"} at this company.`}
        actions={<Link to="/applications"><Button variant="outline" size="sm"><ArrowLeft className="size-4" /> Back</Button></Link>}
      />

      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="size-3.5" /> Total applications</div>
          <div className="text-3xl font-semibold mt-1">{apps.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Recruiter contacts</div>
          <div className="text-3xl font-semibold mt-1">{contacts.length}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {contacts.slice(0, 4).map((c) => (
              <Link key={c} to="/recruiters/$name" params={{ name: encodeURIComponent(c) }} className="text-xs underline text-muted-foreground">{c}</Link>
            ))}
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-2">Status breakdown</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(totals).map(([s, n]) => (
              <span key={s} className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[s]}`}>{STATUS_LABELS[s]} · {n}</span>
            ))}
          </div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? <div className="p-8 text-sm text-muted-foreground">Loading…</div> : apps.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center">No applications for this company.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-2.5 text-left">Role</th><th className="px-4 py-2.5 text-left">Status</th><th className="px-4 py-2.5 text-left">Applied</th><th className="px-4 py-2.5 text-left">Recruiter</th></tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{a.role}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[a.status]}`}>{STATUS_LABELS[a.status]}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(a.application_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.recruiter ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
