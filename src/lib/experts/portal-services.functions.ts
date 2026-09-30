import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { ServiceRequest, TrainerPortalBootstrap } from "./portal-services.types";

const RequestType = z.enum(["speaker", "trainer", "reviewer", "mentor", "technical"]);
const CreateRequest = z.object({
  type: RequestType,
  status: z.enum(["draft", "submitted"]),
  targetExpertSlug: z.string().trim().min(1).max(180).nullable().optional(),
  payload: z.record(z.unknown()),
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

export const getTrainerPortalBootstrap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrainerPortalBootstrap> => {
    const { data, error } = await context.supabase.rpc("trainer_portal_bootstrap");
    if (error) throw new Error(error.message);
    const bootstrap = data as unknown as TrainerPortalBootstrap;

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
          }
        }
        bootstrap.modules = mergedModules;
      }
    } catch (enrichErr) {
      console.warn("[getTrainerPortalBootstrap] enrichment warning:", enrichErr);
    }

    return bootstrap;
  });

export const createExpertServiceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateRequest.parse(input))
  .handler(async ({ context, data }) => {
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
  .inputValidator((input) => RequestId.parse(input))
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
  .inputValidator((input) => Respond.parse(input))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("trainer_service_request_respond", {
      _request_id: data.requestId, _action: data.action,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const saveTrainerModuleSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ModuleSubmission.parse(input))
  .handler(async ({ context, data }) => {
    const access = await context.supabase.rpc("trainer_portal_bootstrap");
    if (access.error || (access.data as { access?: string } | null)?.access !== "active_trainer") {
      throw new Error("active_trainer_required");
    }

    let draftId = data.draftId;
    if (!draftId) {
      const created = await context.supabase.rpc("module_draft_create", {
        _title: data.title,
        _module_type: data.moduleType,
        _source_type: "external_submission",
      });
      if (created.error) throw new Error(created.error.message);
      draftId = created.data as string;
    }

    const updated = await context.supabase.rpc("module_draft_update", {
      _draft_id: draftId,
      _patch: data.payload as Json,
    });
    if (updated.error) throw new Error(updated.error.message);

    if (!data.submit) return { draftId, subjectId: null, status: "draft" };

    const submitted = await context.supabase.rpc("module_draft_submit", { _draft_id: draftId });
    if (submitted.error) throw new Error(submitted.error.message);
    const subjectId = submitted.data as string;

    // Update review_subjects metadata to track resubmitted status and timestamp
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: currentSubj } = await supabaseAdmin
        .from("review_subjects")
        .select("metadata")
        .eq("id", subjectId)
        .maybeSingle();

      const existingMeta = (currentSubj?.metadata as Record<string, unknown>) ?? {};
      await supabaseAdmin
        .from("review_subjects")
        .update({
          current_status: "pending",
          updated_at: new Date().toISOString(),
          metadata: {
            ...existingMeta,
            review_status: "resubmitted",
            resubmitted_at: new Date().toISOString(),
          },
        })
        .eq("id", subjectId);
    } catch {
      // Non-critical metadata update failure
    }

    return { draftId, subjectId, status: "submitted" };
  });
