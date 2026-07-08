import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSharedResume } from "@/features/resumes/resumes.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Eye, Clock } from "lucide-react";
import { formatDate } from "@/lib/format";
import { LoadingState, ErrorState } from "@/components/state-views";

export const Route = createFileRoute("/r/$slug")({
  head: () => ({ meta: [{ title: "Shared Resume · CareerOS AI" }] }),
  component: SharedResume,
});

function SharedResume() {
  const { slug } = Route.useParams();
  const fetchShared = useServerFn(getSharedResume);
  type SharedOk = Extract<Awaited<ReturnType<typeof getSharedResume>>, { ok: true }>;
  type State =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "not_found" }
    | { kind: "expired" }
    | { kind: "ok"; data: SharedOk };
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetchShared({
          data: {
            slug,
            referrer: typeof document !== "undefined" ? document.referrer : undefined,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          },
        });
        if (!alive) return;
        if (!res.ok) setState({ kind: res.reason });
        else setState({ kind: "ok", data: res });
      } catch (e: any) {
        if (!alive) return;
        setState({ kind: "error", message: e?.message ?? "Failed to load" });
      }
    })();
    return () => { alive = false; };
  }, [slug, fetchShared]);

  if (state.kind === "loading") return <div className="min-h-dvh grid place-items-center"><LoadingState /></div>;
  if (state.kind === "error") return <div className="min-h-dvh grid place-items-center p-6"><ErrorState description={state.message} /></div>;
  if (state.kind === "not_found") return (
    <div className="min-h-dvh grid place-items-center p-6">
      <ErrorState title="Link unavailable" description="This shared resume link is inactive or has been removed." />
    </div>
  );
  if (state.kind === "expired") return (
    <div className="min-h-dvh grid place-items-center p-6">
      <ErrorState title="Link expired" description="The owner set an expiry on this shared link." />
    </div>
  );

  const { resume, share } = state.data;
  const isPdf = resume.file_ext === "pdf";

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-primary/10 text-primary grid place-items-center"><FileText className="size-4" /></div>
            <div>
              <div className="text-sm font-semibold">{resume.name}</div>
              <div className="text-xs text-muted-foreground">Shared via CareerOS AI · v{resume.version}</div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Eye className="size-3.5" /> {share.view_count} views</span>
            {share.expires_at ? <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> expires {formatDate(share.expires_at)}</span> : null}
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4 md:p-6">
        {resume.tags?.length ? (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {resume.tags.map((t: string) => <Badge key={t} variant="secondary">{t}</Badge>)}
          </div>
        ) : null}
        <Card>
          <CardContent className="p-0 overflow-hidden">
            {isPdf ? (
              <iframe title={resume.name} src={resume.preview_url} className="w-full h-[80vh]" />
            ) : (
              <div className="p-6 whitespace-pre-wrap text-sm leading-6 max-h-[80vh] overflow-auto">
                {resume.extracted_text || (
                  <a href={resume.preview_url} className="text-primary underline" target="_blank" rel="noreferrer">
                    Download {resume.name}
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          This link was shared privately. Do not distribute without the owner's permission.
        </p>
      </main>
    </div>
  );
}
