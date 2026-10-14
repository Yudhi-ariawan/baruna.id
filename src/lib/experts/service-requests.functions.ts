import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toFriendlyServiceError } from "./service-request-errors";

/** Requester answers an "information requested" question (PB-EXP-03). */
export const replyToServiceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ requestId: z.string().uuid(), message: z.string().trim().min(5).max(2000) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("expert_service_request_reply", {
      _request_id: data.requestId,
      _message: data.message,
    });
    if (error) throw new Error(toFriendlyServiceError(error.message));
    return result as { id: string; status: string };
  });

/** Requester withdraws a live request. Completed/declined requests stay closed. */
export const cancelMyServiceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ requestId: z.string().uuid(), reason: z.string().trim().max(2000).optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("expert_service_request_cancel", {
      _request_id: data.requestId,
      _reason: data.reason || null,
    });
    if (error) throw new Error(toFriendlyServiceError(error.message));
    return result as { id: string; status: string };
  });
