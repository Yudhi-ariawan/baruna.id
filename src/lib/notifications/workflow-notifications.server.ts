// ============================================================================
// Workflow notifications (Slide 13: notifikasi di setiap perubahan status,
// SLA per langkah) — server only.
// ----------------------------------------------------------------------------
// Derived on read from database records, like the other notification sources:
//   * submitter   — every status step recorded in review_subject_status_history
//                   (decisions themselves come from review_decisions);
//   * reviewer    — each active review assignment, and when its due time passes;
//   * admin / approver — Request a Training items waiting for them, and steps
//                   past their SLA (workflow_sla_policies).
// Ids are stable per event, so read markers in notification_reads keep working.
// ============================================================================
import type { InAppNotification } from "./notifications.functions";
import {
  computeStage,
  formatHoursId,
  indexSlaPolicies,
  slaKey,
  type SlaPolicy,
  type StatusHistoryRow,
} from "@/lib/training-requests/workflow";

export type WorkflowNotif = InAppNotification & { subjectId: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const SUBJECT_KINDS = ["expert", "module", "knowledge_resource", "training_need"] as const;
const asKind = (kind: string): InAppNotification["subjectKind"] =>
  (SUBJECT_KINDS as readonly string[]).includes(kind) ? (kind as InAppNotification["subjectKind"]) : "other";

/** Where the submitter follows a submission of this kind. */
export function submitterUrl(kind: string, subjectId: string): string {
  switch (kind) {
    case "training_need":
      return `/academy/training-requests/${subjectId}`;
    case "module":
      return "/experts/portal/review-status";
    case "expert":
      return "/experts/join";
    default:
      return "/knowledge-hub/my-contributions";
  }
}

const KIND_NOUN: Record<string, string> = {
  training_need: "Permintaan pelatihan",
  module: "Modul",
  expert: "Pengajuan expert",
  knowledge_resource: "Publikasi",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

async function loadPolicies(db: Db): Promise<SlaPolicy[]> {
  const { data } = await db
    .from("workflow_sla_policies")
    .select("subject_kind, status, target_hours, responsible_label, is_active");
  return (data ?? []) as SlaPolicy[];
}

/** Status steps of the user's own submissions (all kinds). */
export async function buildStatusStepNotifications(userId: string): Promise<WorkflowNotif[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as Db;
  const { data: subjects } = await db
    .from("review_subjects")
    .select("id, kind, title")
    .eq("submitted_by", userId)
    .order("updated_at", { ascending: false })
    .limit(200);
  const byId = new Map<string, { id: string; kind: string; title: string }>(
    (subjects ?? []).map((s: { id: string; kind: string; title: string }) => [s.id, s]),
  );
  if (!byId.size) return [];

  const { data: rows } = await db
    .from("review_subject_status_history")
    .select("id, subject_id, to_status, changed_at, changed_by")
    .in("subject_id", Array.from(byId.keys()))
    .in("to_status", ["under_review", "decision_pending"])
    .eq("is_backfill", false)
    .order("changed_at", { ascending: false })
    .limit(200);

  return ((rows ?? []) as Array<StatusHistoryRow & { changed_by: string | null }>)
    .filter((r) => r.changed_by !== userId)
    .flatMap((r) => {
      const s = byId.get(r.subject_id);
      if (!s) return [];
      const noun = KIND_NOUN[s.kind] ?? "Pengajuan";
      const started = r.to_status === "under_review";
      return [
        {
          id: `st-${r.id}`,
          subjectId: s.id,
          type: "info" as const,
          title: started ? `${noun} mulai direview: "${s.title}"` : `Review selesai, menunggu keputusan: "${s.title}"`,
          body: started
            ? "Tim BARUNA telah menugaskan reviewer untuk pengajuan Anda."
            : "Rekomendasi reviewer sudah masuk. Pengajuan Anda menunggu keputusan akhir.",
          subjectKind: asKind(s.kind),
          subjectTitle: s.title,
          targetUrl: submitterUrl(s.kind, s.id),
          createdAt: r.changed_at,
          actorName: "Tim BARUNA",
        },
      ];
    });
}

/** Active review assignments of the user, and assignments past their due time. */
export async function buildReviewerAssignmentNotifications(userId: string): Promise<WorkflowNotif[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as Db;
  const { data: assignments } = await db
    .from("review_assignments")
    .select("id, subject_id, assigned_at, due_at, review_subjects(id, kind, title, current_status)")
    .eq("reviewer_id", userId)
    .eq("status", "active")
    .order("assigned_at", { ascending: false })
    .limit(100);
  type Row = {
    id: string;
    subject_id: string;
    assigned_at: string;
    due_at: string | null;
    review_subjects: { id: string; kind: string; title: string; current_status: string } | null;
  };
  const rows = ((assignments ?? []) as Row[]).filter(
    (a) => a.review_subjects && ["pending", "under_review"].includes(a.review_subjects.current_status),
  );
  if (!rows.length) return [];

  const [policies, records] = await Promise.all([
    loadPolicies(db),
    db
      .from("review_records")
      .select("subject_id")
      .eq("reviewer_id", userId)
      .eq("status", "submitted")
      .in("subject_id", rows.map((a) => a.subject_id)),
  ]);
  const active = indexSlaPolicies(policies);
  const reviewed = new Set(((records.data ?? []) as Array<{ subject_id: string }>).map((r) => r.subject_id));
  const now = Date.now();

  return rows.flatMap((a) => {
    const s = a.review_subjects!;
    const policy = active.get(slaKey(s.kind, "under_review"));
    const dueAt =
      a.due_at ??
      (policy ? new Date(new Date(a.assigned_at).getTime() + policy.target_hours * 3_600_000).toISOString() : null);
    const base = {
      subjectId: `asg-${a.id}`,
      subjectKind: asKind(s.kind),
      subjectTitle: s.title,
      targetUrl: `/governance/subject/${s.id}`,
      actorName: "Tim Administrator BARUNA",
    };
    const out: WorkflowNotif[] = [
      {
        ...base,
        id: `asg-${a.id}`,
        type: "revision_requested",
        title: `Anda ditugaskan mereview: "${s.title}"`,
        body: `${KIND_NOUN[s.kind] ?? "Pengajuan"} menunggu rekomendasi Anda.${dueAt ? ` Batas waktu: ${fmt(dueAt)}.` : ""}`,
        createdAt: a.assigned_at,
      },
    ];
    if (dueAt && !reviewed.has(s.id) && new Date(dueAt).getTime() < now) {
      out.push({
        ...base,
        id: `asg-sla-${a.id}-${dueAt}`,
        type: "revision_requested",
        title: `Batas waktu review terlewati: "${s.title}"`,
        body: `Rekomendasi belum dikirim. Batas waktu ${fmt(dueAt)}.`,
        createdAt: dueAt,
      });
    }
    return out;
  });
}

/** Request a Training items waiting for admin / approver, and steps past their SLA. */
export async function buildTrainingNeedStaffNotifications(userId: string): Promise<WorkflowNotif[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as Db;
  const { data: subjects } = await db
    .from("review_subjects")
    .select("id, title, current_status, submitted_by, created_at")
    .eq("kind", "training_need")
    .in("current_status", ["pending", "under_review", "decision_pending"])
    .neq("submitted_by", userId)
    .order("updated_at", { ascending: false })
    .limit(200);
  type Subject = { id: string; title: string; current_status: string; created_at: string };
  const list = (subjects ?? []) as Subject[];
  if (!list.length) return [];
  const ids = list.map((s) => s.id);

  const [history, revisions, drafts, policies] = await Promise.all([
    db
      .from("review_subject_status_history")
      .select("id, subject_id, from_status, to_status, changed_at, is_backfill")
      .in("subject_id", ids),
    db.from("review_subject_revisions").select("subject_id, revision, submitted_at").in("subject_id", ids),
    db.from("review_drafts").select("linked_subject_id").in("linked_subject_id", ids).eq("status", "draft"),
    loadPolicies(db),
  ]);
  const active = indexSlaPolicies(policies);
  const openDraft = new Set(((drafts.data ?? []) as Array<{ linked_subject_id: string }>).map((d) => d.linked_subject_id));
  const latestRev = new Map<string, { revision: number; submitted_at: string }>();
  for (const r of (revisions.data ?? []) as Array<{ subject_id: string; revision: number; submitted_at: string }>) {
    const prev = latestRev.get(r.subject_id);
    if (!prev || r.revision > prev.revision) latestRev.set(r.subject_id, r);
  }
  const historyRows = (history.data ?? []) as StatusHistoryRow[];

  return list.flatMap((s) => {
    const rev = latestRev.get(s.id);
    const stage = computeStage({
      kind: "training_need",
      status: s.current_status,
      createdAt: s.created_at,
      history: historyRows.filter((h) => h.subject_id === s.id),
      latestRevisionAt: rev?.submitted_at ?? null,
      hasOpenRevisionDraft: openDraft.has(s.id),
      policies: active,
    });
    if (!stage.open) return [];
    const base = {
      subjectId: `tn-staff-${s.id}`,
      subjectKind: "training_need" as const,
      subjectTitle: s.title,
      targetUrl: `/governance/subjects/${s.id}`,
      actorName: "Sistem BARUNA",
    };
    const out: WorkflowNotif[] = [];
    if (stage.key === "pending") {
      const resubmitted = (rev?.revision ?? 1) > 1;
      out.push({
        ...base,
        id: `tn-new-${s.id}-r${rev?.revision ?? 1}`,
        type: "revision_requested",
        title: resubmitted
          ? `Revisi permintaan pelatihan masuk: "${s.title}"`
          : `Permintaan pelatihan baru: "${s.title}"`,
        body: "Cek kelengkapan lalu tugaskan reviewer.",
        createdAt: stage.since,
      });
    } else if (stage.key === "decision_pending") {
      out.push({
        ...base,
        id: `tn-decide-${s.id}-${stage.since}`,
        type: "revision_requested",
        title: `Permintaan pelatihan menunggu keputusan: "${s.title}"`,
        body: "Rekomendasi reviewer sudah lengkap. Mohon berikan keputusan akhir.",
        createdAt: stage.since,
      });
    }
    if (stage.sla?.overdue) {
      out.push({
        ...base,
        id: `tn-sla-${s.id}-${s.current_status}-${stage.since}`,
        type: "revision_requested",
        title: `Melewati SLA (${formatHoursId(stage.sla.targetHours)}): "${s.title}"`,
        body: `Tahap ini menjadi tanggung jawab ${stage.sla.responsible}. Batas waktu ${fmt(stage.sla.dueAt)}.`,
        createdAt: stage.sla.dueAt,
      });
    }
    return out;
  });
}
