import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard, Briefcase, FileText, Wand2, FileSignature, Target, MessageSquare,
  Compass, Users, NotebookPen, BarChart3, Settings, LogOut, Sun, Moon, Monitor, Plus, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "./theme-provider";
import { toast } from "sonner";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; kbd?: string };
const nav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, kbd: "G D" },
  { to: "/applications", label: "Applications", icon: Briefcase, kbd: "G P" },
  { to: "/resumes", label: "Resumes", icon: FileText, kbd: "G R" },
  { to: "/referrals", label: "Referrals", icon: Users },
  { to: "/interview-notes", label: "Interview Notes", icon: NotebookPen },
  { to: "/analytics", label: "Analytics", icon: BarChart3, kbd: "G N" },
  { to: "/settings", label: "Settings", icon: Settings, kbd: "G S" },
];
const ai: NavItem[] = [
  { to: "/ai/resume-analyzer", label: "Resume Analyzer", icon: Wand2 },
  { to: "/ai/cover-letter", label: "Cover Letter", icon: FileSignature },
  { to: "/ai/job-match", label: "Job Match", icon: Target },
  { to: "/ai/interview-coach", label: "Interview Coach", icon: MessageSquare },
  { to: "/ai/mock-interview", label: "Mock Interview", icon: Sparkles },
  { to: "/ai/career-coach", label: "Career Coach", icon: Compass },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setTheme } = useTheme();

  function go(to: string) {
    onOpenChange(false);
    navigate({ to: to as never });
  }

  async function signOut() {
    onOpenChange(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, actions, AI tools…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {nav.map((n) => (
            <CommandItem key={n.to} onSelect={() => go(n.to)}>
              <n.icon />
              <span>{n.label}</span>
              {n.kbd ? <CommandShortcut>{n.kbd}</CommandShortcut> : null}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="AI tools">
          {ai.map((n) => (
            <CommandItem key={n.to} onSelect={() => go(n.to)}>
              <n.icon />
              <span>{n.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => go("/applications")}>
            <Plus /><span>New application</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/resumes")}>
            <Plus /><span>Upload resume</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => { setTheme("light"); onOpenChange(false); }}>
            <Sun /><span>Light</span>
          </CommandItem>
          <CommandItem onSelect={() => { setTheme("dark"); onOpenChange(false); }}>
            <Moon /><span>Dark</span>
          </CommandItem>
          <CommandItem onSelect={() => { setTheme("system"); onOpenChange(false); }}>
            <Monitor /><span>System</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem onSelect={signOut}>
            <LogOut /><span>Sign out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

const goShortcuts: Record<string, string> = {
  d: "/dashboard",
  p: "/applications",
  r: "/resumes",
  n: "/analytics",
  s: "/settings",
  c: "/ai/career-coach",
  i: "/ai/interview-coach",
  m: "/ai/job-match",
  a: "/ai/resume-analyzer",
  l: "/ai/cover-letter",
};

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let gMode = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.tagName === "SELECT"
      );

      // ⌘K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // ? opens palette
      if (!typing && e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (typing) return;

      if (e.key.toLowerCase() === "g") {
        gMode = true;
        if (gTimer) clearTimeout(gTimer);
        gTimer = setTimeout(() => { gMode = false; }, 1200);
        return;
      }
      if (gMode) {
        const to = goShortcuts[e.key.toLowerCase()];
        if (to) {
          e.preventDefault();
          gMode = false;
          navigate({ to: to as never });
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [navigate]);

  return { open, setOpen };
}
