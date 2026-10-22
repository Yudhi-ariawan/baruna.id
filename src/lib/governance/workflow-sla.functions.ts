// ============================================================================
// Workflow SLA & status history in the curation console (Slide 13)
// ----------------------------------------------------------------------------
// Reads use the caller's own client: RLS on review_subject_status_history /
// review_subjects decides what each console role sees (admin & approver: all;
// reviewer: the subjects assigned to them). SLA targets are changed only
// through set_workflow_sla_policy, which checks the administrator role itself
// and writes the audit trail (migration 20261021110000).
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getGovernanceRoles, hasGovernanceRole } from "./governance-roles";
import {
  computeStage,
  indexSlaPolicies,
  type SlaPolicy,
  type StatusHistoryRow,
  type WorkflowStage,
} from "@/lib/training-requests/workflow";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function assertConsoleReader(context: { supabase: Db; userId: string }) {
  if ((await getGovernanceRoles(context)).length === 0) {
    throw new Error("forbidden: hanya peran kurasi yang dapat membuka data ini.");
  }
}

export const listSlaPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ policies: SlaPolicy[]; canEdit: boolean }> => {
    const db = context.supabase as Db;
    const [{ data, error }, canEdit] = await Promise.all([
      db
        .from("workflow_sla_policies")
        .select("subject_kind, status, target_hours, responsible_label, is_active, updated_at")
        .order("subject_kind")
        .order("status"),
      hasGovernanceRole(db, context.userId, "admin"),
    ]);
    if (error) throw new Error(error.message);
    return { policies: (data ?? []) as SlaPolicy[], canEdit };
  });

const SLA_ERRORS: Record<string, string> = {
  forbidden: "Hanya Administrator yang dapat mengubah SLA.",
  invalid_target_hours: "Target harus antara 1 dan 8.760 jam.",
  invalid_responsible_label: "Penanggung jawab wajib diisi (maksimal 120 karakter).",
  invalid_subject_kind: "Jenis pengajuan tidak dikenal.",
  invalid_status: "Langkah tidak dikenal.",
};

export const updateSlaPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        subjectKind: z.enum(["expert", "module", "knowledge_resource", "training_need"]),
        status: z.enum(["pending", "under_review", "decision_pending"]),
        targetHours: z.number().int().min(1).max(8760),
        responsibleLabel: z.string().trim().min(1).max(120),
        isActive: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as Db).rpc("set_workflow_sla_policy", {
      _subject_kind: data.subjectKind,
      _status: data.status,
      _target_hours: data.targetHours,
      _responsible_label: data.responsibleLabel,
      _is_active: data.isActive,
    });
    if (error) throw new Error(SLA_ERRORS[error.message] ?? error.message);
    return { ok: true };
  });

/** Current stage and SLA of every Request a Training submission the caller may see. */
export const listTrainingNeedStages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, WorkflowStage>> => {
    await assertConsoleReader(context);
    const db = context.supabase as Db;
    const { data: subjects, error } = await db
      .from("review_subjects")
      .select("id, current_status, created_at")
      .eq("kind", "training_need")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const list = (subjects ?? []) as Array<{ id: string; current_status: string; created_at: string }>;
    if (!list.length) return {};
    const ids = list.map((s) => s.id);

    const [history, revisions, drafts, policies] = await Promise.all([
      db
        .from("review_subject_status_history")
        .select("id, subject_id, from_status, to_status, changed_at, is_backfill")
        .in("subject_id", ids),
      db.from("review_subject_revisions").select("subject_id, revision, submitted_at").in("subject_id", ids),
      db.from("review_drafts").select("linked_subject_id").in("linked_subject_id", ids).eq("status", "draft"),
      db.from("workflow_sla_policies").select("subject_kind, status, target_hours, responsible_label, is_active"),
    ]);
    for (const res of [history, revisions, drafts, policies]) {
      if (res.error) throw new Error(res.error.message);
    }
    const active = indexSlaPolicies((policies.data ?? []) as SlaPolicy[]);
    const openDraft = new Set(((drafts.data ?? []) as Array<{ linked_subject_id: string }>).map((d) => d.linked_subject_id));
    const latestRevAt = new Map<string, { revision: number; at: string }>();
    for (const r of (revisions.data ?? []) as Array<{ subject_id: string; revision: number; submitted_at: string }>) {
      const prev = latestRevAt.get(r.subject_id);
      if (!prev || r.revision > prev.revision) latestRevAt.set(r.subject_id, { revision: r.revision, at: r.submitted_at });
    }
    const rows = (history.data ?? []) as StatusHistoryRow[];

    return Object.fromEntries(
      list.map((s) => [
        s.id,
        computeStage({
          kind: "training_need",
          status: s.current_status,
          createdAt: s.created_at,
          history: rows.filter((h) => h.subject_id === s.id),
          latestRevisionAt: latestRevAt.get(s.id)?.at ?? null,
          hasOpenRevisionDraft: openDraft.has(s.id),
          policies: active,
        }),
      ]),
    );
  });

/** Status history of one submission (any kind), for the console subject page. */
export const getSubjectStatusHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ subjectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<StatusHistoryRow[]> => {
    await assertConsoleReader(context);
    const { data: rows, error } = await (context.supabase as Db)
      .from("review_subject_status_history")
      .select("id, subject_id, from_status, to_status, changed_at, is_backfill")
      .eq("subject_id", data.subjectId)
      .order("changed_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as StatusHistoryRow[];
  });
