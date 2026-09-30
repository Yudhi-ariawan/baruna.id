// ============================================================================
// BARUNA Governance Operations — Phase 1.2 server functions
// ----------------------------------------------------------------------------
// Submitter-facing draft CRUD + submit-for-review RPC wrapper. All privileged
// state transitions are executed by the atomic SECURITY DEFINER RPCs created
// in the Phase 1.2 schema migration; TypeScript checks are defence-in-depth.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseCtx = any;

const SubjectKind = z.enum(["expert", "module", "knowledge_resource", "training_need"]);

// ─── Submitter drafts ──────────────────────────────────────────────────────
export const listMyDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("review_drafts")
      .select(
        "id, subject_kind, title, description, external_ref, status, linked_subject_id, created_at, updated_at",
      )
      .eq("submitter_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: draft, error } = await context.supabase
      .from("review_drafts")
      .select(
        "id, subject_kind, title, description, external_ref, payload, status, linked_subject_id, content_hash, created_at, updated_at",
      )
      .eq("id", data.id)
      .eq("submitter_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!draft) return null;

    type SubjectRow = {
      id: string;
      kind: string;
      title: string;
      current_status: string;
      required_recommendations: number;
      created_at: string;
    } | null;
    type RevisionRow = {
      id: string;
      revision: number;
      content_hash: string;
      submitted_at: string;
    };
    let subject: SubjectRow = null;
    let revisions: RevisionRow[] = [];
    if (draft.linked_subject_id) {
      const { data: s } = await context.supabase
        .from("review_subjects")
        .select("id, kind, title, current_status, required_recommendations, created_at")
        .eq("id", draft.linked_subject_id)
        .maybeSingle();
      subject = (s as SubjectRow) ?? null;
      const { data: revs } = await context.supabase
        .from("review_subject_revisions")
        .select("id, revision, content_hash, submitted_at")
        .eq("subject_id", draft.linked_subject_id)
        .order("revision", { ascending: false });
      revisions = (revs as RevisionRow[] | null) ?? [];
    }
    return { draft, subject, revisions };
  });

export const saveMyDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        subjectKind: SubjectKind,
        title: z.string().min(1).max(200),
        description: z.string().max(5000).optional(),
        externalRef: z.string().max(200).optional(),
        payload: z.record(z.unknown()).default({}),
        linkedSubjectId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: existing, error: readErr } = await context.supabase
        .from("review_drafts")
        .select("id, status")
        .eq("id", data.id)
        .eq("submitter_id", context.userId)
        .maybeSingle();
      if (readErr) throw new Error(readErr.message);
      if (!existing) throw new Error("not_owner");
      if (existing.status !== "draft") throw new Error("draft_already_submitted");

      const { data: updated, error } = await context.supabase
        .from("review_drafts")
        .update({
          subject_kind: data.subjectKind,
          title: data.title,
          description: data.description ?? null,
          external_ref: data.externalRef ?? null,
          payload: data.payload as never,
        })
        .eq("id", data.id)
        .select("id, status")
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }

    const { data: created, error } = await context.supabase
      .from("review_drafts")
      .insert({
        submitter_id: context.userId,
        subject_kind: data.subjectKind,
        title: data.title,
        description: data.description ?? null,
        external_ref: data.externalRef ?? null,
        payload: data.payload as never,
        linked_subject_id: data.linkedSubjectId ?? null,
        status: "draft",
      })
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const withdrawMyDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("review_drafts")
      .update({ status: "withdrawn" })
      .eq("id", data.id)
      .eq("submitter_id", context.userId)
      .eq("status", "draft")
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

export const submitMyDraftForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: subjectId, error } = await context.supabase.rpc("submit_draft_for_review", {
      _draft_id: data.id,
    });
    if (error) throw new Error(error.message);
    return { subjectId: subjectId as string };
  });

// ─── Admin/mgmt: subject management ────────────────────────────────────────
async function assertGovRole(context: { supabase: SupabaseCtx; userId: string }) {
  const check = async (role: "admin" | "management") => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: role,
    });
    if (error) throw new Error((error as { message?: string }).message ?? "role_check_failed");
    return Boolean(data);
  };
  if (!(await check("admin")) && !(await check("management"))) {
    throw new Error("forbidden");
  }
}


const SubjectStatus = z.enum([
  "pending",
  "under_review",
  "decision_pending",
  "approved",
  "rejected",
  "withdrawn",
]);

export const listReviewSubjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: SubjectKind.optional(),
        status: SubjectStatus.optional(),
        search: z.string().max(200).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertGovRole(context);
    let query = context.supabase
      .from("review_subjects")
      .select(
        "id, kind, title, description, external_ref, submitted_by, current_status, required_recommendations, created_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(200);
    if (data.kind) query = query.eq("kind", data.kind);
    if (data.status) query = query.eq("current_status", data.status);
    if (data.search && data.search.trim()) {
      query = query.ilike("title", `%${data.search.trim()}%`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getReviewSubjectFull = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertGovRole(context);
    const { data: subject, error } = await context.supabase
      .from("review_subjects")
      .select(
        "id, kind, external_ref, title, description, submitted_by, current_status, required_recommendations, metadata, created_at, updated_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!subject) return null;

    const [revisionsRes, assignmentsRes, recordsRes, decisionsRes, draftsRes] = await Promise.all([
      context.supabase
        .from("review_subject_revisions")
        .select("id, revision, content_hash, submitted_at, draft_id")
        .eq("subject_id", data.id)
        .order("revision", { ascending: false }),
      context.supabase
        .from("review_assignments")
        .select(
          "id, reviewer_id, assigned_by, assigned_at, due_at, status, conflict_of_interest_declared, conflict_of_interest_reason, template_version_id",
        )
        .eq("subject_id", data.id)
        .order("assigned_at", { ascending: false }),
      context.supabase
        .from("review_records")
        .select("id, reviewer_id, recommendation, rationale, status, submitted_at, updated_at")
        .eq("subject_id", data.id)
        .order("updated_at", { ascending: false }),
      context.supabase
        .from("review_decisions")
        .select("id, decided_by, decision, rationale, decided_at, supersedes_decision_id")
        .eq("subject_id", data.id)
        .order("decided_at", { ascending: false }),
      context.supabase
        .from("review_drafts")
        .select("id, submitter_id, status, updated_at")
        .eq("linked_subject_id", data.id)
        .order("updated_at", { ascending: false }),
    ]);

    if (revisionsRes.error) throw new Error(revisionsRes.error.message);
    if (assignmentsRes.error) throw new Error(assignmentsRes.error.message);
    if (recordsRes.error) throw new Error(recordsRes.error.message);
    if (decisionsRes.error) throw new Error(decisionsRes.error.message);
    if (draftsRes.error) throw new Error(draftsRes.error.message);

    return {
      subject,
      revisions: revisionsRes.data ?? [],
      assignments: assignmentsRes.data ?? [],
      records: recordsRes.data ?? [],
      decisions: decisionsRes.data ?? [],
      drafts: draftsRes.data ?? [],
    };
  });

// ─── Admin/mgmt: assignment operations ─────────────────────────────────────
export const assignReviewer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        subjectId: z.string().uuid(),
        reviewerId: z.string().uuid(),
        dueAt: z.string().datetime().optional(),
        templateVersionId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertGovRole(context);
    const args: Record<string, unknown> = {
      _subject_id: data.subjectId,
      _reviewer_id: data.reviewerId,
    };
    if (data.dueAt) args._due_at = data.dueAt;
    if (data.templateVersionId) args._template_version_id = data.templateVersionId;
    const { data: id, error } = await context.supabase.rpc(
      "assign_reviewer",
      args as never,
    );
    if (error) throw new Error(error.message);
    return { assignmentId: id as string };
  });

export const reassignReviewer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        assignmentId: z.string().uuid(),
        newReviewerId: z.string().uuid(),
        dueAt: z.string().datetime().optional(),
        templateVersionId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertGovRole(context);
    const args: Record<string, unknown> = {
      _assignment_id: data.assignmentId,
      _new_reviewer_id: data.newReviewerId,
    };
    if (data.dueAt) args._due_at = data.dueAt;
    if (data.templateVersionId) args._template_version_id = data.templateVersionId;
    const { data: id, error } = await context.supabase.rpc(
      "reassign_reviewer",
      args as never,
    );
    if (error) throw new Error(error.message);
    return { assignmentId: id as string };
  });

export const cancelAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assignmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertGovRole(context);
    const { error } = await context.supabase.rpc("cancel_assignment", {
      _assignment_id: data.assignmentId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setRequiredRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ subjectId: z.string().uuid(), n: z.number().int().min(1).max(10) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertGovRole(context);
    const { error } = await context.supabase.rpc("set_required_recommendations", {
      _subject_id: data.subjectId,
      _n: data.n,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Lookup: qa_reviewers available for assignment
export const listReviewers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertGovRole(context);
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("user_id, role, created_at")
      .eq("role", "qa_reviewer")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as { user_id: string; role: string; created_at: string }[];
  });


// ─── Reviewer: template criteria schema ────────────────────────────────────
export const getTemplateVersionSchema = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ templateVersionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("review_template_versions")
      .select("id, template_id, version, criteria_schema, published_at")
      .eq("id", data.templateVersionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const saveReviewCriteria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        recordId: z.string().uuid(),
        criteria: z.record(z.unknown()),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("review_records")
      .update({ criteria: data.criteria as never })
      .eq("id", data.recordId)
      .eq("reviewer_id", context.userId)
      .eq("status", "draft")
      .select("id, criteria")
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

// ─── Admin/mgmt: template management ───────────────────────────────────────
export const listReviewTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: SubjectKind.optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertGovRole(context);
    let q = context.supabase
      .from("review_templates")
      .select("id, subject_kind, name, active_version_id, deprecated_at, created_by, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (data.kind) q = q.eq("subject_kind", data.kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getReviewTemplateFull = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertGovRole(context);
    const { data: tpl, error } = await context.supabase
      .from("review_templates")
      .select("id, subject_kind, name, active_version_id, deprecated_at, created_by, created_at, updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tpl) return null;
    const { data: versions, error: vErr } = await context.supabase
      .from("review_template_versions")
      .select("id, version, criteria_schema, published_at, published_by, created_at")
      .eq("template_id", data.id)
      .order("version", { ascending: false });
    if (vErr) throw new Error(vErr.message);
    return { template: tpl, versions: versions ?? [] };
  });

export const createReviewTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ subjectKind: SubjectKind, name: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertGovRole(context);
    const { data: id, error } = await context.supabase.rpc("create_template", {
      _subject_kind: data.subjectKind,
      _name: data.name,
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

export const addTemplateVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ templateId: z.string().uuid(), criteriaSchema: z.record(z.unknown()) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertGovRole(context);
    const { data: id, error } = await context.supabase.rpc("add_template_version", {
      _template_id: data.templateId,
      _criteria_schema: data.criteriaSchema as never,
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

export const publishTemplateVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ versionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertGovRole(context);
    const { error } = await context.supabase.rpc("publish_template_version", {
      _version_id: data.versionId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setActiveTemplateVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ templateId: z.string().uuid(), versionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertGovRole(context);
    const { error } = await context.supabase.rpc("set_active_template_version", {
      _template_id: data.templateId,
      _version_id: data.versionId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deprecateReviewTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ templateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertGovRole(context);
    const { error } = await context.supabase.rpc("deprecate_template", {
      _template_id: data.templateId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Dashboard rollup ──────────────────────────────────────────────────────
export const getGovernanceDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleRows, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleErr) throw new Error(roleErr.message);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    const isAdmin = roles.includes("admin");
    const isMgmt = roles.includes("management");
    const isReviewer = roles.includes("qa_reviewer");

    // Submitter rollup — always available
    const draftsRes = await context.supabase
      .from("review_drafts")
      .select("status")
      .eq("submitter_id", context.userId);
    if (draftsRes.error) throw new Error(draftsRes.error.message);
    const submitter = {
      draft: 0,
      submitted: 0,
      withdrawn: 0,
    } as Record<string, number>;
    for (const r of draftsRes.data ?? []) {
      const s = (r as { status: string }).status;
      submitter[s] = (submitter[s] ?? 0) + 1;
    }

    // Reviewer rollup
    let reviewer: { active: number; recused: number; draftRecords: number; submittedRecords: number } | null = null;
    if (isReviewer || isAdmin) {
      const [asgRes, recRes] = await Promise.all([
        context.supabase
          .from("review_assignments")
          .select("status")
          .eq("reviewer_id", context.userId),
        context.supabase
          .from("review_records")
          .select("status")
          .eq("reviewer_id", context.userId),
      ]);
      if (asgRes.error) throw new Error(asgRes.error.message);
      if (recRes.error) throw new Error(recRes.error.message);
      reviewer = {
        active: (asgRes.data ?? []).filter((a: { status: string }) => a.status === "active").length,
        recused: (asgRes.data ?? []).filter((a: { status: string }) => a.status === "recused").length,
        draftRecords: (recRes.data ?? []).filter((r: { status: string }) => r.status === "draft").length,
        submittedRecords: (recRes.data ?? []).filter((r: { status: string }) => r.status === "submitted").length,
      };
    }

    // Admin/mgmt rollup
    let admin: {
      pending: number;
      underReview: number;
      decisionPending: number;
      approved: number;
      rejected: number;
      templates: number;
    } | null = null;
    if (isAdmin || isMgmt) {
      const [subjRes, tplRes] = await Promise.all([
        context.supabase.from("review_subjects").select("current_status"),
        context.supabase.from("review_templates").select("id").is("deprecated_at", null),
      ]);
      if (subjRes.error) throw new Error(subjRes.error.message);
      if (tplRes.error) throw new Error(tplRes.error.message);
      const counts: Record<string, number> = {};
      for (const r of subjRes.data ?? []) {
        const s = (r as { current_status: string }).current_status;
        counts[s] = (counts[s] ?? 0) + 1;
      }
      admin = {
        pending: counts.pending ?? 0,
        underReview: counts.under_review ?? 0,
        decisionPending: counts.decision_pending ?? 0,
        approved: counts.approved ?? 0,
        rejected: counts.rejected ?? 0,
        templates: (tplRes.data ?? []).length,
      };
    }

    return { roles, submitter, reviewer, admin };
  });
