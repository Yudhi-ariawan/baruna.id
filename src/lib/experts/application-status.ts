/**
 * Expert application lifecycle (PB-EXP-01 / PB-EXP-02).
 *
 * The persisted state is spread over review_subjects.current_status,
 * review_subjects.metadata.review_status, the latest review_decisions row and the
 * linked review_drafts.status. This module is the ONLY place that folds those
 * signals into one effective status, so the admin list, admin detail and the
 * applicant's own view can never disagree about the same submission.
 */

export type ExpertEffectiveStatus =
  | "pending"
  | "under_review"
  | "decision_pending"
  | "revision_requested"
  | "resubmitted"
  | "approved"
  | "rejected"
  | "archived";

export type ExpertDecision = "approve" | "return_for_revision" | "reject";

export type ExpertStatusSignals = {
  subjectStatus: string | null | undefined;
  subjectMeta?: Record<string, unknown> | null;
  latestDecision?: string | null;
  /** Status of the most recent non-withdrawn draft linked to the subject. */
  draftStatus?: string | null;
  /** experts.current_status of the published profile, when one exists. */
  publishedExpertStatus?: string | null;
};

const CLOSED_SUBJECT_STATUSES = new Set(["approved", "withdrawn", "archived"]);

export function deriveExpertEffectiveStatus(signals: ExpertStatusSignals): ExpertEffectiveStatus {
  const status = signals.subjectStatus ?? "pending";
  const meta = signals.subjectMeta ?? {};
  const reviewStatus = typeof meta.review_status === "string" ? meta.review_status : null;
  const lastDecision = signals.latestDecision ?? null;
  const draftStatus = signals.draftStatus ?? null;

  const isArchived =
    status === "archived" ||
    status === "withdrawn" ||
    reviewStatus === "archived" ||
    (signals.publishedExpertStatus === "archived" &&
      status === "approved" &&
      reviewStatus !== "revision_requested" &&
      reviewStatus !== "resubmitted" &&
      reviewStatus !== "rejected");
  if (isArchived) return "archived";

  if (
    status === "approved" ||
    (lastDecision === "approve" && status !== "pending" && status !== "rejected")
  ) {
    return "approved";
  }
  if (status === "rejected" || (lastDecision === "reject" && status !== "pending")) {
    return "rejected";
  }

  const revisionCycle =
    lastDecision === "return_for_revision" ||
    reviewStatus === "revision_requested" ||
    reviewStatus === "resubmitted";

  if (
    revisionCycle &&
    reviewStatus === "resubmitted" &&
    draftStatus === "submitted" &&
    !CLOSED_SUBJECT_STATUSES.has(status)
  ) {
    return "resubmitted";
  }
  if (revisionCycle) return "revision_requested";

  if (status === "under_review" || status === "decision_pending") return status;
  return "pending";
}

/** Statuses an admin queue treats as "waiting for a decision". */
export const EXPERT_AWAITING_DECISION: ReadonlySet<ExpertEffectiveStatus> = new Set([
  "pending",
  "under_review",
  "decision_pending",
  "resubmitted",
]);

/**
 * Decision transition guard. Returns null when allowed, otherwise an
 * Indonesian message explaining why the transition is blocked.
 *
 * - archived: must be restored first (unarchive), no decision may be recorded.
 * - approve on an already-approved subject is an idempotent re-sync (handled by caller).
 * - repeating the same terminal decision is rejected to stop double submits.
 * - return_for_revision while the applicant is still revising is rejected.
 */
export function getExpertDecisionBlocker(
  current: ExpertEffectiveStatus,
  decision: ExpertDecision,
): string | null {
  if (current === "archived") {
    return "Pakar berstatus arsip. Pulihkan terlebih dahulu sebelum mencatat keputusan baru.";
  }
  if (decision === "reject" && current === "rejected") {
    return "Pengajuan ini sudah berstatus ditolak.";
  }
  if (decision === "return_for_revision" && current === "revision_requested") {
    return "Pengajuan ini sudah menunggu revisi dari pemohon.";
  }
  if (decision === "return_for_revision" && current === "rejected") {
    return "Pengajuan yang sudah ditolak tidak dapat dikembalikan untuk revisi.";
  }
  return null;
}

/**
 * Applicant-facing view of a single draft. While a revision cycle is open the
 * applicant sees "revision_requested" on the editable draft and "pending" on
 * a draft that has already been (re)submitted.
 */
export function toApplicantReviewStatus(
  effective: ExpertEffectiveStatus,
  draftStatus: string,
): string {
  if (effective === "revision_requested" || effective === "resubmitted") {
    return draftStatus === "draft" ? "revision_requested" : "pending";
  }
  return effective;
}
