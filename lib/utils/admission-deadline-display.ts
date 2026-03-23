import type { AdmissionApiResponse, AdmissionDeadline, AdmissionStage } from "@/lib/types/admission";

export type DatedAdmissionDeadline = AdmissionDeadline & { t: number };

function parseDeadlineEntries(a: AdmissionApiResponse): DatedAdmissionDeadline[] {
  return (a.deadlines ?? [])
    .filter((d) => d.date?.trim())
    .map((d) => ({ ...d, t: new Date(d.date!).getTime() }))
    .filter((d) => !Number.isNaN(d.t));
}

/** Earliest dated deadline of any type — used for urgency / “most urgent” signal. */
export function getEarliestAdmissionDeadline(a: AdmissionApiResponse): DatedAdmissionDeadline | null {
  const xs = parseDeadlineEntries(a).sort((x, y) => x.t - y.t);
  return xs[0] ?? null;
}

/**
 * Prefer `type: admission` (or missing type) for the “application” countdown;
 * otherwise fall back to earliest dated entry.
 */
export function getPrimaryBoardDeadline(a: AdmissionApiResponse): DatedAdmissionDeadline | null {
  const xs = parseDeadlineEntries(a);
  if (!xs.length) return null;
  const admissionish = xs.filter((d) => d.type === "admission" || d.type === undefined);
  const pool = admissionish.length ? admissionish : xs;
  return pool.slice().sort((x, y) => x.t - y.t)[0] ?? null;
}

export function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Calendar-day difference from `now` to deadline (local midnight to midnight). */
export function deadlineCalendarDaysUntil(deadlineMs: number, now: Date): number {
  const end = new Date(deadlineMs);
  const a = startOfLocalDay(now);
  const b = startOfLocalDay(end);
  return Math.round((b - a) / 86400000);
}

export type DeadlineUrgencyTier = "overdue" | "due_0_3" | "due_4_7" | "due_8_30" | "calm";

export function deadlineUrgencyTier(deadlineMs: number, now: Date): DeadlineUrgencyTier {
  const diffDays = deadlineCalendarDaysUntil(deadlineMs, now);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "due_0_3";
  if (diffDays <= 7) return "due_4_7";
  if (diffDays <= 30) return "due_8_30";
  return "calm";
}

let rtf: Intl.RelativeTimeFormat | null = null;
function getRtf(): Intl.RelativeTimeFormat {
  if (!rtf) rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  return rtf;
}

/** e.g. "in 3 days", "tomorrow", "5 days ago" (locale-aware). */
export function admissionDeadlineRelativeDayLabel(deadlineMs: number, now: Date): string {
  const diffDays = deadlineCalendarDaysUntil(deadlineMs, now);
  return getRtf().format(diffDays, "day");
}

export function getSoonestPrimaryDeadlineAmong(
  admissions: AdmissionApiResponse[]
): DatedAdmissionDeadline | null {
  const all = admissions.map((a) => getPrimaryBoardDeadline(a)).filter(Boolean) as DatedAdmissionDeadline[];
  if (!all.length) return null;
  return all.slice().sort((x, y) => x.t - y.t)[0] ?? null;
}

const TIER_RANK: Record<DeadlineUrgencyTier, number> = {
  overdue: 5,
  due_0_3: 4,
  due_4_7: 3,
  due_8_30: 2,
  calm: 1,
};

export function maxDeadlineUrgencyTier(a: AdmissionApiResponse, now: Date): DeadlineUrgencyTier | null {
  const e = getEarliestAdmissionDeadline(a);
  if (!e) return null;
  return deadlineUrgencyTier(e.t, now);
}

export function worstDeadlineUrgencyAmong(admissions: AdmissionApiResponse[], now: Date): DeadlineUrgencyTier | null {
  let best: DeadlineUrgencyTier | null = null;
  let rank = 0;
  for (const a of admissions) {
    const t = maxDeadlineUrgencyTier(a, now);
    if (!t) continue;
    const r = TIER_RANK[t];
    if (r > rank) {
      rank = r;
      best = t;
    }
  }
  return best;
}

function stageShellWhenNoUrgentDeadline(stage: AdmissionStage): string {
  switch (stage) {
    case "ready_to_submit":
      return "border-violet-500/35 bg-violet-500/[0.06] dark:border-violet-400/30";
    case "submitted":
    case "under_review":
    case "interview":
      return "border-blue-500/30 bg-blue-500/[0.06] dark:border-blue-400/25";
    case "decision":
    case "scholarship":
      return "border-indigo-500/30 bg-indigo-500/[0.05] dark:border-indigo-400/25";
    default:
      return "border-border bg-card";
  }
}

function tierShellClasses(tier: DeadlineUrgencyTier): string {
  switch (tier) {
    case "overdue":
      return "border-destructive/60 bg-destructive/[0.07] dark:bg-destructive/10";
    case "due_0_3":
      return "border-orange-500/55 bg-orange-500/[0.08] dark:border-orange-400/45 dark:bg-orange-500/10";
    case "due_4_7":
      return "border-amber-500/50 bg-amber-500/[0.07] dark:border-amber-400/40";
    case "due_8_30":
      return "border-sky-500/40 bg-sky-500/[0.06] dark:border-sky-400/35";
    default:
      return "border-border bg-card";
  }
}

/**
 * Border / background for kanban cards from decision, archived state, deadline urgency, then pipeline stage.
 */
export function admissionKanbanShellClassName(admission: AdmissionApiResponse, now: Date): string {
  if (admission.stage === "archived") {
    return "border-border/50 bg-muted/30";
  }
  if (admission.decision === "rejected") {
    return "border-red-800/35 bg-red-950/[0.12] dark:border-red-400/35 dark:bg-red-950/25";
  }
  if (admission.decision === "accepted") {
    return "border-emerald-600/45 bg-emerald-500/[0.08] dark:border-emerald-500/40 dark:bg-emerald-500/10";
  }
  if (admission.decision === "waitlist") {
    return "border-amber-600/45 bg-amber-500/[0.08] dark:border-amber-500/30";
  }

  const earliest = getEarliestAdmissionDeadline(admission);
  if (earliest) {
    const tier = deadlineUrgencyTier(earliest.t, now);
    if (tier !== "calm") {
      return tierShellClasses(tier);
    }
  }

  return stageShellWhenNoUrgentDeadline(admission.stage);
}

/** Group wrapper: reflect the most urgent deadline among nested admissions. */
export function admissionKanbanGroupShellClassName(items: AdmissionApiResponse[], now: Date): string {
  if (items.some((a) => a.stage === "archived")) {
    return "border-border/50 bg-muted/20";
  }
  const worst = worstDeadlineUrgencyAmong(items, now);
  if (worst && worst !== "calm") {
    return cnGroupTier(worst);
  }
  return "border-border bg-card";
}

function cnGroupTier(tier: DeadlineUrgencyTier): string {
  switch (tier) {
    case "overdue":
      return "border-destructive/50 bg-destructive/[0.04]";
    case "due_0_3":
      return "border-orange-500/45 bg-orange-500/[0.05] dark:border-orange-400/40";
    case "due_4_7":
      return "border-amber-500/40 bg-amber-500/[0.04]";
    case "due_8_30":
      return "border-sky-500/35 bg-sky-500/[0.04]";
    default:
      return "border-border bg-card";
  }
}

/** Text color for the relative countdown snippet on cards. */
export function admissionDeadlineCountdownTextClass(deadlineMs: number, now: Date): string {
  const tier = deadlineUrgencyTier(deadlineMs, now);
  if (tier === "overdue") return "text-destructive font-medium";
  if (tier === "due_0_3") return "text-orange-600 font-medium dark:text-orange-400";
  if (tier === "due_4_7") return "text-amber-800 dark:text-amber-300";
  if (tier === "due_8_30") return "text-sky-800 dark:text-sky-300";
  return "";
}

function stageNestedLeftBorderClass(stage: AdmissionStage): string {
  switch (stage) {
    case "ready_to_submit":
      return "border-l-violet-500/75 dark:border-l-violet-400/70";
    case "submitted":
    case "under_review":
    case "interview":
      return "border-l-blue-600/70 dark:border-l-blue-400/65";
    case "decision":
    case "scholarship":
      return "border-l-indigo-600/70 dark:border-l-indigo-400/65";
    default:
      return "border-l-primary/45";
  }
}

/** Left accent for nested (subtask) rows — matches deadline/decision/stage. */
export function admissionKanbanNestedLeftBorderClass(admission: AdmissionApiResponse, now: Date): string {
  if (admission.stage === "archived") return "border-l-muted-foreground/45";
  if (admission.decision === "rejected") return "border-l-red-700 dark:border-l-red-400/80";
  if (admission.decision === "accepted") return "border-l-emerald-600 dark:border-l-emerald-400/80";
  if (admission.decision === "waitlist") return "border-l-amber-600 dark:border-l-amber-400/75";
  const e = getEarliestAdmissionDeadline(admission);
  if (!e) return stageNestedLeftBorderClass(admission.stage);
  const tier = deadlineUrgencyTier(e.t, now);
  switch (tier) {
    case "overdue":
      return "border-l-destructive";
    case "due_0_3":
      return "border-l-orange-500 dark:border-l-orange-400";
    case "due_4_7":
      return "border-l-amber-500 dark:border-l-amber-400";
    case "due_8_30":
      return "border-l-sky-600 dark:border-l-sky-400";
    default:
      return stageNestedLeftBorderClass(admission.stage);
  }
}
