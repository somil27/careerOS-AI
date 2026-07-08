import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Briefcase, FileText, MessageSquare, Target, TrendingUp, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CareerOS AI — Land your dream job, faster" },
      { name: "description", content: "Track applications, analyze resumes with AI, generate cover letters, and prep for interviews. The career operating system for ambitious people." },
      { property: "og:title", content: "CareerOS AI — Land your dream job, faster" },
      { property: "og:description", content: "Track applications, analyze resumes with AI, generate cover letters, and prep for interviews." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Briefcase, title: "Application Tracker", desc: "Visualize your pipeline from applied to offer. Filter, sort, bulk-update, export." },
  { icon: FileText, title: "AI Resume Analyzer", desc: "Get an ATS score, missing keywords, and actionable fixes powered by Gemini." },
  { icon: MessageSquare, title: "Cover Letter Generator", desc: "Tailored cover letters from your resume and the job description in seconds." },
  { icon: Target, title: "Job Match", desc: "See how well your resume fits a JD with a precise match percentage and skill gaps." },
  { icon: Sparkles, title: "Interview Coach", desc: "Likely questions, behavioral prep, and company research — generated on demand." },
  { icon: TrendingUp, title: "Career Coach", desc: "Weekly improvement plan, learning roadmap and recommended next moves." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-hero-grad">
      <header className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center shadow-card">
            <Sparkles className="size-4" />
          </div>
          <span>CareerOS AI</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition">Sign in</Link>
          <Link to="/auth"><Button size="sm">Get started <ArrowRight className="size-4" /></Button></Link>
        </nav>
      </header>

      <section className="mx-auto max-w-7xl px-6 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 backdrop-blur px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success" /> Powered by Gemini · Built for ambitious careers
        </div>
        <h1 className="mt-6 text-5xl md:text-7xl font-semibold tracking-tight text-foreground">
          Your AI <span className="text-gradient-brand">career operating system</span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground">
          Track every application. Analyze every resume. Prep for every interview. One workspace that turns the chaos of job hunting into a precise, measurable process.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/auth"><Button size="lg">Start free <ArrowRight className="size-4" /></Button></Link>
          <a href="#features"><Button size="lg" variant="outline">See features</Button></a>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-success" /> No credit card</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-success" /> Bring your own resume</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-success" /> Export anytime</span>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-card hover:shadow-elevated transition">
              <div className="size-10 rounded-lg bg-accent text-primary grid place-items-center">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-8 flex items-center justify-between text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} CareerOS AI</span>
          <Link to="/auth" className="hover:text-foreground transition">Sign in →</Link>
        </div>
      </footer>
    </div>
  );
}
