import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { ServiceRequest } from "@/lib/experts/portal-services.types";
import { toFriendlyServiceError } from "@/lib/experts/service-request-errors";

/**
 * PB-EXP-03 Expert Assignment console. Every check (admin role, state machine,
 * optimistic lock, conflict of interest, facilitation history) lives in the
 * SECURITY DEFINER RPCs; these functions only validate input shape.
 */

export type AdminServiceRequest = ServiceRequest & {
  submittedAt: string | null;
  requesterId: string;
  requesterName: string | null;
  requesterEmail: string | null;
  assignedAt: string | null;
  facilitationHistoryId: string | null;
};

export type AdminServiceRequestPage = {
  items: AdminServiceRequest[];
  total: number;
  counts: { open: number; unassigned: number; confirmed: number; completed: number; closed: number };
};

export type AssignableExpert = {
  id: string;
  name: string;
  slug: string;
  headline: string | null;
  country: string | null;
  expertiseAreas: string[];
  ownerId: string | null;
  openAssignments: number;
};

export const ADMIN_SERVICE_REQUEST_FILTERS = [
  "open", "unassigned", "information_requested", "confirmed", "scheduled", "completed", "declined", "cancelled", "all",
] as const;

export const listAdminServiceRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        status: z.enum(ADMIN_SERVICE_REQUEST_FILTERS).default("open"),
        search: z.string().trim().max(120).default(""),
        page: z.number().int().min(0).max(10_000).default(0),
        pageSize: z.number().int().min(1).max(100).default(25),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<AdminServiceRequestPage> => {
    const { data: result, error } = await context.supabase.rpc("admin_service_requests_list", {
      _status: data.status,
      _search: data.search || null,
      _limit: data.pageSize,
      _offset: data.page * data.pageSize,
    });
    if (error) throw new Error(toFriendlyServiceError(error.message));
    return result as unknown as AdminServiceRequestPage;
  });

export const listAssignableExperts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ search: z.string().trim().max(120).default("") }).parse(input ?? {}))
  .handler(async ({ context, data }): Promise<AssignableExpert[]> => {
    const { data: result, error } = await context.supabase.rpc("admin_service_request_assignable_experts", {
      _search: data.search || null,
    });
    if (error) throw new Error(toFriendlyServiceError(error.message));
    return (result ?? []) as unknown as AssignableExpert[];
  });

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD");

const Completion = z
  .object({
    activityTitle: z.string().trim().min(3).max(240),
    organizer: z.string().trim().max(240).optional(),
    startDate: IsoDate.optional(),
    endDate: IsoDate.optional(),
    participantCount: z.number().int().min(0).max(100_000).optional(),
    country: z.string().trim().max(120).optional(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
    path: ["endDate"],
  });

export const ADMIN_SERVICE_ACTIONS = [
  "review", "matching", "assign", "request_info", "schedule", "complete", "decline", "cancel",
] as const;
export type AdminServiceAction = (typeof ADMIN_SERVICE_ACTIONS)[number];

export const transitionAdminServiceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        requestId: z.string().uuid(),
        action: z.enum(ADMIN_SERVICE_ACTIONS),
        // Raw updated_at string from the list payload (microsecond precision):
        // never round-trip it through Date, or the optimistic lock always fails.
        expectedUpdatedAt: z.string().min(10).max(64),
        message: z.string().trim().max(2000).optional(),
        expertId: z.string().uuid().optional(),
        completion: Completion.optional(),
      })
      .superRefine((v, ctx) => {
        if (v.action === "assign" && !v.expertId) {
          ctx.addIssue({ code: "custom", path: ["expertId"], message: "Pilih expert terlebih dahulu." });
        }
        if (v.action === "complete" && !v.completion) {
          ctx.addIssue({ code: "custom", path: ["completion"], message: "Lengkapi data riwayat fasilitasi." });
        }
        if (["request_info", "decline", "cancel"].includes(v.action) && (v.message?.length ?? 0) < 5) {
          ctx.addIssue({ code: "custom", path: ["message"], message: "Pesan wajib diisi (minimal 5 karakter)." });
        }
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("admin_service_request_transition", {
      _request_id: data.requestId,
      _action: data.action,
      _expected_updated_at: data.expectedUpdatedAt,
      _message: data.message || null,
      _expert_id: data.expertId ?? null,
      _completion: (data.completion ?? null) as Json,
    });
    if (error) throw new Error(toFriendlyServiceError(error.message));
    return result as { id: string; status: string };
  });
