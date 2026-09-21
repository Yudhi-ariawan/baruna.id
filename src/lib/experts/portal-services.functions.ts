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
    return data as unknown as TrainerPortalBootstrap;
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
    const created = await context.supabase.rpc("module_draft_create", {
      _title: data.title, _module_type: data.moduleType, _source_type: "external_submission",
    });
    if (created.error) throw new Error(created.error.message);
    const draftId = created.data as string;
    const updated = await context.supabase.rpc("module_draft_update", { _draft_id: draftId, _patch: data.payload as Json });
    if (updated.error) throw new Error(updated.error.message);
    if (!data.submit) return { draftId, subjectId: null, status: "draft" };
    const submitted = await context.supabase.rpc("module_draft_submit", { _draft_id: draftId });
    if (submitted.error) throw new Error(submitted.error.message);
    return { draftId, subjectId: submitted.data as string, status: "submitted" };
  });
