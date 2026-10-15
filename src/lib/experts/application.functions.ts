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
    // Subject status, draft and revision snapshot change in ONE transaction
    // (public.expert_revision_resubmit, migration 20261015060000). The RPC repeats
    // the ownership, state and completeness checks, so a direct SDK call cannot skip them.
    const { data, error } = await context.supabase.rpc("expert_revision_resubmit", {
      _subject_id: input.subjectId,
      _draft_id: input.draftId,
      _display_name: input.displayName,
      _payload: input.payload as unknown as Json,
      _notes: input.notes ?? null,
    });
    if (error) {
      if (error.message.includes("not_awaiting_revision")) {
        throw new Error("Pengajuan ini tidak sedang menunggu revisi. Muat ulang halaman untuk melihat status terbaru.");
      }
      if (error.message.includes("payload_incomplete")) {
        throw new Error(`Pengajuan belum lengkap: ${error.message.split("payload_incomplete:")[1]?.trim() ?? ""}.`);
      }
      if (error.message.includes("document_not_owned")) {
        throw new Error("Dokumen pengajuan tidak valid: berkas harus diunggah dari akun Anda sendiri.");
      }
      if (error.message.includes("Could not find the function")) {
        throw new Error("Kirim ulang revisi membutuhkan migrasi database 20261015060000.");
      }
      throw new Error(toFriendlyExpertError(error.message));
    }
    const result = (data ?? {}) as { subjectId?: string; revision?: number };
    return { success: true, subjectId: input.subjectId, revision: Number(result.revision ?? 0) };
  });
