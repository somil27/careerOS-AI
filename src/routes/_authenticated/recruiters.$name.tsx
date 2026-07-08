import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User } from "lucide-react";
import { STATUS_COLORS, STATUS_LABELS, formatDate } from "@/lib/format";
import type { App } from "@/features/applications/utils";

export const Route = createFileRoute("/_authenticated/recruiters/$name")({
  head: ({ params }) => ({ meta: [{ title: `${decodeURIComponent(params.name)} · Recruiters` }] }),
  component: RecruiterProfile,
});

function RecruiterProfile() {
  const { name } = Route.useParams();
  const recruiter = decodeURIComponent(name);
  const { data: apps = [] } = useQuery({
    queryKey: ["recruiter-apps", recruiter],
    queryFn: async () => {
      const { data, error } = await supabase.from("applications").select("*").eq("recruiter", recruiter).is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as App[];
    },
  });

  const companies = Array.from(new Set(apps.map((a) => a.company)));

  return (
    <div>
      <PageHeader
        title={recruiter}
        description={`${apps.length} application${apps.length === 1 ? "" : "s"} via this contact.`}
        actions={<Link to="/applications"><Button variant="outline" size="sm"><ArrowLeft className="size-4" /> Back</Button></Link>}
      />

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><User className="size-3.5" /> Applications</div>
          <div className="text-3xl font-semibold mt-1">{apps.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Companies</div>
          <div className="flex flex-wrap gap-1">
            {companies.map((c) => (
              <Link key={c} to="/companies/$name" params={{ name: encodeURIComponent(c) }} className="px-2 py-0.5 rounded bg-accent text-xs hover:underline">{c}</Link>
            ))}
          </div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {apps.length === 0 ? <div className="p-8 text-sm text-muted-foreground text-center">No applications.</div> : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-2.5 text-left">Role</th><th className="px-4 py-2.5 text-left">Company</th><th className="px-4 py-2.5 text-left">Status</th><th className="px-4 py-2.5 text-left">Applied</th></tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{a.role}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.company}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[a.status]}`}>{STATUS_LABELS[a.status]}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(a.application_date)}</td>
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
