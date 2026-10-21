// ============================================================================
// "My Training Requests" — the requester's own submissions (PB-ACA-06, Slide 25)
// ----------------------------------------------------------------------------
// Read from the database with the requester's own client, so RLS decides what
// is visible (review_subjects / revisions / decisions / drafts / status
// history are all submitter-readable). Nothing here comes from the browser, so
// the list is the same on every device and shows the BARUNA team's decisions.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TrainingRequestDraft } from "@/lib/trainingRequests";
import { payloadToRequestForm } from "./payload";
import {
  computeStage,
  indexSlaPolicies,
  isOpenStatus,
  trainingRequestReference,
  type SlaPolicy,
  type StatusHistoryRow,
  type WorkflowStage,
} from "./workflow";

export type MyTrainingRequestSummary = {
  id: string;
  reference: string;
  title: string;
  category: string;
  organization: string;
  country: string;
  submittedAt: string;
  updatedAt: string;
  stage: WorkflowStage;
};

export type TrainingRequestTimelineEvent = {
  id: string;
  at: string;
  kind:
    | "submitted"
    | "resubmitted"
    | "review_started"
    | "review_completed"
    | "revision_requested"
    | "approved"
    | "rejected"
    | "withdrawn"
    | "archived";
  note: string | null;
  revision?: number;
};

export type MyTrainingRequestDetail = MyTrainingRequestSummary & {
  /** The open revision draft when one exists, otherwise the latest submitted revision. */
  form: TrainingRequestDraft;
  timeline: TrainingRequestTimelineEvent[];
  revisionNote: string | null;
  revisionCount: number;
  canWithdraw: boolean;
  canRevise: boolean;
};

type SubjectRow = {
  id: string;
  title: string;
  current_status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};
type RevisionRow = { subject_id: string; revision: number; submitted_at: string; snapshot: { payload?: unknown } | null };
type DraftRow = { id: string; linked_subject_id: string; payload: unknown };
type DecisionRow = { id: string; subject_id: string; decision: string; rationale: string | null; decided_at: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function loadRequests(db: Db, userId: string, subjectId?: string) {
  let query = db
    .from("review_subjects")
    .select("id, title, current_status, metadata, created_at, updated_at")
    .eq("kind", "training_need")
    .eq("submitted_by", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (subjectId) query = query.eq("id", subjectId);
  const { data: subjects, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (subjects ?? []) as SubjectRow[];
  const ids = rows.map((s) => s.id);
  if (!ids.length) return { rows, revisions: [], drafts: [], history: [], decisions: [], policies: [] };

  const [revisions, drafts, history, decisions, policies] = await Promise.all([
    db
      .from("review_subject_revisions")
      .select("subject_id, revision, submitted_at, snapshot")
      .in("subject_id", ids)
      .order("revision", { ascending: true }),
    db
      .from("review_drafts")
      .select("id, linked_subject_id, payload")
      .in("linked_subject_id", ids)
      .eq("submitter_id", userId)
      .eq("status", "draft"),
    db
      .from("review_subject_status_history")
      .select("id, subject_id, from_status, to_status, changed_at, is_backfill")
      .in("subject_id", ids)
      .order("changed_at", { ascending: true }),
    subjectId
      ? db
          .from("review_decisions")
          .select("id, subject_id, decision, rationale, decided_at")
          .in("subject_id", ids)
          .order("decided_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    db
      .from("workflow_sla_policies")
      .select("subject_kind, status, target_hours, responsible_label, is_active")
      .eq("subject_kind", "training_need"),
  ]);
  for (const res of [revisions, drafts, decisions]) {
    if (res.error) throw new Error(res.error.message);
  }
  // Status history and SLA come from migration 20261021110000. On a database that
  // has not run it yet the requests still list, only without history and SLA.
  return {
    rows,
    revisions: (revisions.data ?? []) as RevisionRow[],
    drafts: (drafts.data ?? []) as DraftRow[],
    history: (history.error ? [] : (history.data ?? [])) as StatusHistoryRow[],
    decisions: (decisions.data ?? []) as DecisionRow[],
    policies: (policies.error ? [] : (policies.data ?? [])) as SlaPolicy[],
  };
}

function summarize(
  s: SubjectRow,
  data: Awaited<ReturnType<typeof loadRequests>>,
  policies: ReturnType<typeof indexSlaPolicies>,
) {
  const revisions = data.revisions.filter((r) => r.subject_id === s.id);
  const latest = revisions[revisions.length - 1];
  const draft = data.drafts.find((d) => d.linked_subject_id === s.id);
  const history = data.history.filter((h) => h.subject_id === s.id);
  const form = payloadToRequestForm(draft?.payload ?? latest?.snapshot?.payload);
  const stage = computeStage({
    kind: "training_need",
    status: s.current_status,
    createdAt: s.created_at,
    history,
    latestRevisionAt: latest?.submitted_at ?? null,
    hasOpenRevisionDraft: Boolean(draft),
    policies,
  });
  const summary: MyTrainingRequestSummary = {
    id: s.id,
    reference: trainingRequestReference(s.id, s.created_at),
    title: form.trainingTopic || s.title,
    category: form.trainingCategory,
    organization: form.organization,
    country: form.country,
    submittedAt: revisions[0]?.submitted_at ?? s.created_at,
    updatedAt: s.updated_at,
    stage,
  };
  return { summary, revisions, history, draft, form };
}

export const listMyTrainingRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyTrainingRequestSummary[]> => {
    const data = await loadRequests(context.supabase, context.userId);
    const policies = indexSlaPolicies(data.policies);
    return data.rows.map((s) => summarize(s, data, policies).summary);
  });

const HISTORY_EVENT: Record<string, TrainingRequestTimelineEvent["kind"] | undefined> = {
  under_review: "review_started",
  decision_pending: "review_completed",
  withdrawn: "withdrawn",
  archived: "archived",
};
const DECISION_EVENT: Record<string, TrainingRequestTimelineEvent["kind"] | undefined> = {
  approve: "approved",
  reject: "rejected",
  return_for_revision: "revision_requested",
};

export const getMyTrainingRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data: input, context }): Promise<MyTrainingRequestDetail | null> => {
    const data = await loadRequests(context.supabase, context.userId, input.id);
    const subject = data.rows[0];
    if (!subject) return null;
    const { summary, revisions, history, draft, form } = summarize(subject, data, indexSlaPolicies(data.policies));
    const meta = subject.metadata ?? {};
    const withdrawnReason = typeof meta.withdrawn_reason === "string" ? meta.withdrawn_reason : null;

    const timeline: TrainingRequestTimelineEvent[] = [
      ...revisions.map((r) => ({
        id: `rev-${r.revision}`,
        at: r.submitted_at,
        kind: (r.revision === 1 ? "submitted" : "resubmitted") as TrainingRequestTimelineEvent["kind"],
        note: null,
        revision: r.revision,
      })),
      ...history.flatMap((h) => {
        const kind = HISTORY_EVENT[h.to_status];
        return kind
          ? [{ id: `st-${h.id}`, at: h.changed_at, kind, note: kind === "withdrawn" ? withdrawnReason : null }]
          : [];
      }),
      ...data.decisions.flatMap((d) => {
        const kind = DECISION_EVENT[d.decision];
        return kind ? [{ id: `dec-${d.id}`, at: d.decided_at, kind, note: d.rationale?.trim() || null }] : [];
      }),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    const lastReturn = [...data.decisions].reverse().find((d) => d.decision === "return_for_revision");
    return {
      ...summary,
      form,
      timeline,
      revisionNote: summary.stage.key === "revision_requested" ? (lastReturn?.rationale?.trim() ?? null) : null,
      revisionCount: revisions.length,
      canWithdraw: isOpenStatus(subject.current_status),
      canRevise: Boolean(draft) && subject.current_status === "pending",
    };
  });

const WITHDRAW_ERRORS: Record<string, string> = {
  subject_not_found: "Training request not found.",
  not_withdrawable: "This request has already been decided or withdrawn.",
  reason_too_long: "The reason can be at most 1,000 characters.",
};

export const withdrawMyTrainingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({ id: z.string().uuid(), reason: z.string().trim().max(1000).optional().default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any).rpc("training_need_withdraw", {
      _subject_id: data.id,
      _reason: data.reason || null,
    });
    if (error) throw new Error(WITHDRAW_ERRORS[error.message] ?? error.message);
    return { ok: true };
  });
