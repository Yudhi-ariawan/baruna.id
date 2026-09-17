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

const DraftPayload = z.record(z.unknown());
const DraftId = z.object({ draftId: z.string().uuid() });
const SaveInput = z.object({
  draftId: z.string().uuid().optional(),
  displayName: z.string().trim().min(2).max(160),
  payload: DraftPayload,
});

function asPayload(value: unknown): ExpertDraftPayload {
  return value as ExpertDraftPayload;
}

async function readApplications(context: {
  supabase: SupabaseClient<Database>;
  userId: string;
}): Promise<ExpertApplicationStatus[]> {
  const { data: drafts, error } = await context.supabase
    .from("review_drafts")
    .select("id, title, status, linked_subject_id, payload, created_at, updated_at")
    .eq("submitter_id", context.userId)
    .eq("subject_kind", "expert")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const subjectIds = (drafts ?? [])
    .map((draft: { linked_subject_id: string | null }) => draft.linked_subject_id)
    .filter((id: string | null): id is string => Boolean(id));
  const subjects = subjectIds.length
    ? await context.supabase
        .from("review_subjects")
        .select("id, current_status")
        .in("id", subjectIds)
    : { data: [], error: null };
  if (subjects.error) throw new Error(subjects.error.message);
  const statuses = new Map<string, string>(
    (subjects.data ?? []).map((subject: { id: string; current_status: string }) => [
      subject.id,
      subject.current_status,
    ]),
  );

  return (drafts ?? []).map(
    (draft: {
      id: string;
      title: string;
      status: string;
      linked_subject_id: string | null;
      payload: Json;
      created_at: string;
      updated_at: string;
    }) => ({
      draftId: draft.id,
      subjectId: draft.linked_subject_id,
      title: draft.title,
      draftStatus: draft.status,
      reviewStatus: draft.linked_subject_id
        ? (statuses.get(draft.linked_subject_id) ?? null)
        : null,
      createdAt: draft.created_at,
      updatedAt: draft.updated_at,
      payload: asPayload(draft.payload),
    }),
  );
}

export const getExpertApplicationBootstrap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExpertApplicationBootstrap> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile, error }, { data: identity, error: identityError }, applications] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("display_name, organization, job_title, phone")
          .eq("id", context.userId)
          .single(),
        supabaseAdmin.auth.admin.getUserById(context.userId),
        readApplications(context),
      ]);
    if (error || !profile) throw new Error(error?.message ?? "profile_not_found");
    if (identityError || !identity.user) throw new Error("user_identity_not_found");
    return {
      userId: context.userId,
      profile: {
        fullName: profile.display_name ?? "",
        email: identity.user.email ?? "",
        institution: profile.organization ?? "",
        title: profile.job_title ?? "",
        phone: profile.phone ?? "",
      },
      editableDraft:
        applications.find((application) => application.draftStatus === "draft") ?? null,
    };
  });

export const listMyExpertApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => readApplications(context));

export const saveExpertApplicationDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => SaveInput.parse(value))
  .handler(async ({ data, context }) => {
    let draftId = data.draftId;
    if (!draftId) {
      const { data: createdId, error } = await context.supabase.rpc("expert_draft_create", {
        _display_name: data.displayName,
        _source_type: "external_submission",
      });
      if (error) throw new Error(error.message);
      draftId = createdId as string;
    }
    const { error } = await context.supabase.rpc("expert_draft_update", {
      _draft_id: draftId,
      _patch: data.payload as never,
    });
    if (error) throw new Error(error.message);
    return { draftId };
  });

export const submitExpertApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => DraftId.parse(value))
  .handler(async ({ data, context }) => {
    const { data: subjectId, error } = await context.supabase.rpc("expert_draft_submit", {
      _draft_id: data.draftId,
    });
    if (error) throw new Error(error.message);
    return { draftId: data.draftId, subjectId: subjectId as string };
  });
