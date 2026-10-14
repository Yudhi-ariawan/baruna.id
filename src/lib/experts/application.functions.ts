import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import type {
  ExpertApplicationBootstrap,
  ExpertApplicationStatus,
  ExpertDraftPayload,
} from "./application.types";
import { deriveExpertEffectiveStatus, toApplicantReviewStatus } from "./application-status";
import {
  ExpertPayloadSchema,
  assertOwnedDocumentPaths,
  getExpertPayloadIncompleteFields,
  toFriendlyExpertError,
} from "./application-validation";

const DraftId = z.object({ draftId: z.string().uuid() });
const SaveInput = z.object({
  draftId: z.string().uuid().optional(),
  displayName: z.string().trim().min(2).max(160),
  payload: ExpertPayloadSchema,
});

const IN_QUEUE_SUBJECT_STATUSES = ["pending", "under_review", "decision_pending"];

function asPayload(value: unknown): ExpertDraftPayload {
  return value as ExpertDraftPayload;
}

/**
 * PB-EXP-02 duplicate check: a user may hold at most one live expert
 * application and may not apply again once they are an active expert.
 * Returns a blocking message, or null when a new application may start.
 */
async function getNewApplicationBlocker(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: activeExpert }, { data: queuedSubjects }] = await Promise.all([
    supabaseAdmin
      .from("experts")
      .select("id")
      .or(`original_contributor_id.eq.${userId},created_by.eq.${userId}`)
      .in("current_status", ["approved", "published"])
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("review_subjects")
      .select("id, metadata")
      .eq("kind", "expert")
      .eq("submitted_by", userId)
      .in("current_status", IN_QUEUE_SUBJECT_STATUSES),
  ]);
  if (activeExpert) return "Akun Anda sudah terdaftar sebagai expert aktif.";
  const queued = queuedSubjects ?? [];
  if (queued.length === 0) return null;
  const awaitingRevision = queued.some(
    (subject) => ((subject.metadata as Record<string, unknown>) ?? {}).review_status === "revision_requested",
  );
  return awaitingRevision
    ? "Anda memiliki pengajuan yang menunggu revisi. Silakan lanjutkan revisi tersebut, bukan membuat pengajuan baru."
    : toFriendlyExpertError("expert_application_already_pending");
}

async function readApplications(context: {
  supabase: SupabaseClient<Database>;
  userId: string;
}): Promise<ExpertApplicationStatus[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: drafts, error } = await supabaseAdmin
    .from("review_drafts")
    .select("id, title, status, linked_subject_id, payload, created_at, updated_at")
    .eq("submitter_id", context.userId)
    .eq("subject_kind", "expert")
    .neq("status", "withdrawn")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const subjectIds = (drafts ?? [])
    .map((draft: { linked_subject_id: string | null }) => draft.linked_subject_id)
    .filter((id: string | null): id is string => Boolean(id));

  const [{ data: subjects }, { data: decisions }] = await Promise.all([
    subjectIds.length
      ? supabaseAdmin
          .from("review_subjects")
          .select("id, current_status, metadata")
          .in("id", subjectIds)
      : Promise.resolve({ data: [] }),
    subjectIds.length
      ? supabaseAdmin
          .from("review_decisions")
          .select("id, subject_id, decision, rationale, created_at")
          .in("subject_id", subjectIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const subjectMap = new Map<string, { current_status: string; metadata: Record<string, unknown> }>(
    (subjects ?? []).map((subject: { id: string; current_status: string; metadata: Json }) => [
      subject.id,
      {
        current_status: subject.current_status,
        metadata: (subject.metadata as Record<string, unknown>) ?? {},
      },
    ]),
  );

  const decisionMap = new Map<
    string,
    { id: string; decision: string; rationale: string | null; createdAt: string }
  >();
  (decisions ?? []).forEach((dec: { id: string; subject_id: string; decision: string; rationale: string | null; created_at: string }) => {
    if (!decisionMap.has(dec.subject_id)) {
      decisionMap.set(dec.subject_id, {
        id: dec.id,
        decision: dec.decision,
        rationale: dec.rationale,
        createdAt: dec.created_at,
      });
    }
  });

  return (drafts ?? []).map(
    (draft: {
      id: string;
      title: string;
      status: string;
      linked_subject_id: string | null;
      payload: Json;
      created_at: string;
      updated_at: string;
    }) => {
      const subjInfo = draft.linked_subject_id
        ? (subjectMap.get(draft.linked_subject_id) ?? null)
        : null;
      const latestDec = draft.linked_subject_id
        ? (decisionMap.get(draft.linked_subject_id) ?? null)
        : null;

      // A fresh draft that never entered the queue has no review status yet.
      const effectiveReviewStatus = subjInfo
        ? toApplicantReviewStatus(
            deriveExpertEffectiveStatus({
              subjectStatus: subjInfo.current_status,
              subjectMeta: subjInfo.metadata,
              latestDecision: latestDec?.decision,
              draftStatus: draft.status,
            }),
            draft.status,
          )
        : null;

      return {
        draftId: draft.id,
        subjectId: draft.linked_subject_id,
        title: draft.title,
        draftStatus: draft.status,
        reviewStatus: effectiveReviewStatus,
        createdAt: draft.created_at,
        updatedAt: draft.updated_at,
        payload: asPayload(draft.payload),
        latestDecision: latestDec,
      };
    },
  );
}

export const getExpertApplicationBootstrap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExpertApplicationBootstrap> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      { data: profile, error },
      { data: identity, error: identityError },
      applications,
      existingExpert,
      expertRbac,
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("display_name, organization, job_title, phone")
        .eq("id", context.userId)
        .single(),
      supabaseAdmin.auth.admin.getUserById(context.userId),
      readApplications(context),
      (async () => {
        try {
          const { data } = await supabaseAdmin
            .from("experts")
            .select("id, slug, display_name, current_status")
            .or(`original_contributor_id.eq.${context.userId},created_by.eq.${context.userId}`)
            .neq("current_status", "archived")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          return data;
        } catch {
          return null;
        }
      })(),
      (async () => {
        try {
          const { data } = await supabaseAdmin
            .from("rbac_user_roles")
            .select("id, status, rbac_roles!inner(code)")
            .eq("user_id", context.userId)
            .eq("status", "active")
            .eq("rbac_roles.code", "expert")
            .limit(1)
            .maybeSingle();
          return data;
        } catch {
          return null;
        }
      })(),
    ]);
    if (error || !profile) throw new Error(error?.message ?? "profile_not_found");
    if (identityError || !identity.user) throw new Error("user_identity_not_found");

    const hasApprovedApplication = applications.some(
      (app) => app.reviewStatus === "approved" || app.draftStatus === "approved",
    );
    const hasPublishedExpert = Boolean(
      existingExpert &&
        (existingExpert.current_status === "approved" ||
          (existingExpert.current_status as string) === "published" ||
          (existingExpert.current_status as string) === "active"),
    );
    const hasExpertRbacRole = Boolean(expertRbac?.id);

    const isAlreadyExpert = Boolean(
      hasPublishedExpert || hasApprovedApplication || hasExpertRbacRole,
    );

    const pendingApplication = !isAlreadyExpert
      ? applications.find(
          (app) =>
            app.draftStatus === "submitted" &&
            (app.reviewStatus === "pending" ||
              app.reviewStatus === "under_review" ||
              app.reviewStatus === "decision_pending" ||
              !app.reviewStatus),
        ) ?? null
      : null;

    const editableDraft = !isAlreadyExpert && !pendingApplication
      ? applications.find(
          (application) =>
            application.draftStatus === "draft" ||
            application.reviewStatus === "revision_requested",
        ) ?? null
      : applications.find(
          (application) => application.reviewStatus === "revision_requested",
        ) ?? null;

    return {
      userId: context.userId,
      profile: {
        fullName: profile.display_name ?? "",
        email: identity.user.email ?? "",
        institution: profile.organization ?? "",
        title: profile.job_title ?? "",
        phone: profile.phone ?? "",
      },
      isAlreadyExpert,
      expertSlug: existingExpert?.slug ?? null,
      expertName: existingExpert?.display_name ?? profile.display_name ?? null,
      pendingApplication,
      editableDraft,
    };
  });

export const listMyExpertApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => readApplications(context));

export const saveExpertApplicationDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => SaveInput.parse(value))
  .handler(async ({ data, context }) => {
    assertOwnedDocumentPaths(data.payload, context.userId);

    let draftId = data.draftId;
    if (!draftId) {
      // Idempotent create: reuse the caller's editable expert draft instead of
      // spawning duplicates on double-click / multiple tabs.
      const { data: reusable } = await context.supabase
        .from("review_drafts")
        .select("id")
        .eq("submitter_id", context.userId)
        .eq("subject_kind", "expert")
        .eq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reusable?.id) {
        draftId = reusable.id;
      } else {
        const blocker = await getNewApplicationBlocker(context.userId);
        if (blocker) throw new Error(blocker);
        const { data: createdId, error } = await context.supabase.rpc("expert_draft_create", {
          _display_name: data.displayName,
          _source_type: "external_submission",
        });
        if (error) throw new Error(toFriendlyExpertError(error.message));
        draftId = createdId as string;
      }
    } else {
      const { data: existingDraft } = await context.supabase
        .from("review_drafts")
        .select("status, linked_subject_id")
        .eq("id", draftId)
        .maybeSingle();
      if (existingDraft?.status === "withdrawn" && existingDraft.linked_subject_id) {
        const { data: activeRevisionDraft } = await context.supabase
          .from("review_drafts")
          .select("id")
          .eq("linked_subject_id", existingDraft.linked_subject_id)
          .eq("submitter_id", context.userId)
          .eq("status", "draft")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (activeRevisionDraft?.id) {
          draftId = activeRevisionDraft.id;
        }
      }
    }
    const patchPayload = {
      ...data.payload,
      last_saved_at: new Date().toISOString(),
    };
    const { error } = await context.supabase.rpc("expert_draft_update", {
      _draft_id: draftId,
      _patch: patchPayload as never,
    });
    if (error) throw new Error(toFriendlyExpertError(error.message));
    return { draftId };
  });

export const submitExpertApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => DraftId.parse(value))
  .handler(async ({ data, context }) => {
    // PB-EXP-02 "Cek Kelengkapan": never queue an incomplete application,
    // regardless of what the browser validated.
    const { data: draft, error: draftError } = await context.supabase
      .from("review_drafts")
      .select("id, status, payload, linked_subject_id, subject_kind")
      .eq("id", data.draftId)
      .eq("submitter_id", context.userId)
      .maybeSingle();
    if (draftError) throw new Error(draftError.message);
    if (!draft || draft.subject_kind !== "expert") throw new Error(toFriendlyExpertError("draft_not_found"));
    if (draft.status !== "draft") throw new Error(toFriendlyExpertError("draft_already_submitted"));

    const missing = getExpertPayloadIncompleteFields((draft.payload as Record<string, unknown>) ?? {});
    if (missing.length > 0) {
      throw new Error(`Pengajuan belum lengkap. Lengkapi: ${missing.join(", ")}.`);
    }
    if (!draft.linked_subject_id) {
      const blocker = await getNewApplicationBlocker(context.userId);
      if (blocker) throw new Error(blocker);
    }

    const { data: subjectId, error } = await context.supabase.rpc("expert_draft_submit", {
      _draft_id: data.draftId,
    });
    if (error) throw new Error(toFriendlyExpertError(error.message));

    // Sync review_subjects metadata if this was a resubmission of a revision_requested subject
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subj } = await supabaseAdmin
      .from("review_subjects")
      .select("id, metadata")
      .eq("id", subjectId as string)
      .maybeSingle();

    if (subj) {
      const currentMeta = (subj.metadata as Record<string, unknown>) ?? {};
      const wasRevised =
        currentMeta.review_status === "revision_requested" ||
        currentMeta.last_decision === "return_for_revision";
      if (wasRevised) {
        const { error: syncError } = await supabaseAdmin
          .from("review_subjects")
          .update({
            current_status: "pending",
            metadata: {
              ...currentMeta,
              review_status: "resubmitted",
              resubmitted_at: new Date().toISOString(),
            } as never,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subj.id);
        if (syncError) {
          // The submission itself is committed; surface the drift in logs rather than failing the user.
          console.error("[submitExpertApplication] metadata sync failed:", syncError.message);
        }
      }
    }

    return { draftId: data.draftId, subjectId: subjectId as string };
  });

export const resubmitExpertApplicationRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        draftId: z.string().uuid(),
        subjectId: z.string().uuid(),
        displayName: z.string().trim().min(1).max(160),
        payload: ExpertPayloadSchema,
        notes: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    assertOwnedDocumentPaths(input.payload, context.userId);
    const missing = getExpertPayloadIncompleteFields(input.payload);
    if (missing.length > 0) {
      throw new Error(`Pengajuan belum lengkap. Lengkapi: ${missing.join(", ")}.`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Verify subject ownership
    const { data: subj, error: subjErr } = await supabaseAdmin
      .from("review_subjects")
      .select("id, kind, submitted_by, current_status, metadata, updated_at")
      .eq("id", input.subjectId)
      .single();

    if (subjErr || !subj || subj.submitted_by !== context.userId || subj.kind !== "expert") {
      throw new Error("Pengajuan tidak ditemukan atau Anda tidak memiliki akses.");
    }

    // Resolve active non-withdrawn draftId for this subject if input.draftId was superseded
    let targetDraftId = input.draftId;
    const { data: latestActiveDraft } = await supabaseAdmin
      .from("review_drafts")
      .select("id, status")
      .eq("linked_subject_id", input.subjectId)
      .eq("submitter_id", context.userId)
      .neq("status", "withdrawn")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestActiveDraft?.id) {
      targetDraftId = latestActiveDraft.id;
    }

    // 2. State guard: only a subject that is actually waiting for this applicant's
    //    revision may be resubmitted. Without this an approved/rejected/archived
    //    subject could be silently pushed back into the queue.
    const { data: latestDecision } = await supabaseAdmin
      .from("review_decisions")
      .select("decision")
      .eq("subject_id", input.subjectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const effective = deriveExpertEffectiveStatus({
      subjectStatus: subj.current_status,
      subjectMeta: (subj.metadata as Record<string, unknown>) ?? {},
      latestDecision: latestDecision?.decision,
      draftStatus: latestActiveDraft?.status,
    });
    if (effective !== "revision_requested" || latestActiveDraft?.status !== "draft") {
      throw new Error("Pengajuan ini tidak sedang menunggu revisi. Muat ulang halaman untuk melihat status terbaru.");
    }

    // 3. Claim the subject with an optimistic lock on updated_at so a double
    //    submit (or a concurrent admin decision) cannot both win.
    const now = new Date().toISOString();
    const currentSubjMeta = (subj.metadata as Record<string, unknown>) ?? {};
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("review_subjects")
      .update({
        current_status: "pending",
        title: input.displayName,
        metadata: {
          ...currentSubjMeta,
          review_status: "resubmitted",
          resubmitted_at: now,
          resubmission_notes: input.notes || "Dokumen revisi dikirimkan ulang oleh calon expert.",
        } as never,
        updated_at: now,
      })
      .eq("id", input.subjectId)
      .eq("updated_at", subj.updated_at)
      .select("id");
    if (claimErr) throw new Error(claimErr.message);
    if (!claimed || claimed.length === 0) {
      throw new Error("Pengajuan sedang diproses atau telah berubah. Muat ulang halaman lalu coba lagi.");
    }

    const restoreSubject = async () => {
      await supabaseAdmin
        .from("review_subjects")
        .update({
          current_status: subj.current_status,
          metadata: currentSubjMeta as never,
        })
        .eq("id", input.subjectId);
    };

    // 4. Move the draft to submitted through the caller's own RLS context.
    const { data: movedDraft, error: draftErr } = await context.supabase
      .from("review_drafts")
      .update({
        payload: input.payload as never,
        status: "submitted",
        title: input.displayName,
        updated_at: now,
      })
      .eq("id", targetDraftId)
      .eq("submitter_id", context.userId)
      .eq("status", "draft")
      .select("id");
    if (draftErr || !movedDraft || movedDraft.length === 0) {
      await restoreSubject();
      throw new Error(draftErr?.message || "Draf revisi tidak dapat dikirim. Muat ulang halaman lalu coba lagi.");
    }

    // 5. Record a revision snapshot (version record, PB-EXP-01) using max(revision) + 1
    const { data: latestRev } = await supabaseAdmin
      .from("review_subject_revisions")
      .select("revision")
      .eq("subject_id", input.subjectId)
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle();

    const revNum = Number(latestRev?.revision ?? 0) + 1;
    const { error: revErr } = await supabaseAdmin.from("review_subject_revisions").insert({
      subject_id: input.subjectId,
      draft_id: targetDraftId,
      revision: revNum,
      snapshot: {
        payload: input.payload,
        resubmitted_at: now,
        notes: input.notes || "Dokumen revisi dikirimkan ulang oleh calon expert.",
      } as unknown as Json,
      content_hash: `rev-exp-${revNum}-${Date.now()}`,
    });
    if (revErr) {
      // Submission state is already consistent; the snapshot is audit-only.
      console.error("[resubmitExpertApplicationRevision] revision snapshot failed:", revErr.message);
    }

    return { success: true, subjectId: input.subjectId, revision: revNum };
  });
