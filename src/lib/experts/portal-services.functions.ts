import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { ServiceRequest, TrainerPortalBootstrap } from "./portal-services.types";
import { assertModuleAttachments, toFriendlyModuleSubmissionError } from "./module-submission-validation";
import { ServiceRequestPayloadSchema, assertServiceRequestFiles } from "./service-request-files";
import { toFriendlyServiceError } from "./service-request-errors";

const RequestType = z.enum(["speaker", "trainer", "reviewer", "mentor", "technical"]);
const CreateRequest = z.object({
  type: RequestType,
  status: z.enum(["draft", "submitted"]),
  targetExpertSlug: z.string().trim().min(1).max(180).nullable().optional(),
  payload: ServiceRequestPayloadSchema,
});
const RequestId = z.object({ requestId: z.string().uuid() });
const Respond = RequestId.extend({
  action: z.enum(["accept", "request_info", "decline"]),
  message: z.string().trim().max(2000).optional(),
}).refine((v) => v.action !== "request_info" || (v.message?.length ?? 0) >= 5, {
  message: "Tuliskan informasi yang Anda butuhkan dari pemohon (minimal 5 karakter).",
  path: ["message"],
});
const ModuleSubmission = z.object({
  draftId: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(240),
  moduleType: z.enum(["foundational", "technical", "applied", "policy", "managerial", "safety", "compliance", "soft_skills", "field_practicum", "other"]),
  payload: z.record(z.unknown()),
  submit: z.boolean(),
});

export const getTrainerPortalBootstrap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrainerPortalBootstrap> => {
    const loadBootstrap = async () => {
      const { data, error } = await context.supabase.rpc("trainer_portal_bootstrap");
      if (error) throw new Error(error.message);
      return data as unknown as TrainerPortalBootstrap;
    };
    let bootstrap = await loadBootstrap();
    // Reads have no side effects. Only a published expert that has never had a
    // trainer status row (legacy data) gets its first row, once, via a locked RPC.
    if (bootstrap.access === "expert_non_trainer" && bootstrap.trainerStatus === "not_applied") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: created, error: backfillErr } = await (context.supabase as any).rpc("trainer_status_backfill_self");
      if (backfillErr) throw new Error(backfillErr.message);
      if (created) bootstrap = await loadBootstrap();
    }

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
      // Deliberately broader than the ownership rule (./ownership): blocking the
      // row's creator too only ever errs on the safe side.
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
      _request_id: data.requestId, _action: data.action, _message: data.message || null,
    });
    if (error) throw new Error(toFriendlyServiceError(error.message));
    return result;
  });

export const saveTrainerModuleSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => ModuleSubmission.parse(input))
  .handler(async ({ context, data }) => {
    // Early, friendly check; the database repeats it (and the trainer gate, the
    // level quota and the ownership of every file) inside trainer_module_save.
    assertModuleAttachments(data.payload, context.userId, data.submit);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (context.supabase as any).rpc("trainer_module_save", {
      _draft_id: data.draftId ?? null,
      _title: data.title,
      _module_type: data.moduleType,
      _payload: data.payload as Json,
      _submit: data.submit,
    });

    if (error) {
      // Two devices submitting the same draft at once: the loser sees the draft
      // already submitted. Resolve it to the canonical subject instead of failing.
      if (data.submit && data.draftId && error.message.includes("draft_not_editable")) {
        const { data: submittedDraft } = await context.supabase
          .from("review_drafts")
          .select("status, linked_subject_id")
          .eq("id", data.draftId)
          .maybeSingle();
        if (submittedDraft?.status === "submitted" && submittedDraft.linked_subject_id) {
          return { draftId: data.draftId, subjectId: submittedDraft.linked_subject_id, status: "submitted", alreadySubmitted: true };
        }
      }
      throw new Error(toFriendlyModuleSubmissionError(error.message));
    }

    return result as { draftId: string; subjectId: string | null; status: "draft" | "submitted"; alreadySubmitted: boolean };
  });
