import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Plus, Trash2, Download, Upload, Search, Loader2, SlidersHorizontal,
  Bookmark, RotateCcw, ChevronLeft, ChevronRight, CalendarDays, Bell,
  ExternalLink, Building2, User, Clock,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { STATUS_COLORS, STATUS_LABELS, formatDate } from "@/lib/format";
import {
  type App, STATUSES, type FilterState, emptyFilter, applyFilter,
  loadSavedFilters, persistSavedFilters, type SavedFilter, loadDraft, saveDraft,
} from "@/features/applications/utils";
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCorners,
  type DragEndEvent, useDraggable, useDroppable,
} from "@dnd-kit/core";
import { addDays, addMonths, endOfMonth, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, endOfWeek } from "date-fns";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({ meta: [{ title: "Applications · CareerOS AI" }] }),
  component: Applications,
});

function Applications() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterState>(emptyFilter);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<App | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [saved, setSaved] = useState<SavedFilter[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setSaved(loadSavedFilters()), []);

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("applications").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as App[];
    },
  });

  const filtered = useMemo(() => applyFilter(apps, filter), [apps, filter]);
  const trash = useMemo(() => apps.filter((a) => a.deleted_at), [apps]);
  const locations = useMemo(() => Array.from(new Set(apps.map((a) => a.location).filter(Boolean) as string[])).sort(), [apps]);
  const companies = useMemo(() => Array.from(new Set(apps.map((a) => a.company))).sort(), [apps]);

  const upsert = useMutation({
    mutationFn: async (a: Partial<App> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      if (a.id) {
        const { error } = await supabase.from("applications").update(a as never).eq("id", a.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("applications").insert({ ...a, user_id: u.user.id } as never);
        if (error) throw error;
        saveDraft(null);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      setOpen(false); setEditing(null); toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Soft-delete with undo
  const softDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("applications").update({ deleted_at: new Date().toISOString() } as never).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      setSelected(new Set());
      toast(`Deleted ${ids.length} application${ids.length > 1 ? "s" : ""}`, {
        action: { label: "Undo", onClick: () => restore.mutate(ids) },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const restore = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("applications").update({ deleted_at: null } as never).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["applications"] }); toast.success("Restored"); },
  });
  const hardDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("applications").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["applications"] }); toast.success("Purged"); },
  });

  const bulkStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase.from("applications").update({ status: status as never }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["applications"] }); setSelected(new Set()); toast.success("Updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateOne = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<App> }) => {
      const { error } = await supabase.from("applications").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applications"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleSel(id: string) {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  }
  function selectAll(list: App[]) {
    if (selected.size === list.length) setSelected(new Set());
    else setSelected(new Set(list.map((a) => a.id)));
  }

  function exportCSV() {
    const headers = ["company", "role", "location", "salary", "application_date", "deadline", "status", "job_url", "recruiter", "referral_status", "notes"];
    const rows = filtered.map((a) => headers.map((h) => JSON.stringify((a as unknown as Record<string, unknown>)[h] ?? "")).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a"); el.href = url; el.download = `applications-${Date.now()}.csv`; el.click();
    URL.revokeObjectURL(url);
  }

  async function importCSV(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return toast.error("Empty CSV");
    const headers = lines[0].split(",").map((h) => h.trim());
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const rows = lines.slice(1).map((line) => {
      const cells = line.match(/("(?:[^"]|"")*"|[^,]+)/g) ?? [];
      const obj: Record<string, unknown> = { user_id: u.user!.id };
      headers.forEach((h, i) => {
        const v = (cells[i] ?? "").replace(/^"|"$/g, "");
        if (v && v !== "null") obj[h] = v;
      });
      return obj;
    });
    const { error } = await supabase.from("applications").insert(rows as never);
    if (error) toast.error(error.message);
    else { toast.success(`Imported ${rows.length} rows`); qc.invalidateQueries({ queryKey: ["applications"] }); }
  }

  function saveCurrentFilter() {
    const name = prompt("Name this filter");
    if (!name) return;
    const next = [...saved, { id: crypto.randomUUID(), name, filter }];
    setSaved(next); persistSavedFilters(next);
    toast.success("Filter saved");
  }

  return (
    <div>
      <PageHeader
        title="Applications"
        description="Track every application in your pipeline."
        actions={
          <>
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && importCSV(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> Import</Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="size-4" /> Export</Button>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
              <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> New</Button></DialogTrigger>
              <AppDialog editing={editing} onSubmit={(v) => upsert.mutate(v)} loading={upsert.isPending} />
            </Dialog>
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder='Smart search — try "status:offer google"'
              value={filter.q}
              onChange={(e) => setFilter({ ...filter, q: e.target.value })}
              className="pl-9"
            />
          </div>

          <AdvancedFilters filter={filter} setFilter={setFilter} companies={companies} locations={locations} />

          <SavedFiltersMenu saved={saved} setSaved={setSaved} onApply={setFilter} onSaveCurrent={saveCurrentFilter} />

          <Select value={`${filter.sortBy}:${filter.sortDir}`} onValueChange={(v) => {
            const [sortBy, sortDir] = v.split(":") as [string, "asc" | "desc"];
            setFilter({ ...filter, sortBy, sortDir });
          }}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at:desc">Newest first</SelectItem>
              <SelectItem value="created_at:asc">Oldest first</SelectItem>
              <SelectItem value="application_date:desc">Applied ↓</SelectItem>
              <SelectItem value="deadline:asc">Deadline ↑</SelectItem>
              <SelectItem value="company:asc">Company A–Z</SelectItem>
            </SelectContent>
          </Select>

          {selected.size > 0 && (
            <>
              <Select onValueChange={(v) => bulkStatus.mutate({ ids: [...selected], status: v })}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder={`Set status (${selected.size})`} /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="destructive" onClick={() => softDelete.mutate([...selected])}><Trash2 className="size-4" /> Delete</Button>
            </>
          )}

          <Button size="sm" variant={showTrash ? "secondary" : "ghost"} onClick={() => setShowTrash((t) => !t)}>
            <Trash2 className="size-4" /> Trash {trash.length ? <Badge variant="secondary" className="ml-1">{trash.length}</Badge> : null}
          </Button>
        </CardContent>
      </Card>

      {showTrash ? (
        <TrashView items={trash} onRestore={(ids) => restore.mutate(ids)} onPurge={(ids) => hardDelete.mutate(ids)} />
      ) : (
        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            <ListView
              items={filtered}
              isLoading={isLoading}
              selected={selected}
              toggleSel={toggleSel}
              selectAll={() => selectAll(filtered)}
              onEdit={(a) => { setEditing(a); setOpen(true); }}
              onOpen={(id) => setDetailId(id)}
              onInlineSave={(id, patch) => updateOne.mutate({ id, patch })}
            />
          </TabsContent>

          <TabsContent value="board" className="mt-4">
            <BoardView items={filtered} onStatusChange={(id, status) => updateOne.mutate({ id, patch: { status } })} onOpen={setDetailId} />
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <CalendarView items={filtered} onOpen={setDetailId} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <TimelineView items={filtered} onOpen={setDetailId} />
          </TabsContent>
        </Tabs>
      )}

      <Sheet open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {detailId ? <DetailPanel appId={detailId} onEdit={(a) => { setEditing(a); setOpen(true); setDetailId(null); }} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ------------------------------ Advanced filters ------------------------------ */

function AdvancedFilters({
  filter, setFilter, companies, locations,
}: {
  filter: FilterState; setFilter: (f: FilterState) => void;
  companies: string[]; locations: string[];
}) {
  const activeCount =
    filter.statuses.length + filter.locations.length + filter.companies.length +
    (filter.hasDeadline ? 1 : 0) + (filter.hasFollowUp ? 1 : 0) + (filter.hasReferral ? 1 : 0) +
    (filter.dateFrom ? 1 : 0) + (filter.dateTo ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="size-4" /> Filters {activeCount ? <Badge variant="secondary">{activeCount}</Badge> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px]" align="start">
        <div className="space-y-3 text-sm">
          <div>
            <Label className="text-xs">Status</Label>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {STATUSES.map((s) => {
                const on = filter.statuses.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => setFilter({ ...filter, statuses: on ? filter.statuses.filter((x) => x !== s) : [...filter.statuses, s] })}
                    className={`px-2 py-1 rounded-md text-xs border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"}`}
                  >{STATUS_LABELS[s]}</button>
                );
              })}
            </div>
          </div>
          <ChipMultiSelect label="Company" values={filter.companies} options={companies}
            onChange={(v) => setFilter({ ...filter, companies: v })} />
          <ChipMultiSelect label="Location" values={filter.locations} options={locations}
            onChange={(v) => setFilter({ ...filter, locations: v })} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Applied from</Label>
              <Input type="date" value={filter.dateFrom} onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Applied to</Label>
              <Input type="date" value={filter.dateTo} onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2"><Checkbox checked={filter.hasDeadline} onCheckedChange={(v) => setFilter({ ...filter, hasDeadline: !!v })} /> Has deadline</label>
            <label className="flex items-center gap-2"><Checkbox checked={filter.hasFollowUp} onCheckedChange={(v) => setFilter({ ...filter, hasFollowUp: !!v })} /> Has follow-up</label>
            <label className="flex items-center gap-2"><Checkbox checked={filter.hasReferral} onCheckedChange={(v) => setFilter({ ...filter, hasReferral: !!v })} /> Has referral</label>
          </div>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setFilter(emptyFilter)}>
            <RotateCcw className="size-4" /> Reset
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ChipMultiSelect({ label, values, options, onChange }: { label: string; values: string[]; options: string[]; onChange: (v: string[]) => void }) {
  if (options.length === 0) return null;
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1 mt-1.5 max-h-24 overflow-y-auto">
        {options.map((o) => {
          const on = values.includes(o);
          return (
            <button key={o}
              onClick={() => onChange(on ? values.filter((x) => x !== o) : [...values, o])}
              className={`px-2 py-0.5 rounded-md text-xs border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"}`}
            >{o}</button>
          );
        })}
      </div>
    </div>
  );
}

function SavedFiltersMenu({ saved, setSaved, onApply, onSaveCurrent }: {
  saved: SavedFilter[]; setSaved: (l: SavedFilter[]) => void;
  onApply: (f: FilterState) => void; onSaveCurrent: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm"><Bookmark className="size-4" /> Saved</Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px]" align="start">
        <div className="text-sm space-y-2">
          {saved.length === 0 ? <p className="text-muted-foreground text-xs">No saved filters yet.</p> :
            saved.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2">
                <button className="flex-1 text-left px-2 py-1 rounded hover:bg-accent" onClick={() => onApply(s.filter)}>{s.name}</button>
                <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => {
                  const next = saved.filter((x) => x.id !== s.id);
                  setSaved(next); persistSavedFilters(next);
                }}>✕</button>
              </div>
            ))}
          <Button size="sm" className="w-full" onClick={onSaveCurrent}>Save current filter</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------ List view ------------------------------ */

function ListView({
  items, isLoading, selected, toggleSel, selectAll, onEdit, onOpen, onInlineSave,
}: {
  items: App[]; isLoading: boolean;
  selected: Set<string>; toggleSel: (id: string) => void; selectAll: () => void;
  onEdit: (a: App) => void; onOpen: (id: string) => void;
  onInlineSave: (id: string, patch: Partial<App>) => void;
}) {
  const [editCell, setEditCell] = useState<{ id: string; field: keyof App } | null>(null);
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        {isLoading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          : items.length === 0 ? <div className="p-12 text-center text-sm text-muted-foreground">No applications match your filters.</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left w-8">
                    <Checkbox checked={selected.size > 0 && selected.size === items.length} onCheckedChange={selectAll} />
                  </th>
                  <th className="px-4 py-2.5 text-left">Company / Role</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Applied</th>
                  <th className="px-4 py-2.5 text-left">Deadline</th>
                  <th className="px-4 py-2.5 text-left">Location</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3"><Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleSel(a.id)} /></td>
                    <td className="px-4 py-3">
                      <button className="font-medium text-left hover:underline" onClick={() => onOpen(a.id)}>{a.role}</button>
                      <div className="text-xs text-muted-foreground">
                        <Link to="/companies/$name" params={{ name: encodeURIComponent(a.company) }} className="hover:underline">{a.company}</Link>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Select value={a.status} onValueChange={(v) => onInlineSave(a.id, { status: v })}>
                        <SelectTrigger className={`h-7 w-[130px] text-xs ${STATUS_COLORS[a.status]}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <InlineDateCell app={a} field="application_date" editing={editCell} setEditing={setEditCell} onSave={onInlineSave} />
                    <InlineDateCell app={a} field="deadline" editing={editCell} setEditing={setEditCell} onSave={onInlineSave} />
                    <InlineTextCell app={a} field="location" editing={editCell} setEditing={setEditCell} onSave={onInlineSave} />
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => onEdit(a)}>Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </CardContent>
    </Card>
  );
}

function InlineTextCell({ app, field, editing, setEditing, onSave }: {
  app: App; field: keyof App;
  editing: { id: string; field: keyof App } | null;
  setEditing: (v: { id: string; field: keyof App } | null) => void;
  onSave: (id: string, patch: Partial<App>) => void;
}) {
  const active = editing?.id === app.id && editing.field === field;
  const value = (app[field] ?? "") as string;
  return (
    <td className="px-4 py-3 text-muted-foreground" onDoubleClick={() => setEditing({ id: app.id, field })}>
      {active ? (
        <Input
          autoFocus
          defaultValue={value}
          className="h-7"
          onBlur={(e) => { onSave(app.id, { [field]: e.target.value || null } as Partial<App>); setEditing(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEditing(null);
          }}
        />
      ) : (value || "—")}
    </td>
  );
}
function InlineDateCell({ app, field, editing, setEditing, onSave }: {
  app: App; field: keyof App;
  editing: { id: string; field: keyof App } | null;
  setEditing: (v: { id: string; field: keyof App } | null) => void;
  onSave: (id: string, patch: Partial<App>) => void;
}) {
  const active = editing?.id === app.id && editing.field === field;
  const value = (app[field] ?? "") as string;
  return (
    <td className="px-4 py-3 text-muted-foreground" onDoubleClick={() => setEditing({ id: app.id, field })}>
      {active ? (
        <Input
          type="date" autoFocus defaultValue={value} className="h-7"
          onBlur={(e) => { onSave(app.id, { [field]: e.target.value || null } as Partial<App>); setEditing(null); }}
          onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }}
        />
      ) : formatDate(value)}
    </td>
  );
}

/* ------------------------------ Board (DnD) ------------------------------ */

function BoardView({ items, onStatusChange, onOpen }: {
  items: App[]; onStatusChange: (id: string, status: string) => void; onOpen: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const cols = useMemo(() => STATUSES.map((s) => ({ status: s, items: items.filter((i) => i.status === s) })), [items]);

  function onDragEnd(e: DragEndEvent) {
    const id = e.active.id as string;
    const over = e.over?.id as string | undefined;
    if (!over) return;
    const status = over.startsWith("col:") ? over.slice(4) : items.find((i) => i.id === over)?.status;
    if (!status) return;
    const app = items.find((i) => i.id === id);
    if (app && app.status !== status) onStatusChange(id, status);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      <div className="grid gap-3 overflow-x-auto pb-2" style={{ gridTemplateColumns: `repeat(${STATUSES.length}, minmax(240px, 1fr))` }}>
        {cols.map((c) => <BoardColumn key={c.status} status={c.status} items={c.items} onOpen={onOpen} />)}
      </div>
    </DndContext>
  );
}
function BoardColumn({ status, items, onOpen }: { status: string; items: App[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  return (
    <div ref={setNodeRef} className={`rounded-lg border border-border bg-muted/20 p-2 min-h-[300px] ${isOver ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="space-y-2 mt-1">
        {items.map((a) => <BoardCard key={a.id} app={a} onOpen={onOpen} />)}
      </div>
    </div>
  );
}
function BoardCard({ app, onOpen }: { app: App; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: app.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={`rounded-md border border-border bg-card p-2.5 shadow-sm cursor-grab active:cursor-grabbing ${isDragging ? "opacity-60" : ""}`}
      onDoubleClick={() => onOpen(app.id)}
    >
      <div className="font-medium text-sm truncate">{app.role}</div>
      <div className="text-xs text-muted-foreground truncate">{app.company}</div>
      {app.deadline ? <div className="text-[11px] mt-1 text-warning-foreground">Due {formatDate(app.deadline)}</div> : null}
    </div>
  );
}

/* ------------------------------ Calendar ------------------------------ */

function CalendarView({ items, onOpen }: { items: App[]; onOpen: (id: string) => void }) {
  const [cursor, setCursor] = useState(startOfMonth(new Date()));
  const start = startOfWeek(startOfMonth(cursor));
  const end = endOfWeek(endOfMonth(cursor));
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  function eventsFor(d: Date) {
    return items.filter((a) =>
      (a.application_date && isSameDay(new Date(a.application_date), d)) ||
      (a.deadline && isSameDay(new Date(a.deadline), d)) ||
      (a.follow_up_at && isSameDay(new Date(a.follow_up_at), d))
    );
  }

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold flex items-center gap-2"><CalendarDays className="size-4" /> {format(cursor, "MMMM yyyy")}</div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => setCursor(addMonths(cursor, -1))}><ChevronLeft className="size-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(startOfMonth(new Date()))}>Today</Button>
            <Button size="icon" variant="ghost" aria-label="Next month" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="size-4" /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 text-xs text-muted-foreground mb-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="px-2 py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const evs = eventsFor(d);
            const inMonth = isSameMonth(d, cursor);
            return (
              <div key={d.toISOString()} className={`min-h-[92px] rounded-md border border-border p-1.5 ${inMonth ? "bg-background" : "bg-muted/30"}`}>
                <div className={`text-[11px] mb-1 ${isSameDay(d, new Date()) ? "font-semibold text-primary" : "text-muted-foreground"}`}>{format(d, "d")}</div>
                <div className="space-y-1">
                  {evs.slice(0, 3).map((a) => (
                    <button key={a.id} onClick={() => onOpen(a.id)}
                      className={`w-full text-left truncate px-1.5 py-0.5 rounded text-[11px] ${STATUS_COLORS[a.status]}`}
                      title={`${a.company} — ${a.role}`}>{a.company}</button>
                  ))}
                  {evs.length > 3 ? <div className="text-[10px] text-muted-foreground">+{evs.length - 3} more</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Timeline ------------------------------ */

function TimelineView({ items, onOpen }: { items: App[]; onOpen: (id: string) => void }) {
  const events = useMemo(() => {
    const evs: { date: string; app: App; label: string }[] = [];
    items.forEach((a) => {
      if (a.application_date) evs.push({ date: a.application_date, app: a, label: "Applied" });
      if (a.deadline) evs.push({ date: a.deadline, app: a, label: "Deadline" });
      if (a.follow_up_at) evs.push({ date: a.follow_up_at, app: a, label: "Follow-up" });
    });
    return evs.sort((a, b) => b.date.localeCompare(a.date));
  }, [items]);

  if (events.length === 0) return <Card><CardContent className="p-8 text-sm text-muted-foreground text-center">No dated events yet.</CardContent></Card>;

  return (
    <Card>
      <CardContent className="p-6">
        <ol className="relative border-l border-border ml-3 space-y-4">
          {events.map((e, i) => (
            <li key={i} className="pl-4 relative">
              <span className="absolute -left-[7px] top-1.5 size-3 rounded-full bg-primary" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDate(e.date)}</span>
                <Badge variant="secondary">{e.label}</Badge>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_COLORS[e.app.status]}`}>{STATUS_LABELS[e.app.status]}</span>
              </div>
              <button className="mt-0.5 font-medium hover:underline" onClick={() => onOpen(e.app.id)}>{e.app.role}</button>
              <div className="text-xs text-muted-foreground">{e.app.company}</div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Trash ------------------------------ */

function TrashView({ items, onRestore, onPurge }: {
  items: App[]; onRestore: (ids: string[]) => void; onPurge: (ids: string[]) => void;
}) {
  if (items.length === 0) return <Card><CardContent className="p-8 text-sm text-muted-foreground text-center">Trash is empty.</CardContent></Card>;
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-2.5 text-left">Role</th><th className="px-4 py-2.5 text-left">Company</th><th className="px-4 py-2.5 text-left">Deleted</th><th className="px-4 py-2.5 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="px-4 py-3">{a.role}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.company}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(a.deleted_at)}</td>
                <td className="px-4 py-3 text-right flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => onRestore([a.id])}><RotateCcw className="size-4" /> Restore</Button>
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete permanently?")) onPurge([a.id]); }}><Trash2 className="size-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Detail sheet ------------------------------ */

function DetailPanel({ appId, onEdit }: { appId: string; onEdit: (a: App) => void }) {
  const qc = useQueryClient();
  const { data: app } = useQuery({
    queryKey: ["application", appId],
    queryFn: async () => {
      const { data, error } = await supabase.from("applications").select("*").eq("id", appId).single();
      if (error) throw error;
      return data as unknown as App;
    },
  });
  if (!app) return <div className="p-6"><Loader2 className="size-4 animate-spin" /></div>;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-lg">{app.role}</SheetTitle>
        <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
          <Link to="/companies/$name" params={{ name: encodeURIComponent(app.company) }} className="hover:underline flex items-center gap-1">
            <Building2 className="size-3.5" /> {app.company}
          </Link>
          {app.recruiter ? (
            <>
              <span>·</span>
              <Link to="/recruiters/$name" params={{ name: encodeURIComponent(app.recruiter) }} className="hover:underline flex items-center gap-1">
                <User className="size-3.5" /> {app.recruiter}
              </Link>
            </>
          ) : null}
          <span>·</span>
          <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[app.status]}`}>{STATUS_LABELS[app.status]}</span>
        </div>
      </SheetHeader>

      <div className="mt-4 grid gap-4">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onEdit(app)}>Edit</Button>
          {app.job_url ? (
            <a href={app.job_url} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline"><ExternalLink className="size-4" /> Job</Button>
            </a>
          ) : null}
        </div>

        <FollowUpEditor app={app} onSaved={() => qc.invalidateQueries({ queryKey: ["application", appId] })} />

        <NotesEditor app={app} onSaved={() => qc.invalidateQueries({ queryKey: ["application", appId] })} />

        <Attachments appId={app.id} />

        <ActivityFeed appId={app.id} />
      </div>
    </>
  );
}

function FollowUpEditor({ app, onSaved }: { app: App; onSaved: () => void }) {
  const [val, setVal] = useState(app.follow_up_at ? app.follow_up_at.slice(0, 16) : "");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    const iso = val ? new Date(val).toISOString() : null;
    const { error } = await supabase.from("applications").update({ follow_up_at: iso } as never).eq("id", app.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Reminder saved"); onSaved();
  }
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-sm font-medium mb-2 flex items-center gap-2"><Bell className="size-4" /> Follow-up reminder</div>
      <div className="flex gap-2">
        <Input type="datetime-local" value={val} onChange={(e) => setVal(e.target.value)} />
        <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}</Button>
      </div>
    </div>
  );
}

function NotesEditor({ app, onSaved }: { app: App; onSaved: () => void }) {
  const [val, setVal] = useState(app.notes ?? "");
  const [saved, setSaved] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setVal(app.notes ?? ""), [app.id, app.notes]);
  useEffect(() => {
    if (val === (app.notes ?? "")) return;
    setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const { error } = await supabase.from("applications").update({ notes: val } as never).eq("id", app.id);
      if (!error) { setSaved(true); onSaved(); }
    }, 800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [val]);

  const [preview, setPreview] = useState(false);
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Notes (Markdown)</div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{saved ? "Saved" : "Saving…"}</span>
          <Button size="sm" variant="ghost" onClick={() => setPreview((p) => !p)}>{preview ? "Edit" : "Preview"}</Button>
        </div>
      </div>
      {preview ? <MarkdownPreview text={val} /> : <Textarea rows={8} value={val} onChange={(e) => setVal(e.target.value)} placeholder="# Interview notes\n- Talked with…" />}
    </div>
  );
}

function MarkdownPreview({ text }: { text: string }) {
  // Dynamic import so react-markdown ships only where used
  const [Comp, setComp] = useState<null | React.ComponentType<{ children: string; remarkPlugins?: unknown[] }>>(null);
  const [gfm, setGfm] = useState<unknown>(null);
  useEffect(() => {
    let mounted = true;
    Promise.all([import("react-markdown"), import("remark-gfm")]).then(([m, g]) => {
      if (mounted) { setComp(() => m.default as never); setGfm(() => g.default); }
    });
    return () => { mounted = false; };
  }, []);
  if (!Comp) return <div className="text-xs text-muted-foreground">Loading…</div>;
  return <div className="prose prose-sm dark:prose-invert max-w-none"><Comp remarkPlugins={gfm ? [gfm] : []}>{text || "_Nothing yet._"}</Comp></div>;
}

function Attachments({ appId }: { appId: string }) {
  const qc = useQueryClient();
  const { data: files = [] } = useQuery({
    queryKey: ["attachments", appId],
    queryFn: async () => {
      const { data, error } = await supabase.from("application_attachments").select("*").eq("application_id", appId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const [uploading, setUploading] = useState(false);
  const inp = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const path = `${u.user.id}/${appId}/${Date.now()}-${file.name}`;
      const { error: e1 } = await supabase.storage.from("attachments").upload(path, file);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("application_attachments").insert({
        application_id: appId, user_id: u.user.id, name: file.name, file_path: path, mime: file.type, size: file.size,
      } as never);
      if (e2) throw e2;
      toast.success("Uploaded");
      qc.invalidateQueries({ queryKey: ["attachments", appId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setUploading(false); }
  }
  async function download(path: string, name: string) {
    const { data, error } = await supabase.storage.from("attachments").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    const a = document.createElement("a"); a.href = data.signedUrl; a.download = name; a.click();
  }
  async function remove(id: string, path: string) {
    await supabase.storage.from("attachments").remove([path]);
    await supabase.from("application_attachments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["attachments", appId] });
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Attachments</div>
        <input ref={inp} type="file" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <Button size="sm" variant="outline" onClick={() => inp.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload
        </Button>
      </div>
      {files.length === 0 ? <p className="text-xs text-muted-foreground">No files.</p> : (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between text-sm">
              <button className="hover:underline truncate max-w-[70%] text-left" onClick={() => download(f.file_path, f.name)}>{f.name}</button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{f.size ? `${Math.round(f.size / 1024)} KB` : ""}</span>
                <button className="hover:text-destructive" onClick={() => remove(f.id, f.file_path)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityFeed({ appId }: { appId: string }) {
  const { data: events = [] } = useQuery({
    queryKey: ["activity", appId],
    queryFn: async () => {
      const { data, error } = await supabase.from("application_activities").select("*").eq("application_id", appId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-sm font-medium mb-2 flex items-center gap-2"><Clock className="size-4" /> Activity & status history</div>
      {events.length === 0 ? <p className="text-xs text-muted-foreground">No activity yet.</p> : (
        <ol className="relative border-l border-border ml-2 space-y-3">
          {events.map((e) => (
            <li key={e.id} className="pl-3 relative">
              <span className="absolute -left-[5px] top-1.5 size-2 rounded-full bg-primary" />
              <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
              <div className="text-sm">{e.message ?? e.type}</div>
              {e.type === "status_change" && e.from_status && e.to_status ? (
                <div className="mt-1 flex items-center gap-1 text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${STATUS_COLORS[e.from_status]}`}>{STATUS_LABELS[e.from_status]}</span>
                  <span>→</span>
                  <span className={`px-1.5 py-0.5 rounded ${STATUS_COLORS[e.to_status]}`}>{STATUS_LABELS[e.to_status]}</span>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ------------------------------ Create/Edit dialog (autosaving draft) ------------------------------ */

function AppDialog({ editing, onSubmit, loading }: { editing: App | null; onSubmit: (v: Partial<App>) => void; loading: boolean }) {
  const [form, setForm] = useState<Partial<App>>(() => editing ?? loadDraft() ?? { status: "applied" });
  const [draftLoaded] = useState(() => !editing && !!loadDraft());
  useEffect(() => { if (!editing) saveDraft(form); }, [form, editing]);

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit application" : "New application"}</DialogTitle>
        {draftLoaded ? <p className="text-xs text-muted-foreground">Draft restored — <button className="underline" onClick={() => { saveDraft(null); setForm({ status: "applied" }); }}>discard</button></p> : null}
      </DialogHeader>
      <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
        <div className="space-y-1.5"><Label>Company</Label><Input required value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Role</Label><Input required value={form.role ?? ""} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Location</Label><Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Salary</Label><Input value={form.salary ?? ""} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Application date</Label><Input type="date" value={form.application_date ?? ""} onChange={(e) => setForm({ ...form, application_date: e.target.value || null })} /></div>
        <div className="space-y-1.5"><Label>Deadline</Label><Input type="date" value={form.deadline ?? ""} onChange={(e) => setForm({ ...form, deadline: e.target.value || null })} /></div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status ?? "applied"} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Referral status</Label><Input value={form.referral_status ?? ""} onChange={(e) => setForm({ ...form, referral_status: e.target.value })} placeholder="Requested / Confirmed" /></div>
        <div className="col-span-2 space-y-1.5"><Label>Job URL</Label><Input type="url" value={form.job_url ?? ""} onChange={(e) => setForm({ ...form, job_url: e.target.value })} /></div>
        <div className="col-span-2 space-y-1.5"><Label>Recruiter</Label><Input value={form.recruiter ?? ""} onChange={(e) => setForm({ ...form, recruiter: e.target.value })} /></div>
        <div className="col-span-2 space-y-1.5"><Label>Notes (Markdown)</Label><Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <DialogFooter className="col-span-2 mt-2">
          <Button type="submit" disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
