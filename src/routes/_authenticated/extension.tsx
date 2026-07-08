import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Chrome, Download, Link2, Shield, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/extension")({
  head: () => ({
    meta: [
      { title: "Chrome Extension · CareerOS AI" },
      { name: "description", content: "Install the CareerOS AI Chrome extension and save jobs from LinkedIn, Indeed, Wellfound, and more with one click." },
    ],
  }),
  component: ExtensionPage,
});

const SUPPORTED = [
  "LinkedIn Jobs", "Wellfound", "Internshala", "Naukri",
  "Indeed", "Glassdoor", "Greenhouse", "Lever", "Ashby",
];

function ExtensionPage() {
  const [extPresent, setExtPresent] = useState<{ id: string; version: string } | null>(null);
  const [linkState, setLinkState] = useState<"idle" | "linking" | "linked" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data;
      if (data?.source === "careeros-extension-present") {
        setExtPresent({ id: data.extensionId, version: data.version });
      }
      if (data?.source === "careeros-extension-ack") {
        setLinkState(data.ok ? "linked" : "error");
        if (!data.ok) setError("Extension rejected the session. Please try again.");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function linkNow() {
    setError(null);
    setLinkState("linking");
    const { data, error: err } = await supabase.auth.getSession();
    if (err || !data.session) {
      setError("Could not read your session. Please sign in again.");
      setLinkState("error");
      return;
    }
    const s = data.session;
    window.postMessage(
      {
        source: "careeros-extension-link",
        session: {
          access_token: s.access_token,
          refresh_token: s.refresh_token,
          expires_at: s.expires_at,
          user: { id: s.user.id, email: s.user.email ?? undefined },
        },
      },
      window.location.origin,
    );
    // Fallback: if the extension never acks within 3s, surface guidance.
    setTimeout(() => {
      setLinkState((current) => (current === "linking" ? "error" : current));
      setError((prev) => prev ?? "No response from the extension. Make sure it's installed and enabled, then reload this page.");
    }, 3000);
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Chrome className="size-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">CareerOS AI · Chrome Extension</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Save internships and jobs from any supported job portal directly into your Applications, with duplicate
          detection, auto-tagging, and one-tap AI Job Match & Resume Match.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Download className="size-4 text-primary" /> 1 · Install the extension</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Download the packaged extension, unzip it, then load it as an unpacked extension in any Chromium
              browser (Chrome, Edge, Brave, Arc).
            </p>
            <Button onClick={downloadExtension} className="w-full sm:w-auto">
              <Download className="size-4" /> Download .zip
            </Button>
            <ol className="list-decimal pl-5 text-xs text-muted-foreground space-y-1">
              <li>Unzip the downloaded file.</li>
              <li>Open <code className="rounded bg-muted px-1">chrome://extensions</code>.</li>
              <li>Toggle <b>Developer mode</b> in the top right.</li>
              <li>Click <b>Load unpacked</b> and pick the unzipped folder.</li>
              <li>Return to this page to link your account.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Link2 className="size-4 text-primary" /> 2 · Link your account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-xs">
              <span>Extension status:</span>
              {extPresent ? (
                <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3 text-emerald-500" /> Detected v{extPresent.version}</Badge>
              ) : (
                <Badge variant="outline">Not detected on this page</Badge>
              )}
            </div>
            <Button onClick={linkNow} disabled={!extPresent || linkState === "linking"} className="w-full sm:w-auto">
              <Link2 className="size-4" /> {linkState === "linking" ? "Linking…" : linkState === "linked" ? "Linked ✓" : "Sign in the extension"}
            </Button>
            {linkState === "linked" ? (
              <p className="text-emerald-600 text-xs flex items-center gap-1"><CheckCircle2 className="size-3.5" /> Your extension is now signed in as you. Open a job posting on any supported site and click the extension icon.</p>
            ) : null}
            {error ? <p className="text-destructive text-xs">{error}</p> : null}
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Shield className="size-3.5 mt-0.5" />
              <span>Your session token is stored only in the extension's local storage on this device. Sign out from the popup at any time.</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> What it does</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
          <ul className="space-y-1.5 text-muted-foreground">
            <li>• Auto-detects job postings on supported sites</li>
            <li>• Extracts company, role, location, salary, deadline</li>
            <li>• Infers relevant skills and tags the source portal</li>
            <li>• Detects duplicates by URL or company + role</li>
          </ul>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>• Saves to your existing Applications database</li>
            <li>• Recent saves surfaced in the popup</li>
            <li>• One-tap AI Job Match & Resume Match</li>
            <li>• Works offline-tolerant with token auto-refresh</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supported portals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {SUPPORTED.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function downloadExtension() {
  fetch("/careeros-extension.zip")
    .then((res) => {
      if (!res.ok) throw new Error(`Download failed (${res.status}). Run \`bun run extension/build.mjs\` to build it first.`);
      return res.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "careeros-extension.zip";
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch((err) => alert(err.message));
}
