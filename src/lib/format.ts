export function formatDate(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export const STATUS_LABELS: Record<string, string> = {
  applied: "Applied",
  oa: "Online Assessment",
  interview: "Interview",
  hr: "HR Round",
  offer: "Offer",
  rejected: "Rejected",
  joined: "Joined",
};

export const STATUS_COLORS: Record<string, string> = {
  applied: "bg-accent text-accent-foreground",
  oa: "bg-warning/15 text-warning-foreground border border-warning/30",
  interview: "bg-primary/10 text-primary border border-primary/20",
  hr: "bg-chart-5/15 text-chart-5 border border-chart-5/30",
  offer: "bg-success/15 text-success border border-success/30",
  rejected: "bg-destructive/10 text-destructive border border-destructive/20",
  joined: "bg-success text-success-foreground",
};
