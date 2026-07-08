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
import { Plus, Trash2, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/interview-notes")({
  head: () => ({ meta: [{ title: "Interview Notes · CareerOS AI" }] }),
  component: InterviewNotes,
});

function InterviewNotes() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const { data: notes = [] } = useQuery({
    queryKey: ["interview-notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("interview_notes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload = { ...form, user_id: u.user.id, rating: form.rating ? Number(form.rating) : null };
      const { error } = await supabase.from("interview_notes").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["interview-notes"] }); setOpen(false); setForm({}); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("interview_notes").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interview-notes"] }),
  });

  return (
    <div>
      <PageHeader title="Interview Notes" description="Capture questions, feedback, and lessons after every round." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> New</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New interview note</DialogTitle></DialogHeader>
            <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
              <div className="space-y-1.5"><Label>Company</Label><Input required value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Round</Label><Input value={form.round ?? ""} onChange={(e) => setForm({ ...form, round: e.target.value })} placeholder="Phone Screen / Onsite 2" /></div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={form.interview_date ?? ""} onChange={(e) => setForm({ ...form, interview_date: e.target.value || null })} /></div>
              <div className="space-y-1.5"><Label>Rating (1-5)</Label><Input type="number" min={1} max={5} value={form.rating ?? ""} onChange={(e) => setForm({ ...form, rating: e.target.value })} /></div>
              <div className="col-span-2 space-y-1.5"><Label>Questions asked</Label><Textarea rows={3} value={form.questions ?? ""} onChange={(e) => setForm({ ...form, questions: e.target.value })} /></div>
              <div className="col-span-2 space-y-1.5"><Label>Feedback</Label><Textarea rows={2} value={form.feedback ?? ""} onChange={(e) => setForm({ ...form, feedback: e.target.value })} /></div>
              <div className="col-span-2 space-y-1.5"><Label>Mistakes</Label><Textarea rows={2} value={form.mistakes ?? ""} onChange={(e) => setForm({ ...form, mistakes: e.target.value })} /></div>
              <div className="col-span-2 space-y-1.5"><Label>What I learned</Label><Textarea rows={2} value={form.learning ?? ""} onChange={(e) => setForm({ ...form, learning: e.target.value })} /></div>
              <DialogFooter className="col-span-2"><Button type="submit">Save</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      } />
      <div className="grid md:grid-cols-2 gap-3">
        {notes.length === 0 && <Card className="md:col-span-2"><CardContent className="p-10 text-center text-sm text-muted-foreground">No notes yet.</CardContent></Card>}
        {notes.map((n: any) => (
          <Card key={n.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{n.company} {n.round && <span className="text-xs text-muted-foreground">· {n.round}</span>}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(n.interview_date ?? n.created_at)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {n.rating && <span className="inline-flex items-center gap-0.5 text-xs"><Star className="size-3 fill-warning text-warning" /> {n.rating}/5</span>}
                  <Button size="sm" variant="ghost" onClick={() => del.mutate(n.id)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {n.questions && <p><span className="font-medium">Q: </span>{n.questions}</p>}
                {n.feedback && <p><span className="font-medium">Feedback: </span>{n.feedback}</p>}
                {n.mistakes && <p className="text-destructive"><span className="font-medium">Mistakes: </span>{n.mistakes}</p>}
                {n.learning && <p className="text-success"><span className="font-medium">Learned: </span>{n.learning}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
