import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Briefcase, FileText, Wand2, FileSignature, Target, MessageSquare,
  Compass, Users, NotebookPen, BarChart3, Settings, Sparkles, LogOut, Menu, X,
  Search, Sun, Moon, Monitor, Chrome,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CommandPalette, useCommandPalette } from "./command-palette";
import { useTheme } from "./theme-provider";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/applications", label: "Applications", icon: Briefcase },
  { to: "/resumes", label: "Resumes", icon: FileText },
  { to: "/ai/resume-analyzer", label: "Resume Analyzer", icon: Wand2 },
  { to: "/ai/cover-letter", label: "Cover Letter", icon: FileSignature },
  { to: "/ai/job-match", label: "Job Match", icon: Target },
  { to: "/ai/interview-coach", label: "Interview Coach", icon: MessageSquare },
  { to: "/ai/mock-interview", label: "Mock Interview", icon: Sparkles },
  { to: "/ai/career-coach", label: "Career Coach", icon: Compass },
  { to: "/referrals", label: "Referrals", icon: Users },
  { to: "/interview-notes", label: "Interview Notes", icon: NotebookPen },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/extension", label: "Chrome Extension", icon: Chrome },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme" className="h-9 w-9">
          <Icon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}><Sun className="size-4" /> Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}><Moon className="size-4" /> Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}><Monitor className="size-4" /> System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  useEffect(() => { setMobileOpen(false); }, [path]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh bg-surface flex">
      {/* Skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:px-3 focus:py-2 focus:text-sm focus:shadow-elevated"
      >
        Skip to content
      </a>

      {/* Mobile backdrop */}
      {mobileOpen ? (
        <button
          aria-label="Close menu backdrop"
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-30 bg-foreground/30 backdrop-blur-sm animate-in fade-in"
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200 ease-out md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Primary"
      >
        <div className="px-5 py-5 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center shadow-card">
              <Sparkles className="size-4" />
            </div>
            <span>CareerOS AI</span>
          </Link>
          <button className="md:hidden min-h-11 min-w-11 grid place-items-center -mr-2" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>

        <div className="px-3 pb-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center gap-2 rounded-md border border-sidebar-border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open command palette"
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px]">
              <span className="text-[10px]">⌘</span>K
            </kbd>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
          {nav.map((item) => {
            const active = path === item.to || (item.to !== "/dashboard" && path.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}`}
              >
                {active ? (
                  <motion.span
                    layoutId="sidebar-active-bar"
                    className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    aria-hidden
                  />
                ) : null}
                <item.icon className={`size-4 transition ${active ? "text-primary" : "opacity-70 group-hover:opacity-100"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2 rounded-md px-2 py-2">
            <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold">
              {email.slice(0, 1).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{email || "Account"}</div>
              <div className="text-[10px] text-muted-foreground">Signed in</div>
            </div>
            <ThemeToggle />
            <Button size="icon" variant="ghost" onClick={signOut} aria-label="Sign out" className="h-9 w-9">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-3">
        <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="min-h-11 min-w-11 grid place-items-center">
          <Menu className="size-5" />
        </button>
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-sm">
          <Sparkles className="size-4 text-primary" /> CareerOS AI
        </Link>
        <button onClick={() => setPaletteOpen(true)} aria-label="Search" className="min-h-11 min-w-11 grid place-items-center">
          <Search className="size-5" />
        </button>
      </div>

      <main id="main-content" className="flex-1 md:ml-64 pt-14 md:pt-0 min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={path}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-7xl px-4 md:px-8 py-6 md:py-8"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 mb-6 md:mb-8"
    >
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-balance">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2 flex-wrap justify-end">{actions}</div> : null}
    </motion.div>
  );
}
