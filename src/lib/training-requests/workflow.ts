// ============================================================================
// Workflow stage & SLA (Slide 13) — shared by the requester pages, the curation
// console and in-app notifications. Pure functions, no I/O.
// ----------------------------------------------------------------------------
// The stage a submission is in comes from review_subjects.current_status plus
// two facts the status alone cannot tell:
//   * an open revision draft  → the requester's turn (no SLA runs);
//   * a later revision        → a resubmission restarts the "pending" clock.
// SLA targets come from workflow_sla_policies (migration 20261021110000).
// ============================================================================

export type SlaPolicy = {
  subject_kind: string;
  status: string;
  target_hours: number;
  responsible_label: string;
  is_active: boolean;
  updated_at?: string;
};

export type StatusHistoryRow = {
  id: number;
  subject_id: string;
  from_status: string | null;
  to_status: string;
  changed_at: string;
  is_backfill: boolean;
};

export type StageKey =
  | "pending"
  | "revision_requested"
  | "under_review"
  | "decision_pending"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "archived";

export type WorkflowStage = {
  key: StageKey;
  /** When the submission entered this stage (ISO). */
  since: string;
  /** True for the steps the BARUNA team is responsible for. */
  open: boolean;
  sla: {
    targetHours: number;
    dueAt: string;
    overdue: boolean;
    responsible: string;
  } | null;
};

const OPEN_STATUSES = new Set(["pending", "under_review", "decision_pending"]);

export function isOpenStatus(status: string): boolean {
  return OPEN_STATUSES.has(status);
}

/** Key for looking up a policy by kind and status. */
export const slaKey = (kind: string, status: string) => `${kind}:${status}`;

export function indexSlaPolicies(policies: SlaPolicy[]): Map<string, SlaPolicy> {
  return new Map(policies.filter((p) => p.is_active).map((p) => [slaKey(p.subject_kind, p.status), p]));
}

export function computeStage(input: {
  kind: string;
  status: string;
  createdAt: string;
  /** Status history of this subject (any order). */
  history: StatusHistoryRow[];
  /** submitted_at of the latest revision, if any. */
  latestRevisionAt?: string | null;
  hasOpenRevisionDraft: boolean;
  policies: Map<string, SlaPolicy>;
  now?: Date;
}): WorkflowStage {
  const time = (iso: string) => new Date(iso).getTime();
  const entered = input.history
    .filter((h) => h.to_status === input.status)
    .sort((a, b) => time(b.changed_at) - time(a.changed_at) || b.id - a.id)[0];
  let since = entered?.changed_at ?? input.createdAt;
  if (input.status === "pending" && input.latestRevisionAt && time(input.latestRevisionAt) > time(since)) {
    since = input.latestRevisionAt;
  }

  const key: StageKey =
    input.status === "pending" && input.hasOpenRevisionDraft
      ? "revision_requested"
      : ((input.status as StageKey) ?? "pending");
  const open = isOpenStatus(input.status) && key !== "revision_requested";

  const policy = open ? input.policies.get(slaKey(input.kind, input.status)) : undefined;
  let sla: WorkflowStage["sla"] = null;
  if (policy) {
    const due = new Date(new Date(since).getTime() + policy.target_hours * 3_600_000);
    sla = {
      targetHours: policy.target_hours,
      dueAt: due.toISOString(),
      overdue: (input.now ?? new Date()).getTime() > due.getTime(),
      responsible: policy.responsible_label,
    };
  }
  return { key, since, open, sla };
}

/** "3 hari 4 jam" style duration, Indonesian (console). */
export function formatHoursId(hours: number): string {
  const h = Math.max(0, Math.round(hours));
  const d = Math.floor(h / 24);
  const r = h % 24;
  if (d && r) return `${d} hari ${r} jam`;
  if (d) return `${d} hari`;
  return `${r} jam`;
}

/** "3 days 4 hours" style duration, English (Academy requester pages). */
export function formatHoursEn(hours: number): string {
  const h = Math.max(0, Math.round(hours));
  const d = Math.floor(h / 24);
  const r = h % 24;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (d && r) return `${part(d, "day")} ${part(r, "hour")}`;
  if (d) return part(d, "day");
  return part(r, "hour");
}

/** Human label of the console stage (Indonesian). */
export const STAGE_LABEL_ID: Record<StageKey, string> = {
  pending: "Menunggu penugasan reviewer",
  revision_requested: "Menunggu revisi pemohon",
  under_review: "Sedang direview",
  decision_pending: "Menunggu keputusan",
  approved: "Disetujui",
  rejected: "Ditolak",
  withdrawn: "Ditarik pemohon",
  archived: "Diarsipkan",
};

/** Requester-facing label of the stage (English, Academy). */
export const STAGE_LABEL_EN: Record<StageKey, string> = {
  pending: "Submitted",
  revision_requested: "Revision Requested",
  under_review: "Under Review",
  decision_pending: "Awaiting Decision",
  approved: "Approved",
  rejected: "Not Approved",
  withdrawn: "Withdrawn",
  archived: "Archived",
};

export const STAGE_STYLE: Record<StageKey, string> = {
  pending: "bg-badge-course/15 text-badge-course",
  revision_requested: "bg-destructive/15 text-destructive",
  under_review: "bg-badge-workshop/15 text-badge-workshop",
  decision_pending: "bg-badge-workshop/15 text-badge-workshop",
  approved: "bg-marine/15 text-marine",
  rejected: "bg-muted text-foreground/70",
  withdrawn: "bg-muted text-foreground/70",
  archived: "bg-muted text-foreground/70",
};

/** Display reference for a submission; derived from its id, so it is the same on every device. */
export function trainingRequestReference(subjectId: string, createdAt: string): string {
  return `TR-${new Date(createdAt).getUTCFullYear()}-${subjectId.slice(0, 8).toUpperCase()}`;
}
