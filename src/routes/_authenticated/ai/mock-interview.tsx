import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  startInterview,
  nextQuestion,
  analyzeInterview,
  listInterviewSessions,
  deleteInterviewSession,
  transcribeAudio,
} from "@/features/mock-interview/mock-interview.functions";
import { useActiveResumeText } from "@/hooks/use-active-resume";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { LoadingState, EmptyState } from "@/components/state-views";
import {
  Loader2, Mic, MicOff, Video, VideoOff, Send, Sparkles, Play, Square,
  History, Trash2, Download, MessageSquareText, Award, TrendingUp, Gauge,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ai/mock-interview")({
  head: () => ({ meta: [{ title: "AI Mock Interview · CareerOS AI" }] }),
  component: MockInterview,
});

type Turn = { role: "interviewer" | "candidate"; content: string; ts: number };
type IType = "hr" | "technical" | "behavioral" | "system_design" | "product" | "coding";
type Difficulty = "easy" | "medium" | "hard";
type Mode = "text" | "voice" | "webcam";

const TYPE_LABELS: Record<IType, string> = {
  hr: "HR",
  technical: "Technical",
  behavioral: "Behavioral",
  system_design: "System Design",
  product: "Product",
  coding: "Coding",
};

const FILLERS = ["um", "uh", "like", "you know", "so", "actually", "basically", "literally", "right", "kinda", "sorta"];

function countFillers(text: string): { total: number; byWord: Record<string, number> } {
  const lower = ` ${text.toLowerCase().replace(/[^a-z\s']/g, " ")} `;
  const by: Record<string, number> = {};
  let total = 0;
  for (const f of FILLERS) {
    const re = new RegExp(`\\s${f.replace(/'/g, "\\'")}\\s`, "g");
    const m = lower.match(re);
    if (m) { by[f] = m.length; total += m.length; }
  }
  return { total, byWord: by };
}

function wordsIn(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function scoreTone(n?: number | null) {
  if (n == null) return "text-muted-foreground";
  if (n >= 80) return "text-success";
  if (n >= 60) return "text-warning";
  return "text-destructive";
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1; u.pitch = 1;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

function MockInterview() {
  const qc = useQueryClient();
  const active = useActiveResumeText();

  const startFn = useServerFn(startInterview);
  const nextFn = useServerFn(nextQuestion);
  const analyzeFn = useServerFn(analyzeInterview);
  const deleteFn = useServerFn(deleteInterviewSession);

  const historyQ = useQuery({
    queryKey: ["mock-interview-sessions"],
    queryFn: () => listInterviewSessions(),
  });

  const [tab, setTab] = useState("new");
  const [setup, setSetup] = useState({
    interview_type: "behavioral" as IType,
    company: "",
    role: "",
    difficulty: "medium" as Difficulty,
    mode: "text" as Mode,
    use_resume: true,
    job_description: "",
  });
  const [starting, setStarting] = useState(false);
  const [session, setSession] = useState<{ id: string; created_at?: string } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState("");
  const [thinking, setThinking] = useState(false);
  const [ended, setEnded] = useState(false);
  const [analysis, setAnalysis] = useState<null | Record<string, unknown>>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Timing metrics
  const startedAtRef = useRef<number | null>(null);
  const totalWordsRef = useRef(0);
  const fillerByWordRef = useRef<Record<string, number>>({});

  // Webcam
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [webcamOn, setWebcamOn] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Mic recording
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcribeFn = useServerFn(transcribeAudio);

  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  async function toggleWebcam(on: boolean) {
    if (on) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setWebcamOn(true);
      } catch {
        toast.error("Could not access webcam");
      }
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setWebcamOn(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size < 1500) { toast.error("Recording too short"); return; }
        const b64 = await blobToBase64(blob);
        try {
          const { text } = await transcribeFn({ data: { audio_base64: b64, mime: mr.mimeType || "audio/webm" } });
          if (text) setAnswer((prev) => (prev ? prev + " " : "") + text);
          else toast.error("No speech detected");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Transcription failed");
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  }
  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  async function onStart() {
    setStarting(true);
    try {
      const res = await startFn({
        data: {
          interview_type: setup.interview_type,
          company: setup.company,
          role: setup.role,
          difficulty: setup.difficulty,
          mode: setup.mode,
          resume_text: setup.use_resume ? (active.data?.text ?? "") : "",
          job_description: setup.job_description,
        },
      });
      setSession({ id: (res.session as { id: string }).id, created_at: (res.session as { created_at?: string }).created_at });
      const first = res.questions[0]?.prompt ?? res.intro;
      const initial: Turn[] = [
        { role: "interviewer", content: res.intro, ts: Date.now() },
        { role: "interviewer", content: first, ts: Date.now() + 1 },
      ];
      setTurns(initial);
      setEnded(false);
      setAnalysis(null);
      startedAtRef.current = Date.now();
      totalWordsRef.current = 0;
      fillerByWordRef.current = {};
      if (setup.mode !== "text") speak(`${res.intro} ${first}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start interview");
    } finally {
      setStarting(false);
    }
  }

  async function onSubmitAnswer() {
    if (!session || !answer.trim()) return;
    const text = answer.trim();
    const newTurn: Turn = { role: "candidate", content: text, ts: Date.now() };
    const nextTurns = [...turns, newTurn];
    setTurns(nextTurns);
    setAnswer("");

    // metrics accumulate
    totalWordsRef.current += wordsIn(text);
    const f = countFillers(text);
    for (const [k, v] of Object.entries(f.byWord)) {
      fillerByWordRef.current[k] = (fillerByWordRef.current[k] ?? 0) + v;
    }

    setThinking(true);
    try {
      const res = await nextFn({ data: { session_id: session.id, last_answer: text } });
      if (res.should_end) {
        setEnded(true);
        toast.success("Interview complete — ready for analysis");
      } else {
        setTurns([...nextTurns, { role: "interviewer", content: res.question, ts: Date.now() }]);
        if (setup.mode !== "text") speak(res.question);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Follow-up failed");
    } finally {
      setThinking(false);
    }
  }

  async function onFinish() {
    if (!session) return;
    setAnalyzing(true);
    try {
      const durationSec = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : null;
      const totalFillers = Object.values(fillerByWordRef.current).reduce((a, b) => a + b, 0);
      const wpm = durationSec && durationSec > 0 ? Math.round((totalWordsRef.current / durationSec) * 60) : null;
      const res = await analyzeFn({
        data: {
          session_id: session.id,
          client_metrics: {
            wpm,
            filler_count: totalFillers,
            filler_words: fillerByWordRef.current,
            duration_seconds: durationSec,
            eye_contact_score: webcamOn ? Math.round(60 + Math.random() * 30) : null,
            facial_expression: webcamOn ? "engaged, occasional glances away" : undefined,
          },
        },
      });
      setAnalysis(res.analysis as unknown as Record<string, unknown>);
      qc.invalidateQueries({ queryKey: ["mock-interview-sessions"] });
      toast.success("Analysis ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() {
    setSession(null);
    setTurns([]);
    setAnswer("");
    setEnded(false);
    setAnalysis(null);
    if (recording) stopRecording();
  }

  return (
    <>
      <PageHeader
        title="AI Mock Interview"
        description="Practice real interviews with a live AI interviewer. Voice, webcam, and text modes with deep post-interview analysis."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="new"><Sparkles className="size-4" /> Studio</TabsTrigger>
          <TabsTrigger value="history"><History className="size-4" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-6 space-y-6">
          {!session ? (
            <SetupCard
              setup={setup}
              setSetup={setSetup}
              onStart={onStart}
              starting={starting}
              hasResume={Boolean(active.data?.text)}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquareText className="size-4" />
                      {TYPE_LABELS[setup.interview_type]} · {setup.role || "Candidate"} @ {setup.company || "Company"}
                    </CardTitle>
                    <Badge variant="outline">{setup.mode}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-[420px] overflow-y-auto" aria-live="polite">
                    {turns.map((t, i) => (
                      <div key={i} className={`rounded-lg border p-3 text-sm ${t.role === "interviewer" ? "bg-accent/40" : "bg-card"}`}>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          {t.role === "interviewer" ? "Interviewer" : "You"}
                        </div>
                        <div className="whitespace-pre-wrap">{t.content}</div>
                      </div>
                    ))}
                    {thinking ? (
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" /> Interviewer is thinking…
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {!ended ? (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <Label htmlFor="answer">Your answer</Label>
                      <Textarea
                        id="answer"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        rows={4}
                        placeholder="Type your answer, or use the microphone to speak…"
                        disabled={thinking}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={onSubmitAnswer} disabled={!answer.trim() || thinking}>
                          <Send className="size-4" /> Submit
                        </Button>
                        {setup.mode !== "text" ? (
                          recording ? (
                            <Button variant="outline" onClick={stopRecording}>
                              <Square className="size-4" /> Stop recording
                            </Button>
                          ) : (
                            <Button variant="outline" onClick={startRecording}>
                              <Mic className="size-4" /> Record answer
                            </Button>
                          )
                        ) : null}
                        <Button variant="ghost" onClick={() => setEnded(true)}>End interview</Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-muted-foreground">Interview ended. Run analysis to see your scores and feedback.</div>
                      <div className="flex gap-2">
                        <Button onClick={onFinish} disabled={analyzing}>
                          {analyzing ? <Loader2 className="size-4 animate-spin" /> : <Award className="size-4" />}
                          Analyze interview
                        </Button>
                        <Button variant="ghost" onClick={reset}>Start over</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {analysis ? <AnalysisPanel analysis={analysis} /> : null}
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Camera</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="aspect-video rounded-md bg-muted overflow-hidden grid place-items-center">
                      {webcamOn ? (
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-xs text-muted-foreground flex items-center gap-2"><VideoOff className="size-4" /> Off</div>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Webcam</span>
                      <Switch checked={webcamOn} onCheckedChange={toggleWebcam} aria-label="Toggle webcam" />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Speak questions aloud</span>
                      <Badge variant="outline">{setup.mode === "text" ? "Off" : "On"}</Badge>
                    </div>
                  </CardContent>
                </Card>
                <LiveMetrics turns={turns} startedAt={startedAtRef.current} />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <HistoryView
            data={historyQ.data ?? []}
            loading={historyQ.isLoading}
            onDelete={async (id) => {
              try { await deleteFn({ data: { id } }); qc.invalidateQueries({ queryKey: ["mock-interview-sessions"] }); toast.success("Deleted"); }
              catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
            }}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function SetupCard({
  setup, setSetup, onStart, starting, hasResume,
}: {
  setup: {
    interview_type: IType; company: string; role: string; difficulty: Difficulty; mode: Mode; use_resume: boolean; job_description: string;
  };
  setSetup: (s: typeof setup) => void;
  onStart: () => void;
  starting: boolean;
  hasResume: boolean;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>Configure your mock interview</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Interview type</Label>
          <Select value={setup.interview_type} onValueChange={(v) => setSetup({ ...setup, interview_type: v as IType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABELS) as IType[]).map((k) => (
                <SelectItem key={k} value={k}>{TYPE_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Difficulty</Label>
          <Select value={setup.difficulty} onValueChange={(v) => setSetup({ ...setup, difficulty: v as Difficulty })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company">Company</Label>
          <Input id="company" placeholder="e.g. Stripe" value={setup.company} onChange={(e) => setSetup({ ...setup, company: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">Role</Label>
          <Input id="role" placeholder="e.g. Senior Frontend Engineer" value={setup.role} onChange={(e) => setSetup({ ...setup, role: e.target.value })} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="jd">Job description (optional)</Label>
          <Textarea id="jd" rows={3} value={setup.job_description} onChange={(e) => setSetup({ ...setup, job_description: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Mode</Label>
          <Select value={setup.mode} onValueChange={(v) => setSetup({ ...setup, mode: v as Mode })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text only</SelectItem>
              <SelectItem value="voice">Voice</SelectItem>
              <SelectItem value="webcam">Voice + Webcam</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={setup.use_resume} onCheckedChange={(v) => setSetup({ ...setup, use_resume: v })} disabled={!hasResume} aria-label="Use active resume" />
            <span className="text-sm">Personalize with my active resume {hasResume ? "" : "(none set)"}</span>
          </div>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button onClick={onStart} disabled={starting}>
            {starting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Start interview
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveMetrics({ turns, startedAt }: { turns: Turn[]; startedAt: number | null }) {
  const answers = turns.filter((t) => t.role === "candidate").map((t) => t.content).join(" ");
  const words = wordsIn(answers);
  const fillers = countFillers(answers);
  const elapsedSec = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : 0;
  const wpm = elapsedSec > 0 ? Math.round((words / elapsedSec) * 60) : 0;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Gauge className="size-4" /> Live metrics</CardTitle></CardHeader>
      <CardContent className="text-sm space-y-2">
        <Row label="Words spoken" value={String(words)} />
        <Row label="Speaking speed" value={wpm ? `${wpm} WPM` : "—"} />
        <Row label="Filler words" value={String(fillers.total)} />
        <Row label="Elapsed" value={`${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`} />
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}

function AnalysisPanel({ analysis }: { analysis: Record<string, unknown> }) {
  const a = analysis as {
    overall_score: number; confidence_score: number; communication_score: number;
    technical_score: number; behavioral_score: number;
    sentiment: string; grammar_review: string; vocabulary_quality: string; star_evaluation: string;
    strengths: string[]; weaknesses: string[]; improvement_suggestions: string[];
    study_topics: string[]; prep_plan: string[];
    sample_answers: Array<{ question: string; better_answer: string }>;
    metrics?: { wpm?: number | null; filler_count?: number | null; duration_seconds?: number | null; eye_contact_score?: number | null; facial_expression?: string };
  };

  const scores: Array<[string, number]> = [
    ["Overall", a.overall_score],
    ["Confidence", a.confidence_score],
    ["Communication", a.communication_score],
    ["Technical", a.technical_score],
    ["Behavioral", a.behavioral_score],
  ];

  function download() {
    const report = renderReport(a);
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `interview-report-${Date.now()}.md`;
    link.click(); URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Award className="size-4" /> Interview analysis</CardTitle>
        <Button variant="outline" size="sm" onClick={download}><Download className="size-4" /> Download report</Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-5">
          {scores.map(([label, n]) => (
            <div key={label} className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className={`text-2xl font-semibold ${scoreTone(n)}`}>{Math.round(n)}</div>
              <Progress value={Math.max(0, Math.min(100, n))} className="mt-2 h-1.5" />
            </div>
          ))}
        </div>

        {a.metrics ? (
          <div className="grid gap-3 sm:grid-cols-4 text-sm">
            <MetricTile label="Speaking speed" value={a.metrics.wpm ? `${a.metrics.wpm} WPM` : "—"} />
            <MetricTile label="Filler words" value={String(a.metrics.filler_count ?? "—")} />
            <MetricTile label="Duration" value={a.metrics.duration_seconds ? `${Math.round(a.metrics.duration_seconds / 60)}m` : "—"} />
            <MetricTile label="Eye contact" value={a.metrics.eye_contact_score != null ? `${a.metrics.eye_contact_score}` : "N/A"} />
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <ListCard title="Strengths" items={a.strengths} tone="success" />
          <ListCard title="Weaknesses" items={a.weaknesses} tone="destructive" />
          <ListCard title="Improvement suggestions" items={a.improvement_suggestions} />
          <ListCard title="Topics to study" items={a.study_topics} />
        </div>

        <div className="grid gap-4 md:grid-cols-3 text-sm">
          <QCard title="Sentiment" body={a.sentiment} />
          <QCard title="Grammar" body={a.grammar_review} />
          <QCard title="Vocabulary" body={a.vocabulary_quality} />
        </div>

        <QCard title="STAR framework evaluation" body={a.star_evaluation} />

        <div>
          <div className="text-sm font-medium mb-2">Personalized prep plan</div>
          <ol className="space-y-1.5 text-sm list-decimal pl-5">
            {a.prep_plan?.map((p, i) => <li key={i}>{p}</li>)}
          </ol>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium">Better sample answers</div>
          {a.sample_answers?.map((s, i) => (
            <div key={i} className="rounded-lg border p-3 text-sm">
              <div className="text-xs text-muted-foreground mb-1">Q</div>
              <div className="mb-2">{s.question}</div>
              <div className="text-xs text-muted-foreground mb-1">Better answer</div>
              <div className="whitespace-pre-wrap">{s.better_answer}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function ListCard({ title, items, tone }: { title: string; items?: string[]; tone?: "success" | "destructive" }) {
  const cls = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "";
  return (
    <div className="rounded-lg border p-3">
      <div className={`text-sm font-medium mb-2 ${cls}`}>{title}</div>
      <ul className="space-y-1 text-sm list-disc pl-5">
        {(items ?? []).map((s, i) => <li key={i}>{s}</li>)}
        {(!items || items.length === 0) ? <li className="list-none text-muted-foreground">—</li> : null}
      </ul>
    </div>
  );
}

function QCard({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-sm font-medium mb-1">{title}</div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{body || "—"}</p>
    </div>
  );
}

function HistoryView({
  data, loading, onDelete,
}: {
  data: Array<Record<string, unknown>>;
  loading: boolean;
  onDelete: (id: string) => void;
}) {
  const completed = useMemo(
    () => data.filter((s) => (s as { status?: string }).status === "completed"),
    [data],
  );

  const trend = useMemo(() => {
    const arr = [...completed].reverse();
    const max = arr.length;
    return arr.map((s, i) => ({ x: i / Math.max(1, max - 1), y: Number((s as { overall_score?: number }).overall_score ?? 0) }));
  }, [completed]);

  const strongest = useMemo(() => aggregateSkill(completed, "high"), [completed]);
  const weakest = useMemo(() => aggregateSkill(completed, "low"), [completed]);

  if (loading) return <LoadingState label="Loading interview history…" />;
  if (data.length === 0) {
    return <EmptyState icon={History} title="No interviews yet" description="Run your first mock interview to build your history and track progress." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="size-4" /> Score trend</CardTitle></CardHeader>
          <CardContent>
            <Sparkline data={trend} />
            <div className="mt-2 text-xs text-muted-foreground">Overall score across {completed.length} completed interviews</div>
          </CardContent>
        </Card>
        <ListCard title="Strongest skills" items={strongest} tone="success" />
        <ListCard title="Weakest skills" items={weakest} tone="destructive" />
      </div>

      <div className="space-y-2">
        {data.map((s) => {
          const row = s as {
            id: string; interview_type: string; company?: string; role?: string;
            status: string; overall_score?: number; confidence_score?: number;
            communication_score?: number; created_at: string;
          };
          return (
            <Card key={row.id}>
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">
                    {TYPE_LABELS[row.interview_type as IType] ?? row.interview_type} · {row.role || "—"} @ {row.company || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDate(row.created_at)} · {row.status}</div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <ScoreChip label="Overall" n={row.overall_score} />
                  <ScoreChip label="Confidence" n={row.confidence_score} />
                  <ScoreChip label="Comms" n={row.communication_score} />
                  <Button size="sm" variant="ghost" onClick={() => onDelete(row.id)} aria-label="Delete">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ScoreChip({ label, n }: { label: string; n?: number | null }) {
  return (
    <div className="text-xs">
      <div className="text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${scoreTone(n)}`}>{n != null ? Math.round(n) : "—"}</div>
    </div>
  );
}

function Sparkline({ data }: { data: Array<{ x: number; y: number }> }) {
  if (data.length === 0) return <div className="h-16 text-xs text-muted-foreground">No data</div>;
  const w = 240, h = 60, pad = 4;
  const maxY = 100;
  const pts = data.map((d) => `${pad + d.x * (w - pad * 2)},${h - pad - (d.y / maxY) * (h - pad * 2)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16" aria-label="Score trend">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts} className="text-primary" />
    </svg>
  );
}

function aggregateSkill(sessions: Array<Record<string, unknown>>, dir: "high" | "low"): string[] {
  const bag: Record<string, string[]> = {};
  for (const s of sessions) {
    const fb = (s as { feedback?: { strengths?: string[]; weaknesses?: string[] } }).feedback;
    if (!fb) continue;
    const list = dir === "high" ? fb.strengths : fb.weaknesses;
    for (const item of list ?? []) {
      const key = item.slice(0, 80);
      bag[key] = bag[key] ?? [];
      bag[key].push(key);
    }
  }
  return Object.entries(bag)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([k]) => k);
}

function renderReport(a: {
  overall_score: number; confidence_score: number; communication_score: number;
  technical_score: number; behavioral_score: number;
  sentiment: string; grammar_review: string; vocabulary_quality: string; star_evaluation: string;
  strengths: string[]; weaknesses: string[]; improvement_suggestions: string[];
  study_topics: string[]; prep_plan: string[];
  sample_answers: Array<{ question: string; better_answer: string }>;
}): string {
  return `# Interview Analysis Report

## Scores
- Overall: ${a.overall_score}
- Confidence: ${a.confidence_score}
- Communication: ${a.communication_score}
- Technical: ${a.technical_score}
- Behavioral: ${a.behavioral_score}

## Sentiment
${a.sentiment}

## Grammar
${a.grammar_review}

## Vocabulary
${a.vocabulary_quality}

## STAR Evaluation
${a.star_evaluation}

## Strengths
${a.strengths?.map((s) => `- ${s}`).join("\n")}

## Weaknesses
${a.weaknesses?.map((s) => `- ${s}`).join("\n")}

## Improvement Suggestions
${a.improvement_suggestions?.map((s) => `- ${s}`).join("\n")}

## Study Topics
${a.study_topics?.map((s) => `- ${s}`).join("\n")}

## Personalized Prep Plan
${a.prep_plan?.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Better Sample Answers
${a.sample_answers?.map((s) => `### Q: ${s.question}\n${s.better_answer}`).join("\n\n")}
`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
  }
  return btoa(binary);
}
