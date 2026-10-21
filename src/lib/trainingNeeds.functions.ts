// ============================================================================
// BARUNA — Training Needs intake server functions (Phase 1.3)
// ----------------------------------------------------------------------------
// Thin wrapper over the atomic `training_need_draft_*` SECURITY DEFINER RPCs.
// The wizard submits an entire request in one call: create → update → submit.
// A request returned for revision is resubmitted through the draft that
// return_for_revision opened for it: update → submit.
// All privileged state transitions happen inside the RPCs; this file only
// orchestrates the handshake. The UI ⇄ payload mapping lives in
// src/lib/training-requests/payload.ts.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  TrainingRequestPayload,
  buildTrainingNeedPatch,
  type TrainingRequestPayloadInput,
} from "@/lib/training-requests/payload";

export type TrainingNeedRequestPayload = TrainingRequestPayloadInput;

/**
 * Submit a training request from the public wizard. Runs the full
 * draft_create → draft_update → draft_submit RPC pipeline atomically from the
 * caller's perspective, returning the resulting governance subject id.
 */
export const submitTrainingNeedRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => TrainingRequestPayload.parse(d))
  .handler(async ({ data, context }) => {
    // 1) Create empty draft.
    const { data: draftId, error: e1 } = await context.supabase.rpc(
      "training_need_draft_create",
      { _title: data.trainingTopic, _source_type: "external_submission" },
    );
    if (e1 || !draftId) throw new Error(e1?.message ?? "Failed to create draft");

    // 2) Merge the canonical patch into the draft. Only whitelisted keys are
    //    hydrated by the publish RPC; the shape follows `training_needs` columns.
    const { error: e2 } = await context.supabase.rpc("training_need_draft_update", {
      _draft_id: draftId,
      _patch: buildTrainingNeedPatch(data),
    });
    if (e2) throw new Error(e2.message);

    // 3) Submit the draft into the governance workflow.
    const { data: subjectId, error: e3 } = await context.supabase.rpc(
      "training_need_draft_submit",
      { _draft_id: draftId },
    );
    if (e3 || !subjectId) throw new Error(e3?.message ?? "Failed to submit draft");

    return { draftId: draftId as string, subjectId: subjectId as string };
  });

const RESUBMIT_ERRORS: Record<string, string> = {
  revision_unchanged: "Nothing has changed since the last submission. Update the request before resubmitting.",
  draft_already_submitted: "This revision has already been submitted.",
  draft_not_editable: "This revision has already been submitted.",
};

/**
 * Resubmit a request that the BARUNA team returned for revision (Slide 25:
 * "Minta Perbaikan / Klarifikasi ke Pengguna"). Uses the draft opened by
 * return_for_revision, so the submission keeps its id, history and reviewers.
 */
export const resubmitTrainingNeedRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({ subjectId: z.string().uuid(), request: TrainingRequestPayload }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // RLS: only the submitter sees the submission and its open draft.
    const { data: subject, error: subjectError } = await context.supabase
      .from("review_subjects")
      .select("id")
      .eq("id", data.subjectId)
      .eq("kind", "training_need")
      .eq("submitted_by", context.userId)
      .maybeSingle();
    if (subjectError) throw new Error(subjectError.message);
    if (!subject) throw new Error("Training request not found.");

    const { data: draft, error: draftError } = await context.supabase
      .from("review_drafts")
      .select("id")
      .eq("linked_subject_id", data.subjectId)
      .eq("submitter_id", context.userId)
      .eq("status", "draft")
      .maybeSingle();
    if (draftError) throw new Error(draftError.message);
    if (!draft) throw new Error("This request is not waiting for a revision.");

    const { error: e1 } = await context.supabase.rpc("training_need_draft_update", {
      _draft_id: draft.id,
      _patch: buildTrainingNeedPatch(data.request),
    });
    if (e1) throw new Error(RESUBMIT_ERRORS[e1.message] ?? e1.message);

    const { error: e2 } = await context.supabase.rpc("training_need_draft_submit", { _draft_id: draft.id });
    if (e2) throw new Error(RESUBMIT_ERRORS[e2.message] ?? e2.message);

    return { subjectId: data.subjectId };
  });
