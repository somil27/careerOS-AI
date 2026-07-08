import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Upload, FileText, Download, Trash2, Star, Loader2, MoreHorizontal, Eye, Share2, History,
  GitCompare, BarChart3, Archive, Copy, Link as LinkIcon, RotateCcw, Layers, Tag,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { EmptyState, LoadingState } from "@/components/state-views";

export const Route = createFileRoute("/_authenticated/resumes")({
  head: () => ({ meta: [{ title: "Resumes · CareerOS AI" }] }),
  component: Resumes,
});

type Resume = {
  id: string;
  user_id: string;
  name: string;
  file_path: string;
  file_size: number | null;
  version: number;
  is_active: boolean;
  extracted_text: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
  template: string;
  parent_id: string | null;
  deleted_at: string | null;
  download_count: number;
  last_downloaded_at: string | null;
  notes: string | null;
};

const TEMPLATES = [
  { id: "classic", label: "Classic" },
  { id: "modern", label: "Modern" },
  { id: "minimal", label: "Minimal" },
  { id: "technical", label: "Technical" },
  { id: "executive", label: "Executive" },
];

function slugify() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
}

async function readFileText(file: File): Promise<string> {
  if (file.type === "text/plain" || file.name.endsWith(".txt")) {
    try { return await file.text(); } catch { return ""; }
  }
  return "";
}

function Resumes() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: "", template: "classic", tags: "", notes: "", parentId: "" });
  const [tab, setTab] = useState<"active" | "trash">("active");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [previewOpen, setPreviewOpen] = useState<Resume | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<Resume | null>(null);
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [shareFor, setShareFor] = useState<Resume | null>(null);
  const [downloadsFor, setDownloadsFor] = useState<Resume | null>(null);
  const [analyticsFor, setAnalyticsFor] = useState<Resume | null>(null);

  const { data: resumes = [], isLoading } = useQuery<Resume[]>({
    queryKey: ["resumes-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resumes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Resume[];
    },
  });

  const filtered = useMemo(() => {
    const list = resumes.filter((r) => (tab === "active" ? !r.deleted_at : !!r.deleted_at));
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      if (tagFilter && !(r.tags ?? []).includes(tagFilter)) return false;
      if (templateFilter !== "all" && r.template !== templateFilter) return false;
      if (q && !r.name.toLowerCase().includes(q) && !(r.extracted_text ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [resumes, tab, tagFilter, templateFilter, search]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    resumes.forEach((r) => (r.tags ?? []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [resumes]);

  async function upload(file: File) {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const path = `${u.user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("resumes").upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      const extractedText = await readFileText(file);

      // Version: if parentId provided, bump from parent's version
      let version = 1;
      let parent_id: string | null = null;
      if (uploadForm.parentId) {
        const parent = resumes.find((r) => r.id === uploadForm.parentId);
        if (parent) { version = parent.version + 1; parent_id = parent.id; }
      }

      const tags = uploadForm.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const activeCount = resumes.filter((r) => r.is_active && !r.deleted_at).length;

      const { error } = await supabase.from("resumes").insert({
        user_id: u.user.id,
        name: uploadForm.name || file.name,
        file_path: path,
        file_size: file.size,
        is_active: activeCount === 0,
        extracted_text: extractedText || null,
        template: uploadForm.template,
        tags,
        parent_id,
        version,
        notes: uploadForm.notes || null,
      } as any);
      if (error) throw error;

      toast.success(parent_id ? `New version v${version} uploaded` : "Resume uploaded");
      setUploadOpen(false);
      setUploadForm({ name: "", template: "classic", tags: "", notes: "", parentId: "" });
      qc.invalidateQueries({ queryKey: ["resumes-all"] });
      qc.invalidateQueries({ queryKey: ["active-resume-text"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  }

  const setActive = useMutation({
    mutationFn: async (id: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      await supabase.from("resumes").update({ is_active: false }).eq("user_id", u.user.id);
      const { error } = await supabase.from("resumes").update({ is_active: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resumes-all"] });
      qc.invalidateQueries({ queryKey: ["active-resume-text"] });
      toast.success("Active resume updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const softDelete = useMutation({
    mutationFn: async (r: Resume) => {
      const { error } = await supabase.from("resumes").update({ deleted_at: new Date().toISOString(), is_active: false } as any).eq("id", r.id);
      if (error) throw error;
      return r;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["resumes-all"] });
      toast.success("Moved to trash", {
        action: {
          label: "Undo",
          onClick: async () => {
            await supabase.from("resumes").update({ deleted_at: null } as any).eq("id", r.id);
            qc.invalidateQueries({ queryKey: ["resumes-all"] });
          },
        },
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resumes").update({ deleted_at: null } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["resumes-all"] }); toast.success("Restored"); },
  });

  const hardDelete = useMutation({
    mutationFn: async (r: Resume) => {
      await supabase.storage.from("resumes").remove([r.file_path]);
      const { error } = await supabase.from("resumes").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["resumes-all"] }); toast.success("Permanently deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  async function download(r: Resume) {
    const { data, error } = await supabase.storage.from("resumes").createSignedUrl(r.file_path, 60);
    if (error) return toast.error(error.message);
    const a = document.createElement("a"); a.href = data.signedUrl; a.download = r.name; a.click();
    // log
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await supabase.from("resume_downloads").insert({
        resume_id: r.id, user_id: u.user.id, source: "app",
        user_agent: navigator.userAgent,
      } as any);
      await supabase.from("resumes").update({
        download_count: (r.download_count ?? 0) + 1,
        last_downloaded_at: new Date().toISOString(),
      } as any).eq("id", r.id);
      qc.invalidateQueries({ queryKey: ["resumes-all"] });
    }
  }

  async function openPreview(r: Resume) {
    setPreviewOpen(r);
    setPreviewUrl(null);
    const { data, error } = await supabase.storage.from("resumes").createSignedUrl(r.file_path, 60 * 10);
    if (error) return toast.error(error.message);
    setPreviewUrl(data.signedUrl);
  }

  async function backup() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: rs }, { data: shares }, { data: dl }] = await Promise.all([
      supabase.from("resumes").select("*"),
      supabase.from("resume_shares").select("*"),
      supabase.from("resume_downloads").select("*"),
    ]);
    // include signed URLs (10 minutes) for portable download
    const withUrls = await Promise.all((rs ?? []).map(async (r: any) => {
      const { data } = await supabase.storage.from("resumes").createSignedUrl(r.file_path, 60 * 10);
      return { ...r, signed_url: data?.signedUrl ?? null };
    }));
    const payload = {
      exported_at: new Date().toISOString(),
      user_id: u.user.id,
      resumes: withUrls,
      shares: shares ?? [],
      downloads: dl ?? [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `careeros-resumes-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  }

  return (
    <div>
      <PageHeader
        title="Resumes"
        description="Manage your resume library, versions, templates, share links, and analytics."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setCompareOpen(true); }}>
              <GitCompare className="size-4" /> Compare
            </Button>
            <Button variant="outline" size="sm" onClick={backup}>
              <Archive className="size-4" /> Backup
            </Button>
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Upload className="size-4" /> Upload</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload resume</DialogTitle>
                  <DialogDescription>Add a new resume or a new version of an existing one.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={uploadForm.name} onChange={(e) => setUploadForm((f) => ({ ...f, name: e.target.value }))} placeholder="Friendly name (defaults to filename)" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Template</Label>
                      <Select value={uploadForm.template} onValueChange={(v) => setUploadForm((f) => ({ ...f, template: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TEMPLATES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>New version of</Label>
                      <Select value={uploadForm.parentId || "none"} onValueChange={(v) => setUploadForm((f) => ({ ...f, parentId: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="Independent" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Independent</SelectItem>
                          {resumes.filter((r) => !r.deleted_at).map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.name} (v{r.version})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="tags">Tags (comma separated)</Label>
                    <Input id="tags" value={uploadForm.tags} onChange={(e) => setUploadForm((f) => ({ ...f, tags: e.target.value }))} placeholder="senior, backend, remote" />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" rows={2} value={uploadForm.notes} onChange={(e) => setUploadForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional context for this version" />
                  </div>
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setUploadOpen(false)}>Cancel</Button>
                  <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Choose file & upload
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-4">
        <TabsList>
          <TabsTrigger value="active">Library ({resumes.filter((r) => !r.deleted_at).length})</TabsTrigger>
          <TabsTrigger value="trash">Trash ({resumes.filter((r) => r.deleted_at).length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input placeholder="Search by name or content…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={templateFilter} onValueChange={setTemplateFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Template" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All templates</SelectItem>
            {TEMPLATES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            <Tag className="size-3.5 text-muted-foreground" />
            <button className={`text-xs px-2 py-0.5 rounded-full border ${tagFilter === "" ? "bg-primary text-primary-foreground" : "bg-background"}`} onClick={() => setTagFilter("")}>All</button>
            {allTags.map((t) => (
              <button key={t} className={`text-xs px-2 py-0.5 rounded-full border ${tagFilter === t ? "bg-primary text-primary-foreground" : "bg-background"}`} onClick={() => setTagFilter(t)}>{t}</button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={tab === "trash" ? "Trash is empty" : "No resumes yet"}
          description={tab === "trash" ? "Deleted resumes appear here for restore." : "Upload your first resume to unlock AI features."}
          action={tab === "active" ? <Button onClick={() => setUploadOpen(true)}><Upload className="size-4" /> Upload</Button> : null}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r) => (
            <Card key={r.id} className={r.is_active ? "border-primary/40" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-9 rounded-md bg-accent text-primary grid place-items-center shrink-0"><FileText className="size-4" /></div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {formatDate(r.created_at)} · v{r.version} · {TEMPLATES.find((t) => t.id === r.template)?.label ?? r.template}
                      </div>
                    </div>
                  </div>
                  {r.is_active ? (
                    <span className="text-xs font-medium text-primary inline-flex items-center gap-1 shrink-0">
                      <Star className="size-3 fill-primary" /> Active
                    </span>
                  ) : null}
                </div>
                {r.tags?.length ? (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {r.tags.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                  </div>
                ) : null}
                <div className="text-xs text-muted-foreground flex items-center gap-3 mb-3">
                  <span className="inline-flex items-center gap-1"><Download className="size-3" /> {r.download_count ?? 0}</span>
                  {r.parent_id ? <span className="inline-flex items-center gap-1"><Layers className="size-3" /> version</span> : null}
                </div>
                <div className="flex items-center gap-1 justify-between">
                  <div className="flex items-center gap-1">
                    {r.deleted_at ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => restore.mutate(r.id)}><RotateCcw className="size-4" /> Restore</Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete permanently?")) hardDelete.mutate(r); }}><Trash2 className="size-4" /></Button>
                      </>
                    ) : (
                      <>
                        {!r.is_active && <Button size="sm" variant="outline" onClick={() => setActive.mutate(r.id)}>Make active</Button>}
                        <Button size="sm" variant="ghost" onClick={() => openPreview(r)} aria-label="Preview"><Eye className="size-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => download(r)} aria-label="Download"><Download className="size-4" /></Button>
                      </>
                    )}
                  </div>
                  {!r.deleted_at && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="More"><MoreHorizontal className="size-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setShareFor(r)}><Share2 className="size-4 mr-2" /> Share link</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setHistoryFor(r)}><History className="size-4 mr-2" /> Version history</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAnalyticsFor(r)}><BarChart3 className="size-4 mr-2" /> Analytics</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDownloadsFor(r)}><Download className="size-4 mr-2" /> Download history</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setCompareA(r.id); setCompareOpen(true); }}><GitCompare className="size-4 mr-2" /> Compare</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setUploadForm((f) => ({ ...f, parentId: r.id, name: r.name })); setUploadOpen(true); }}>
                          <Upload className="size-4 mr-2" /> New version
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => softDelete.mutate(r)} className="text-destructive"><Trash2 className="size-4 mr-2" /> Move to trash</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* PDF Preview */}
      <Dialog open={!!previewOpen} onOpenChange={(o) => { if (!o) { setPreviewOpen(null); setPreviewUrl(null); } }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewOpen?.name}</DialogTitle>
            <DialogDescription>Preview · v{previewOpen?.version}</DialogDescription>
          </DialogHeader>
          {previewUrl ? (
            previewOpen?.file_path.toLowerCase().endsWith(".pdf") ? (
              <iframe title="Resume preview" src={previewUrl} className="w-full h-[70vh] rounded-md border" />
            ) : (
              <div className="p-4 max-h-[70vh] overflow-auto whitespace-pre-wrap text-sm">
                {previewOpen?.extracted_text || (
                  <a href={previewUrl} target="_blank" rel="noreferrer" className="text-primary underline">Open file</a>
                )}
              </div>
            )
          ) : <LoadingState />}
        </DialogContent>
      </Dialog>

      {/* Version history */}
      <VersionHistoryDialog resume={historyFor} resumes={resumes} onClose={() => setHistoryFor(null)} onPreview={openPreview} onMakeActive={(id) => setActive.mutate(id)} />

      {/* Compare */}
      <CompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        resumes={resumes.filter((r) => !r.deleted_at)}
        a={compareA} b={compareB} setA={setCompareA} setB={setCompareB}
      />

      {/* Share */}
      <ShareDialog resume={shareFor} onClose={() => setShareFor(null)} />

      {/* Downloads */}
      <DownloadsDialog resume={downloadsFor} onClose={() => setDownloadsFor(null)} />

      {/* Analytics */}
      <AnalyticsDialog resume={analyticsFor} onClose={() => setAnalyticsFor(null)} />
    </div>
  );
}

function VersionHistoryDialog({
  resume, resumes, onClose, onPreview, onMakeActive,
}: {
  resume: Resume | null; resumes: Resume[]; onClose: () => void; onPreview: (r: Resume) => void; onMakeActive: (id: string) => void;
}) {
  if (!resume) return null;
  // Build lineage: walk up parent_id, and gather all descendants
  const byId = new Map(resumes.map((r) => [r.id, r]));
  const root = (() => { let cur = resume; while (cur.parent_id && byId.get(cur.parent_id)) cur = byId.get(cur.parent_id)!; return cur; })();
  const lineage: Resume[] = [];
  const walk = (id: string) => {
    const node = byId.get(id); if (!node) return;
    lineage.push(node);
    resumes.filter((r) => r.parent_id === id).forEach((c) => walk(c.id));
  };
  walk(root.id);
  lineage.sort((a, b) => a.version - b.version || +new Date(a.created_at) - +new Date(b.created_at));

  return (
    <Dialog open={!!resume} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>All versions in this lineage.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y">
          {lineage.map((r) => (
            <li key={r.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate flex items-center gap-2">
                  v{r.version} · {r.name}
                  {r.is_active && <Badge variant="default" className="text-[10px]">Active</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{formatDate(r.created_at)} · {TEMPLATES.find((t) => t.id === r.template)?.label ?? r.template}</div>
                {r.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.notes}</div>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => onPreview(r)}><Eye className="size-4" /></Button>
                {!r.is_active && <Button size="sm" variant="outline" onClick={() => onMakeActive(r.id)}>Activate</Button>}
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function CompareDialog({
  open, onOpenChange, resumes, a, b, setA, setB,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; resumes: Resume[];
  a: string; b: string; setA: (v: string) => void; setB: (v: string) => void;
}) {
  const ra = resumes.find((r) => r.id === a);
  const rb = resumes.find((r) => r.id === b);
  const linesA = (ra?.extracted_text ?? "").split(/\n/);
  const linesB = (rb?.extracted_text ?? "").split(/\n/);
  const setB2 = new Set(linesB.map((l) => l.trim()).filter(Boolean));
  const setA2 = new Set(linesA.map((l) => l.trim()).filter(Boolean));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Compare resumes</DialogTitle>
          <DialogDescription>Line-level differences between two versions.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Select value={a} onValueChange={setA}>
            <SelectTrigger><SelectValue placeholder="Select A" /></SelectTrigger>
            <SelectContent>{resumes.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} · v{r.version}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={b} onValueChange={setB}>
            <SelectTrigger><SelectValue placeholder="Select B" /></SelectTrigger>
            <SelectContent>{resumes.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} · v{r.version}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {ra && rb ? (
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-auto">
            <div className="text-xs font-mono border rounded-md p-3 space-y-0.5 bg-card">
              <div className="font-sans text-sm font-semibold mb-2">{ra.name} · v{ra.version}</div>
              {linesA.map((l, i) => (
                <div key={i} className={setB2.has(l.trim()) ? "" : "bg-destructive/10 text-destructive-foreground rounded px-1"}>{l || "\u00A0"}</div>
              ))}
            </div>
            <div className="text-xs font-mono border rounded-md p-3 space-y-0.5 bg-card">
              <div className="font-sans text-sm font-semibold mb-2">{rb.name} · v{rb.version}</div>
              {linesB.map((l, i) => (
                <div key={i} className={setA2.has(l.trim()) ? "" : "bg-success/10 text-success rounded px-1"}>{l || "\u00A0"}</div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Choose two resumes to compare. Text-based content is compared line by line.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ShareDialog({ resume, onClose }: { resume: Resume | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: shares = [], refetch } = useQuery<any[]>({
    queryKey: ["resume-shares", resume?.id],
    enabled: !!resume,
    queryFn: async () => {
      const { data, error } = await supabase.from("resume_shares").select("*").eq("resume_id", resume!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const [expiryDays, setExpiryDays] = useState<string>("never");

  async function createLink() {
    if (!resume) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Not signed in");
    const slug = slugify();
    const expires_at = expiryDays === "never" ? null : new Date(Date.now() + parseInt(expiryDays, 10) * 86400_000).toISOString();
    const { error } = await supabase.from("resume_shares").insert({
      resume_id: resume.id, user_id: u.user.id, slug, expires_at, is_active: true,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Share link created");
    refetch();
    qc.invalidateQueries({ queryKey: ["resume-shares", resume.id] });
  }
  async function toggle(id: string, is_active: boolean) {
    const { error } = await supabase.from("resume_shares").update({ is_active } as any).eq("id", id);
    if (error) return toast.error(error.message);
    refetch();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("resume_shares").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refetch();
  }
  function copyUrl(slug: string) {
    const url = `${window.location.origin}/r/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  return (
    <Dialog open={!!resume} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share resume</DialogTitle>
          <DialogDescription>Create private links that anyone with the URL can open.</DialogDescription>
        </DialogHeader>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label>Expiry</Label>
            <Select value={expiryDays} onValueChange={setExpiryDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={createLink}><LinkIcon className="size-4" /> Create link</Button>
        </div>
        <div className="divide-y border rounded-md">
          {shares.length === 0 && <div className="p-4 text-sm text-muted-foreground">No links yet.</div>}
          {shares.map((s) => {
            const url = `${typeof window !== "undefined" ? window.location.origin : ""}/r/${s.slug}`;
            return (
              <div key={s.id} className="p-3 flex items-center gap-3 justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-mono truncate">{url}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.view_count ?? 0} views · {s.expires_at ? `expires ${formatDate(s.expires_at)}` : "no expiry"} · created {formatDate(s.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={s.is_active} onCheckedChange={(v) => toggle(s.id, v)} aria-label="Active" />
                  <Button size="icon" variant="ghost" aria-label="Copy share link" onClick={() => copyUrl(s.slug)}><Copy className="size-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Delete share" onClick={() => remove(s.id)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DownloadsDialog({ resume, onClose }: { resume: Resume | null; onClose: () => void }) {
  const { data = [] } = useQuery<any[]>({
    queryKey: ["resume-downloads", resume?.id],
    enabled: !!resume,
    queryFn: async () => {
      const { data, error } = await supabase.from("resume_downloads").select("*").eq("resume_id", resume!.id).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Dialog open={!!resume} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Download history</DialogTitle>
          <DialogDescription>Every time this file was downloaded.</DialogDescription>
        </DialogHeader>
        {data.length === 0 ? <EmptyState icon={Download} title="No downloads yet" /> : (
          <ul className="divide-y text-sm max-h-[60vh] overflow-auto">
            {data.map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div>{formatDate(d.created_at)} · {new Date(d.created_at).toLocaleTimeString()}</div>
                  <div className="text-xs text-muted-foreground truncate">{d.source} · {d.user_agent ?? "unknown"}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AnalyticsDialog({ resume, onClose }: { resume: Resume | null; onClose: () => void }) {
  const { data: views = [] } = useQuery<any[]>({
    queryKey: ["resume-views", resume?.id],
    enabled: !!resume,
    queryFn: async () => {
      const { data, error } = await supabase.from("resume_views").select("*").eq("resume_id", resume!.id).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: downloads = [] } = useQuery<any[]>({
    queryKey: ["resume-downloads-stat", resume?.id],
    enabled: !!resume,
    queryFn: async () => {
      const { data, error } = await supabase.from("resume_downloads").select("id, created_at").eq("resume_id", resume!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Bucket last 14 days
  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const viewsByDay = days.map((d) => ({ day: d, count: views.filter((v) => v.created_at.slice(0, 10) === d).length }));
  const dlByDay = days.map((d) => ({ day: d, count: downloads.filter((v: any) => v.created_at.slice(0, 10) === d).length }));
  const maxV = Math.max(1, ...viewsByDay.map((d) => d.count));
  const maxD = Math.max(1, ...dlByDay.map((d) => d.count));

  return (
    <Dialog open={!!resume} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resume analytics</DialogTitle>
          <DialogDescription>Public views and downloads over the last 14 days.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard label="Total views" value={views.length} />
          <StatCard label="Total downloads" value={downloads.length} />
          <StatCard label="Unique days" value={new Set([...views, ...downloads].map((x: any) => x.created_at.slice(0, 10))).size} />
        </div>
        <div className="space-y-4">
          <MiniBar title="Views" data={viewsByDay} max={maxV} colorClass="bg-primary" />
          <MiniBar title="Downloads" data={dlByDay} max={maxD} colorClass="bg-chart-5" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function MiniBar({ title, data, max, colorClass }: { title: string; data: { day: string; count: number }[]; max: number; colorClass: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{title}</div>
      <div className="flex items-end gap-1 h-24">
        {data.map((d) => (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.count}`}>
            <div className={`w-full rounded-sm ${colorClass}`} style={{ height: `${(d.count / max) * 100}%`, minHeight: 2, opacity: d.count === 0 ? 0.2 : 1 }} />
            <div className="text-[9px] text-muted-foreground">{d.day.slice(5)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
