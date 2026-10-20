// ============================================================================
// BARUNA Governance Review Foundation — Server functions (Phase 1.1)
// ----------------------------------------------------------------------------
// Institutional QA review layer. Reviewers issue recommendations only; final
// decisions are recorded by admin/management. All privileged writes (roles,
// audit log) go through the service-role client after in-handler role checks.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { getGovernanceRoles } from "./governance-roles";


const Recommendation = z.enum(["approve", "reject", "request_changes"]);
const Decision = z.enum(["approve", "reject", "return_for_revision"]);
const SubjectKind = z.enum(["expert", "module", "knowledge_resource", "training_need"]);

async function assertRole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: { supabase: any; userId: string },
  role: "admin" | "management" | "qa_reviewer",
) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: role,
  });
  if (error) throw new Error((error as { message?: string }).message ?? "role_check_failed");
  return Boolean(data);
}

// ─── Role queries ──────────────────────────────────────────────────────────
// Same rule as the database (public.has_role → rbac_user_roles), not the legacy
// user_roles table, so the page never shows access the database would refuse.
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => getGovernanceRoles(context));

export const getModuleReviewPacket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ subjectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_any_governance_role", { _user_id: context.userId });
    if (roleError || !allowed) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: revision, error } = await supabaseAdmin.from("review_subject_revisions")
      .select("revision, snapshot, submitted_at").eq("subject_id", data.subjectId)
      .order("revision", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (!revision) return null;
    const snapshot = revision.snapshot as { payload?: Record<string, Json> };
    const payload = snapshot.payload ?? {};
    const meta = (payload.metadata as Record<string, unknown>) ?? {};
    const raw = Array.isArray(payload.attachments)
      ? payload.attachments
      : Array.isArray(meta.attached_resources)
        ? (meta.attached_resources as unknown[])
        : Array.isArray(payload.documents)
          ? payload.documents
          : [];

    const attachments = await Promise.all(
      raw.map(async (item) => {
        const file = item as {
          category?: string;
          name?: string;
          fileName?: string;
          size?: number;
          fileSize?: number;
          type?: string;
          fileType?: string;
          path?: string;
          bucket?: string;
        };
        if (!file.path) return null;

        const targetBucket =
          file.bucket ||
          (file.path.includes("/modules/") ? "module-attachments" : "expert-applications");
        const fileName = file.fileName || file.name || "Attachment";

        let [preview, download] = await Promise.all([
          supabaseAdmin.storage.from(targetBucket).createSignedUrl(file.path, 900),
          supabaseAdmin.storage
            .from(targetBucket)
            .createSignedUrl(file.path, 900, { download: fileName }),
        ]);

        if ((preview.error || download.error) && targetBucket === "module-attachments") {
          const [fbPreview, fbDownload] = await Promise.all([
            supabaseAdmin.storage.from("expert-applications").createSignedUrl(file.path, 900),
            supabaseAdmin.storage
              .from("expert-applications")
              .createSignedUrl(file.path, 900, { download: fileName }),
          ]);
          if (!fbPreview.error) {
            preview = fbPreview;
            download = fbDownload;
          }
        }

        if (preview.error || !preview.data?.signedUrl) return null;

        return {
          category: file.category ?? "attachment",
          name: fileName,
          size: file.size || file.fileSize || 0,
          type: file.type || file.fileType || "application/octet-stream",
          path: file.path,
          signedUrl: preview.data.signedUrl,
          downloadUrl: download.data?.signedUrl ?? preview.data.signedUrl,
        };
      }),
    );
    return { revision: revision.revision, submittedAt: revision.submitted_at, payload, attachments: attachments.filter((file): file is NonNullable<typeof file> => Boolean(file)) };
  });

// ─── Reviewer queue ────────────────────────────────────────────────────────
export const listMyReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("review_assignments")
      .select(
        "id, subject_id, status, due_at, assigned_at, conflict_of_interest_declared, conflict_of_interest_reason, review_subjects(id, kind, title, current_status, submitted_by)",
      )
      .eq("reviewer_id", context.userId)
      .in("status", ["active", "recused"])
      .order("assigned_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listManualModuleReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_any_governance_role", { _user_id: context.userId });
    if (roleError || !allowed) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("review_subjects")
      .select("id,title,current_status,required_recommendations,updated_at,review_records(id,status)")
      .eq("kind", "module").in("current_status", ["pending", "under_review", "decision_pending"])
      .order("updated_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({ id: row.id, title: row.title, current_status: row.current_status, required_recommendations: row.required_recommendations, updated_at: row.updated_at, submitted_recommendations: row.review_records.filter((record) => record.status === "submitted").length }));
  });

export const getReviewSubject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: subject, error } = await context.supabase
      .from("review_subjects")
      .select("id, kind, external_ref, title, description, submitted_by, current_status, required_recommendations, metadata, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!subject) return null;

    const { data: assignment } = await context.supabase
      .from("review_assignments")
      .select("id, status, due_at, conflict_of_interest_declared, conflict_of_interest_reason, conflict_declared_at, template_version_id")
      .eq("subject_id", data.id)
      .eq("reviewer_id", context.userId)
      .maybeSingle();

    const { data: myRecord } = await context.supabase
      .from("review_records")
      .select("id, recommendation, rationale, criteria, status, submitted_at, updated_at")
      .eq("subject_id", data.id)
      .eq("reviewer_id", context.userId)
      .in("status", ["draft", "submitted"])
      .maybeSingle();

    return { subject, assignment: assignment ?? null, myRecord: myRecord ?? null };
  });

// ─── Draft / submit / withdraw ─────────────────────────────────────────────
export const saveReviewDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        subjectId: z.string().uuid(),
        assignmentId: z.string().uuid(),
        recommendation: Recommendation,
        rationale: z.string().max(5000).optional(),
        criteria: z.record(z.unknown()).default({}),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("review_records")
      .select("id, status")
      .eq("subject_id", data.subjectId)
      .eq("reviewer_id", context.userId)
      .in("status", ["draft", "submitted"])
      .maybeSingle();

    if (existing && existing.status === "submitted") {
      throw new Error("record_already_submitted");
    }

    if (existing) {
      const { data: updated, error } = await context.supabase
        .from("review_records")
        .update({
          recommendation: data.recommendation,
          rationale: data.rationale ?? null,
          criteria: data.criteria as never,
        })
        .eq("id", existing.id)
        .select("id, status")
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }
    const { data: created, error } = await context.supabase
      .from("review_records")
      .insert({
        subject_id: data.subjectId,
        reviewer_id: context.userId,
        assignment_id: data.assignmentId,
        recommendation: data.recommendation,
        rationale: data.rationale ?? null,
        criteria: data.criteria as never,
        status: "draft",
      })
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const submitReviewRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ recordId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Atomic RPC re-validates ownership, assignment status, COI, and criteria
    // against the assignment's template version schema. It also emits the
    // review_submitted audit entry.
    const { error } = await context.supabase.rpc("submit_review_recommendation", {
      _record_id: data.recordId,
    });
    if (error) throw new Error(error.message);

    const { data: rec } = await context.supabase
      .from("review_records")
      .select("id, subject_id, status")
      .eq("id", data.recordId)
      .maybeSingle();
    if (!rec) return { id: data.recordId, subject_id: null, status: "submitted" };

    const { data: subject } = await context.supabase
      .from("review_subjects")
      .select("id, required_recommendations, current_status")
      .eq("id", rec.subject_id)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("review_records")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", rec.subject_id)
      .eq("status", "submitted");

    const required = subject?.required_recommendations ?? 1;
    if (subject && (count ?? 0) >= required && subject.current_status === "under_review") {
      await supabaseAdmin
        .from("review_subjects")
        .update({ current_status: "decision_pending" })
        .eq("id", rec.subject_id);
    }
    return rec;
  });

export const withdrawReviewRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ recordId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rec, error } = await context.supabase
      .from("review_records")
      .update({ status: "withdrawn" })
      .eq("id", data.recordId)
      .eq("reviewer_id", context.userId)
      .select("id, subject_id, status")
      .single();
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("log_governance_event", {
      _event_type: "review_withdrawn",
      _actor_id: context.userId,
      _subject_id: rec.subject_id,
      _entity_type: "review_record",
      _entity_id: rec.id,
      _before: null,
      _after: null,
    });
    return rec;
  });

// ─── Conflict of interest ──────────────────────────────────────────────────
export const declareConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        assignmentId: z.string().uuid(),
        reason: z.string().min(1).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("review_assignments")
      .update({
        conflict_of_interest_declared: true,
        conflict_of_interest_reason: data.reason,
        conflict_declared_at: new Date().toISOString(),
        status: "recused",
      })
      .eq("id", data.assignmentId)
      .eq("reviewer_id", context.userId)
      .select("id, subject_id, status")
      .single();
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("log_governance_event", {
      _event_type: "conflict_declared",
      _actor_id: context.userId,
      _subject_id: updated.subject_id,
      _entity_type: "review_assignment",
      _entity_id: updated.id,
      _before: null,
      _after: { reason: data.reason },
    });
    return updated;
  });

// ─── Admin / management ────────────────────────────────────────────────────
export const listPendingDecisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await assertRole(context, "admin")) && !(await assertRole(context, "management"))) {
      throw new Error("forbidden");
    }
    const { data, error } = await context.supabase
      .from("review_subjects")
      .select("id, kind, title, current_status, submitted_by, created_at")
      .in("current_status", ["decision_pending", "under_review", "pending"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listSubmittedRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ subjectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await assertRole(context, "admin")) && !(await assertRole(context, "management"))) {
      throw new Error("forbidden");
    }
    const { data: rows, error } = await context.supabase
      .from("review_records")
      .select("id, reviewer_id, recommendation, rationale, criteria, submitted_at")
      .eq("subject_id", data.subjectId)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Final decision on a Request a Training submission (Slide 12). Expert, module
// and Knowledge Hub submissions are decided through their own verification
// RPCs; finalize_decision / return_for_revision refuse those kinds in the
// database (migration 20261020070000), and this function refuses them first.
export const recordFinalDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        subjectId: z.string().uuid(),
        decision: Decision,
        rationale: z.string().trim().min(1, "Alasan keputusan wajib diisi.").max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Rights first (same rule as the console menu), then the submission.
    if (!(await assertRole(context, "admin")) && !(await assertRole(context, "management"))) {
      throw new Error("forbidden: hanya Approver atau Administrator yang dapat memutuskan permintaan pelatihan.");
    }
    const { data: subject, error: subjectError } = await context.supabase
      .from("review_subjects")
      .select("id, kind")
      .eq("id", data.subjectId)
      .maybeSingle();
    if (subjectError) throw new Error(subjectError.message);
    if (!subject) throw new Error("Pengajuan tidak ditemukan.");
    if (subject.kind !== "training_need") {
      throw new Error(
        "Pengajuan expert, modul, dan publikasi diputuskan lewat menu Verifikasi masing-masing di Konsol Kurasi.",
      );
    }
    const { data: id, error } =
      data.decision === "return_for_revision"
        ? await context.supabase.rpc("return_for_revision", { _subject_id: data.subjectId, _rationale: data.rationale })
        : await context.supabase.rpc("finalize_decision", {
            _subject_id: data.subjectId,
            _decision: data.decision,
            _rationale: data.rationale,
          });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });


// ─── Subject creation (admin/management) ───────────────────────────────────
export const createReviewSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        kind: SubjectKind,
        title: z.string().min(1).max(200),
        description: z.string().max(5000).optional(),
        externalRef: z.string().max(200).optional(),
        submittedBy: z.string().uuid(),
        requiredRecommendations: z.number().int().min(1).max(10).default(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await assertRole(context, "admin")) && !(await assertRole(context, "management"))) {
      throw new Error("forbidden");
    }
    const { data: created, error } = await context.supabase
      .from("review_subjects")
      .insert({
        kind: data.kind,
        title: data.title,
        description: data.description ?? null,
        external_ref: data.externalRef ?? null,
        submitted_by: data.submittedBy,
        required_recommendations: data.requiredRecommendations,
      })
      .select("id, current_status")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const assignReviewer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        subjectId: z.string().uuid(),
        reviewerId: z.string().uuid(),
        dueAt: z.string().datetime().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await assertRole(context, "admin")) && !(await assertRole(context, "management"))) {
      throw new Error("forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Reviewer must have qa_reviewer role
    const { data: hasRole } = await supabaseAdmin.rpc("has_role", {
      _user_id: data.reviewerId,
      _role: "qa_reviewer",
    });
    if (!hasRole) throw new Error("reviewer_not_qualified");

    // Subject submitter cannot equal reviewer
    const { data: subject } = await supabaseAdmin
      .from("review_subjects")
      .select("id, submitted_by, current_status")
      .eq("id", data.subjectId)
      .maybeSingle();
    if (!subject) throw new Error("subject_not_found");
    if (subject.submitted_by === data.reviewerId) throw new Error("self_review_forbidden");

    const { data: created, error } = await context.supabase
      .from("review_assignments")
      .insert({
        subject_id: data.subjectId,
        reviewer_id: data.reviewerId,
        assigned_by: context.userId,
        due_at: data.dueAt ?? null,
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (subject.current_status === "pending") {
      await supabaseAdmin.from("review_subjects").update({ current_status: "under_review" }).eq("id", data.subjectId);
    }
    await supabaseAdmin.rpc("log_governance_event", {
      _event_type: "reviewer_assigned",
      _actor_id: context.userId,
      _subject_id: data.subjectId,
      _entity_type: "review_assignment",
      _entity_id: created.id,
      _before: null,
      _after: { reviewer_id: data.reviewerId },
    });
    return created;
  });

// ─── Audit trail (admin/management) ────────────────────────────────────────
export const listGovernanceAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ subjectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await assertRole(context, "admin")) && !(await assertRole(context, "management"))) {
      throw new Error("forbidden");
    }
    const { data: rows, error } = await context.supabase
      .from("governance_audit_log")
      .select("id, event_type, actor_id, entity_type, entity_id, before, after, created_at")
      .eq("subject_id", data.subjectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const exportGovernanceAuditCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        subjectId: z.string().uuid().optional(),
        eventType: z.string().max(100).optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(50000).default(5000),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    // Delegates to export_governance_audit_csv RPC. The RPC enforces the
    // admin/management gate, neutralises CSV formula injection, RFC4180
    // quotes fields, and logs the export in the audit trail itself.
    const args: Record<string, unknown> = { _limit: data.limit };
    if (data.subjectId) args._subject_id = data.subjectId;
    if (data.eventType) args._event_type = data.eventType;
    if (data.from) args._from = data.from;
    if (data.to) args._to = data.to;
    const { data: csv, error } = await context.supabase.rpc(
      "export_governance_audit_csv",
      args as never,
    );
    if (error) throw new Error(error.message);
    return { csv: (csv as string) ?? "" };
  });

