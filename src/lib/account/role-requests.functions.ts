import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requestRoleChange } from "@/lib/auth/role-governance.server";
import {
  REASON_MAX,
  REASON_MIN,
  REQUESTABLE_ROLES,
  roleName,
  roleRequestError,
  type MyRoleRequest,
  type RoleRequestStatus,
} from "./role-requests.shared";

// Permintaan Akses / Peran, user side (Slide 42). Everything runs with the caller's
// own session: RLS lets a user read only their own requests, and the database
// function request_rbac_role_change records the request and its audit row.

type Row = {
  id: string;
  action: "grant" | "revoke";
  status: RoleRequestStatus;
  reason: string;
  requested_valid_until: string | null;
  decision_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  rbac_roles: { code: string } | null;
};

export const getMyRoleRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ requests: MyRoleRequest[]; activeRoles: string[] }> => {
    const now = new Date().toISOString();
    const [requests, roles] = await Promise.all([
      context.supabase
        .from("rbac_role_change_requests")
        .select("id, action, status, reason, requested_valid_until, decision_note, created_at, reviewed_at, rbac_roles!inner(code)")
        .eq("target_user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(50),
      context.supabase
        .from("rbac_user_roles")
        .select("rbac_roles!inner(code)")
        .eq("user_id", context.userId)
        .eq("status", "active")
        .lte("valid_from", now)
        .or(`valid_until.is.null,valid_until.gt.${now}`),
    ]);
    if (requests.error) throw new Error(requests.error.message);
    if (roles.error) throw new Error(roles.error.message);
    const activeRoles = [
      ...new Set(((roles.data ?? []) as unknown as Array<{ rbac_roles: { code: string } | null }>).map((r) => r.rbac_roles?.code).filter(Boolean)),
    ] as string[];
    return {
      activeRoles,
      requests: ((requests.data ?? []) as unknown as Row[]).map((r) => ({
        id: r.id,
        role: r.rbac_roles?.code ?? "",
        action: r.action,
        status: r.status,
        reason: r.reason,
        validUntil: r.requested_valid_until,
        decisionNote: r.decision_note,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at,
      })),
    };
  });

export const submitRoleRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        role: z.enum(REQUESTABLE_ROLES),
        reason: z.string().trim().min(REASON_MIN, `Alasan minimal ${REASON_MIN} karakter.`).max(REASON_MAX),
        // Optional end of the role, as an ISO instant (the page sends end of the chosen day).
        validUntil: z.string().datetime().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    if (data.validUntil && new Date(data.validUntil) <= new Date()) {
      throw new Error("Tanggal berakhir harus setelah hari ini.");
    }
    // Duplicate check (Slide 42). Not atomic: two requests sent at the same instant can
    // both pass; the decision then only re-activates the same role, nothing breaks.
    const now = new Date().toISOString();
    const [held, pending] = await Promise.all([
      context.supabase
        .from("rbac_user_roles")
        .select("id, rbac_roles!inner(code)")
        .eq("user_id", context.userId)
        .eq("rbac_roles.code", data.role)
        .eq("status", "active")
        .lte("valid_from", now)
        .or(`valid_until.is.null,valid_until.gt.${now}`)
        .limit(1),
      context.supabase
        .from("rbac_role_change_requests")
        .select("id, rbac_roles!inner(code)")
        .eq("target_user_id", context.userId)
        .eq("rbac_roles.code", data.role)
        .eq("status", "pending")
        .limit(1),
    ]);
    if (held.error) throw new Error(held.error.message);
    if (pending.error) throw new Error(pending.error.message);
    if ((held.data ?? []).length) throw new Error(`Anda sudah memiliki peran ${roleName(data.role)}.`);
    if ((pending.data ?? []).length) {
      throw new Error(`Permintaan peran ${roleName(data.role)} Anda masih menunggu keputusan.`);
    }

    try {
      const id = await requestRoleChange(context, {
        targetUserId: context.userId,
        role: data.role,
        action: "grant",
        reason: data.reason,
        validUntil: data.validUntil,
      });
      return { id };
    } catch (err) {
      throw new Error(roleRequestError(err instanceof Error ? err.message : String(err)));
    }
  });
