import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { ServiceRequest, TrainerPortalBootstrap } from "./portal-services.types";
import { assertModuleAttachments, getModuleLevelLimitBlocker } from "./module-submission-validation";
import { ServiceRequestPayloadSchema, assertServiceRequestFiles } from "./service-request-files";

const RequestType = z.enum(["speaker", "trainer", "reviewer", "mentor", "technical"]);
const CreateRequest = z.object({
  type: RequestType,
  status: z.enum(["draft", "submitted"]),
  targetExpertSlug: z.string().trim().min(1).max(180).nullable().optional(),
  payload: ServiceRequestPayloadSchema,
});
const RequestId = z.object({ requestId: z.string().uuid() });
const Respond = RequestId.extend({ action: z.enum(["accept", "request_info", "decline"]) });
const ModuleSubmission = z.object({
  draftId: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(240),
  moduleType: z.enum(["foundational", "technical", "applied", "policy", "managerial", "safety", "compliance", "soft_skills", "field_practicum", "other"]),
  payload: z.record(z.unknown()),
  submit: z.boolean(),
});

/**
 * Backfill for experts whose access was granted outside the Join-as-Expert flow
 * (e.g. an administrator assigned the `expert` role in User Management).
 *
 * Guardrails (PB-EXP-01: verification & approval before activation):
 * - a profile is only auto-created when the expert role was granted by another
 *   account, and that grantor is recorded as approver — never self-approval;
 * - a missing trainer status is backfilled once, but an existing (possibly
 *   admin-deactivated) trainer status is NEVER re-activated here.
 */
async function ensureExpertTrainerProvisioned(userId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { slugifyExpertName } = await import("./publishing.server");
    const { getLatestTrainerStatus } = await import("./trainer-status.server");

    const [{ data: existingExpert }, { data: activeExpertRole }] = await Promise.all([
      supabaseAdmin
        .from("experts")
        .select("id, slug, display_name, current_status")
        .or(`original_contributor_id.eq.${userId},created_by.eq.${userId}`)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("rbac_user_roles")
        .select("id, status, granted_by, approved_by, rbac_roles!inner(code)")
        .eq("user_id", userId)
        .eq("status", "active")
        .eq("rbac_roles.code", "expert")
        .limit(1)
        .maybeSingle(),
    ]);

    if (existingExpert?.current_status === "archived") {
      return;
    }

    const isPublishedExpert = existingExpert?.current_status === "published";
    const hasActiveRole = Boolean(activeExpertRole?.id);

    if (!isPublishedExpert && !hasActiveRole) {
      return;
    }

    const now = new Date().toISOString();
    let expertId = existingExpert?.id ?? null;
    const grantor = activeExpertRole?.approved_by || activeExpertRole?.granted_by || null;

    if (!expertId && hasActiveRole && grantor && grantor !== userId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("display_name, organization, job_title")
        .eq("id", userId)
        .maybeSingle();

      const displayName = (profile?.display_name || "BARUNA Expert").trim();
      const slug = `${slugifyExpertName(displayName)}-${userId.slice(0, 8)}`;
      const headline = (profile?.job_title || "Marine & Fisheries Expert").trim();

      const { data: inserted } = await supabaseAdmin
        .from("experts")
        .insert({
          source_type: "admin_created",
          original_contributor_id: userId,
          created_by: userId,
          approved_by: grantor,
          published_by: grantor,
          approval_date: now,
          publication_date: now,
          verification_status: "governance_verified",
          visibility: "public",
          current_status: "published",
          display_name: displayName,
          slug,
          headline,
          bio: "",
          country: "Indonesia",
          languages: ["Indonesian", "English"],
          expertise_areas: [],
        })
        .select("id")
        .single();

      if (inserted?.id) {
        expertId = inserted.id;
        if (profile?.organization || headline) {
          await supabaseAdmin.from("expert_employment").insert({
            expert_id: expertId,
            organization: profile?.organization || "BARUNA Network",
            role: headline,
            is_current: true,
            visibility: "public",
          });
        }
      }
    }

    if (expertId) {
      const trainerRow = await getLatestTrainerStatus(expertId);
      if (!trainerRow) {
        const { error: trainerErr } = await supabaseAdmin.from("expert_trainer_status").insert({
          expert_id: expertId,
          trainer_status: "active",
          trainer_level: "certified",
          unique_graduated_participants: 0,
          granted_by: grantor,
          granted_at: now,
          effective_from: now,
          version: 1,
        });
        if (trainerErr) console.warn("[ensureExpertTrainerProvisioned] trainer backfill failed:", trainerErr.message);
      }
    }
  } catch (err) {
    console.warn("[ensureExpertTrainerProvisioned] warning:", err);
  }
}

export const getTrainerPortalBootstrap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrainerPortalBootstrap> => {
    await ensureExpertTrainerProvisioned(context.userId);
    const { data, error } = await context.supabase.rpc("trainer_portal_bootstrap");
    if (error) throw new Error(error.message);
    const bootstrap = data as unknown as TrainerPortalBootstrap;

    // Historical withdrawn branches remain available for audit in the
    // database, but only the newest active branch belongs in the workspace.
    // We also attach supersededDraftIds and inherit any attachments/quiz data
    // from older branches of the same subjectId so URLs pointing to an older
    // draftId seamlessly resolve to the active revision draft.
    if (bootstrap.moduleDrafts) {
      const allDraftsBySubject = new Map<string, typeof bootstrap.moduleDrafts>();
      for (const d of bootstrap.moduleDrafts) {
        if (d.subjectId) {
          const list = allDraftsBySubject.get(d.subjectId) ?? [];
          list.push(d);
          allDraftsBySubject.set(d.subjectId, list);
        }
      }

      const seenSubjects = new Set<string>();
      bootstrap.moduleDrafts = bootstrap.moduleDrafts.filter((draft) => {
        if (draft.status === "withdrawn") return false;
        if (!draft.subjectId) return true;
        if (seenSubjects.has(draft.subjectId)) return false;
        seenSubjects.add(draft.subjectId);

        const siblings = allDraftsBySubject.get(draft.subjectId) ?? [];
        draft.supersededDraftIds = siblings.filter((s) => s.id !== draft.id).map((s) => s.id);

        const dp = (draft.payload as Record<string, unknown>) ?? {};
        const dm = (dp.metadata as Record<string, unknown>) ?? {};
        const hasAttached =
          (Array.isArray(dm.attached_resources) && dm.attached_resources.length > 0) ||
          (Array.isArray(dp.documents) && dp.documents.length > 0) ||
          (Array.isArray(dp.attachments) && dp.attachments.length > 0);

        if (!hasAttached) {
          const donor = siblings.find((s) => {
            const sp = (s.payload as Record<string, unknown>) ?? {};
            const sm = (sp.metadata as Record<string, unknown>) ?? {};
            return (
              (Array.isArray(sm.attached_resources) && sm.attached_resources.length > 0) ||
              (Array.isArray(sp.documents) && sp.documents.length > 0) ||
              (Array.isArray(sp.attachments) && sp.attachments.length > 0)
            );
          });
          if (donor) {
            const sp = (donor.payload as Record<string, unknown>) ?? {};
            const sm = (sp.metadata as Record<string, unknown>) ?? {};
            const inheritedFiles =
              (Array.isArray(sm.attached_resources) && sm.attached_resources) ||
              (Array.isArray(sp.documents) && sp.documents) ||
              (Array.isArray(sp.attachments) && sp.attachments) ||
              [];
            draft.payload = {
              ...sp,
              ...dp,
              documents: inheritedFiles,
              attachments: inheritedFiles,
              metadata: {
                ...sm,
                ...dm,
                attached_resources: inheritedFiles,
              },
            } as Json;
          }
        }

        return true;
      });
    }

    // Pastikan semua module_registry resmi milik pengguna terhubung ke daftar modules
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: regModules } = await supabaseAdmin
        .from("module_registry")
        .select("id, title, summary, current_status, estimated_learning_hours, version, language, module_type, target_participants, updated_at")
        .or(`original_contributor_id.eq.${context.userId},created_by.eq.${context.userId}`);

      if (regModules && regModules.length > 0) {
        const existingIds = new Set((bootstrap.modules ?? []).map((m) => m.id));
        const mergedModules = [...(bootstrap.modules ?? [])];

        for (const rm of regModules) {
          if (!existingIds.has(rm.id)) {
            mergedModules.push({
              id: rm.id,
              title: rm.title,
              summary: rm.summary,
              status: rm.current_status,
              hours: rm.estimated_learning_hours,
              version: rm.version,
              language: rm.language,
              moduleType: rm.module_type,
              targetParticipants: rm.target_participants,
              updatedAt: rm.updated_at,
            });
            existingIds.add(rm.id);
          } else {
            const idx = mergedModules.findIndex((m) => m.id === rm.id);
            if (idx !== -1) {
              mergedModules[idx].status = rm.current_status;
            }
          }
        }
        bootstrap.modules = mergedModules;
      }

      // Enrich moduleDrafts with review_subjects metadata (especially archiving info)
      if (bootstrap.moduleDrafts && bootstrap.moduleDrafts.length > 0) {
        const subjectIds = bootstrap.moduleDrafts
          .map((d) => d.subjectId)
          .filter((id): id is string => Boolean(id));

        if (subjectIds.length > 0) {
          const { data: subjects } = await supabaseAdmin
            .from("review_subjects")
            .select("id, current_status, metadata")
            .in("id", subjectIds);

          if (subjects && subjects.length > 0) {
            const subjectMap = new Map(subjects.map((s) => [s.id, s]));

            for (const draft of bootstrap.moduleDrafts) {
              if (draft.subjectId && subjectMap.has(draft.subjectId)) {
                const s = subjectMap.get(draft.subjectId)!;
                const meta = (s.metadata as Record<string, unknown>) ?? {};

                if (typeof meta.review_status === "string") {
                  draft.reviewStatus = meta.review_status;
                }

                if (s.current_status === "withdrawn" || meta.review_status === "archived") {
                  draft.reviewStatus = "archived";
                  const archivedReason =
                    typeof meta.archived_reason === "string"
                      ? meta.archived_reason
                      : "Modul telah ditarik/diarsipkan oleh Administrator BARUNA.";
                  const archivedAt =
                    typeof meta.archived_at === "string"
                      ? meta.archived_at
                      : draft.updatedAt;

                  const hasArchiveEvent = (draft.reviewHistory ?? []).some(
                    (h) => h.decision === "archive",
                  );
                  if (!hasArchiveEvent) {
                    draft.reviewHistory = [
                      {
                        kind: "decision",
                        at: archivedAt,
                        actor: "Administrator BARUNA",
                        decision: "archive",
                        comment: archivedReason,
                      },
                      ...(draft.reviewHistory ?? []),
                    ];
                  }
                }
              }
            }
          }
        }
      }
    } catch (enrichErr) {
      console.warn("[getTrainerPortalBootstrap] enrichment warning:", enrichErr);
    }

    return bootstrap;
  });

export const createExpertServiceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => CreateRequest.parse(input))
  .handler(async ({ context, data }) => {
    assertServiceRequestFiles(data.payload, context.userId, data.status === "submitted");
    if (data.targetExpertSlug) {
      // PB-EXP-03 conflict check: an expert cannot assign a request to themselves.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: ownTarget } = await supabaseAdmin
        .from("experts")
        .select("id")
        .eq("slug", data.targetExpertSlug)
        .or(`original_contributor_id.eq.${context.userId},created_by.eq.${context.userId}`)
        .maybeSingle();
      if (ownTarget) throw new Error("Anda tidak dapat mengajukan permintaan ke profil expert milik sendiri.");
    }
    const { data: result, error } = await context.supabase.rpc("expert_service_request_create", {
      _request_type: data.type,
      _status: data.status,
      _target_expert_slug: data.targetExpertSlug ?? null,
      _payload: data.payload as Json,
    });
    if (error) throw new Error(error.message);
    return result as { id: string; requestNumber: string; status: string };
  });

export const listMyExpertServiceRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ServiceRequest[]> => {
    const { data, error } = await context.supabase.rpc("expert_service_requests_my");
    if (error) throw new Error(error.message);
    return data as unknown as ServiceRequest[];
  });

export const deleteExpertServiceRequestDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => RequestId.parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("expert_service_request_delete_draft", { _request_id: data.requestId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTrainerServiceRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ServiceRequest[]> => {
    const { data, error } = await context.supabase.rpc("trainer_service_requests");
    if (error) throw new Error(error.message);
    return data as unknown as ServiceRequest[];
  });

export const respondToTrainerServiceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => Respond.parse(input))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("trainer_service_request_respond", {
      _request_id: data.requestId, _action: data.action,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const saveTrainerModuleSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => ModuleSubmission.parse(input))
  .handler(async ({ context, data }) => {
    await ensureExpertTrainerProvisioned(context.userId);
    const access = await context.supabase.rpc("trainer_portal_bootstrap");
    const bootstrap = access.data as unknown as TrainerPortalBootstrap | null;
    if (access.error || bootstrap?.access !== "active_trainer") {
      throw new Error("active_trainer_required");
    }

    assertModuleAttachments(data.payload, context.userId, data.submit);

    let draftId = data.draftId;
    if (!draftId) {
      // New modules count against the trainer level quota; revisions of an
      // existing draft do not (same rule as the submit page, but unbypassable).
      const limitBlocker = getModuleLevelLimitBlocker(bootstrap);
      if (limitBlocker) throw new Error(limitBlocker);
      const created = await context.supabase.rpc("module_draft_create", {
        _title: data.title,
        _module_type: data.moduleType,
        _source_type: "external_submission",
      });
      if (created.error) throw new Error(created.error.message);
      draftId = created.data as string;
    }

    // A browser retry or fast double-click may replay the request after the
    // first call has already submitted this exact draft. Treat that replay as
    // success without reopening (or mutating) the immutable submitted draft.
    const { data: existingDraft, error: existingDraftError } = await context.supabase
      .from("review_drafts")
      .select("status, linked_subject_id")
      .eq("id", draftId)
      .maybeSingle();
    if (existingDraftError) throw new Error(existingDraftError.message);
    if (existingDraft?.status === "withdrawn" && existingDraft.linked_subject_id) {
      const { data: activeRevisionDraft } = await context.supabase
        .from("review_drafts")
        .select("id, status")
        .eq("linked_subject_id", existingDraft.linked_subject_id)
        .eq("submitter_id", context.userId)
        .eq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (activeRevisionDraft?.id) {
        draftId = activeRevisionDraft.id;
      }
    } else if (
      data.submit &&
      existingDraft?.status === "submitted" &&
      existingDraft.linked_subject_id
    ) {
      return {
        draftId,
        subjectId: existingDraft.linked_subject_id,
        status: "submitted",
        alreadySubmitted: true,
      };
    }

    const patchPayload = data.submit
      ? { ...data.payload, last_submitted_at: new Date().toISOString() }
      : data.payload;

    const updated = await context.supabase.rpc("module_draft_update", {
      _draft_id: draftId,
      _patch: patchPayload as Json,
    });
    if (updated.error) throw new Error(updated.error.message);

    if (!data.submit) return { draftId, subjectId: null, status: "draft" };

    const submitted = await context.supabase.rpc("module_draft_submit", { _draft_id: draftId });
    let subjectId = submitted.data as string | null;
    if (submitted.error) {
      // Close the small race between the status check above and concurrent
      // submission: resolve the canonical linked subject and return success.
      if (submitted.error.message.includes("draft_not_editable")) {
        const { data: submittedDraft } = await context.supabase
          .from("review_drafts")
          .select("status, linked_subject_id")
          .eq("id", draftId)
          .maybeSingle();
        if (submittedDraft?.status === "submitted" && submittedDraft.linked_subject_id) {
          subjectId = submittedDraft.linked_subject_id;
        } else {
          throw new Error(submitted.error.message);
        }
      } else {
        throw new Error(submitted.error.message);
      }
    }
    if (!subjectId) throw new Error("module_submission_subject_missing");

    // Update review_subjects metadata to track resubmitted status and timestamp.
    // The submission itself is already committed by module_draft_submit, so a
    // failure here is logged (not thrown) — but never silently discarded.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: currentSubj } = await supabaseAdmin
        .from("review_subjects")
        .select("metadata")
        .eq("id", subjectId)
        .maybeSingle();

      const existingMeta = (currentSubj?.metadata as Record<string, unknown>) ?? {};
      const wasRevised =
        existingMeta.review_status === "revision_requested" ||
        typeof existingMeta.last_rationale === "string";

      const { error: metaErr } = await supabaseAdmin
        .from("review_subjects")
        .update({
          title: data.title,
          current_status: "pending",
          updated_at: new Date().toISOString(),
          metadata: {
            ...existingMeta,
            review_status: wasRevised ? "resubmitted" : "pending",
            ...(wasRevised ? { resubmitted_at: new Date().toISOString() } : {}),
          },
        })
        .eq("id", subjectId);
      if (metaErr) console.error("[saveTrainerModuleSubmission] metadata sync failed:", metaErr.message);
    } catch (metaErr) {
      console.error("[saveTrainerModuleSubmission] metadata sync failed:", metaErr);
    }

    return { draftId, subjectId, status: "submitted", alreadySubmitted: false };
  });
