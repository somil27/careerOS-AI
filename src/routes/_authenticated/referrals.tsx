import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Mail, Linkedin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/referrals")({
  head: () => ({ meta: [{ title: "Referrals · CareerOS AI" }] }),
  component: Referrals,
});

function Referrals() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ status: "Requested" });

  const { data: items = [] } = useQuery({
    queryKey: ["referrals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("referrals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("referrals").insert({ ...form, user_id: u.user.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["referrals"] }); setOpen(false); setForm({ status: "Requested" }); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("referrals").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["referrals"] }),
  });

  return (
    <div>
      <PageHeader title="Referrals" description="Track every warm intro and reminder." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> New</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New referral</DialogTitle></DialogHeader>
            <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
              <div className="col-span-2 space-y-1.5"><Label>Referrer name</Label><Input required value={form.referrer_name ?? ""} onChange={(e) => setForm({ ...form, referrer_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Company</Label><Input value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Status</Label><Input value={form.status ?? ""} onChange={(e) => setForm({ ...form, status: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>LinkedIn</Label><Input value={form.linkedin ?? ""} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="col-span-2 space-y-1.5"><Label>Reminder date</Label><Input type="date" value={form.reminder_date ?? ""} onChange={(e) => setForm({ ...form, reminder_date: e.target.value || null })} /></div>
              <div className="col-span-2 space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <DialogFooter className="col-span-2"><Button type="submit">Save</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      } />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.length === 0 && <Card className="md:col-span-2 lg:col-span-3"><CardContent className="p-10 text-center text-sm text-muted-foreground">No referrals yet.</CardContent></Card>}
        {items.map((r: any) => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{r.referrer_name}</div>
                  <div className="text-xs text-muted-foreground">{r.company ?? "—"} · {r.status ?? "—"}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="size-4" /></Button>
              </div>
              <div className="mt-3 flex gap-2 text-xs">
                {r.email && <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Mail className="size-3" />{r.email}</a>}
                {r.linkedin && <a href={r.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Linkedin className="size-3" />Profile</a>}
              </div>
              {r.reminder_date && <p className="mt-2 text-xs text-muted-foreground">Reminder: {formatDate(r.reminder_date)}</p>}
              {r.notes && <p className="mt-2 text-xs">{r.notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
