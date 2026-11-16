import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission } from "@/lib/auth/permissions.server";
import { decideRoleChange } from "@/lib/auth/role-governance.server";
import { NOTE_MAX, roleRequestError, type RoleRequestStatus } from "@/lib/account/role-requests.shared";

// Permintaan Akses, Admin Portal side (Slide 42). Every admin may read the queue
// (users.read, the Admin Portal door); only roles.manage (super admin) decides, and
// decide_rbac_role_change checks that itself, plus "not your own request".
// The service-role client is used only for reading: RLS shows the requests to their
// owner and to roles.manage only, and the Admin Portal is wider than that.

export type AccessRequestRow = {
  id: string;
  role: string;
  action: "grant" | "revoke";
  status: RoleRequestStatus;
  reason: string;
  validUntil: string | null;
  createdAt: string;
  decisionNote: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  target: {
    id: string;
    name: string;
    email: string | null;
    organization: string | null;
    jobTitle: string | null;
    activeRoles: string[];
  };
  requestedBySelf: boolean;
};

async function canManageRoles(context: { supabase: unknown }): Promise<boolean> {
  const client = context.supabase as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await client.rpc("current_user_has_permission", { _permission: "roles.manage" });
  return !error && data === true;
}

export const listAccessRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ view: z.enum(["pending", "decided"]).default("pending") }).parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ items: AccessRequestRow[]; canDecide: boolean; me: string }> => {
    await requirePermission(context, "users.read");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("rbac_role_change_requests")
      .select(
        "id, target_user_id, requested_by, action, status, reason, requested_valid_until, decision_note, created_at, reviewed_at, reviewed_by, rbac_roles!inner(code)",
      );
    q =
      data.view === "pending"
        ? q.eq("status", "pending").order("created_at", { ascending: true })
        : q.neq("status", "pending").order("reviewed_at", { ascending: false, nullsFirst: false });
    const { data: rows, error } = await q.limit(100);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as unknown as Array<{
      id: string;
      target_user_id: string;
      requested_by: string;
      action: "grant" | "revoke";
      status: RoleRequestStatus;
      reason: string;
      requested_valid_until: string | null;
      decision_note: string | null;
      created_at: string;
      reviewed_at: string | null;
      reviewed_by: string | null;
      rbac_roles: { code: string } | null;
    }>;

    const targetIds = [...new Set(list.map((r) => r.target_user_id))];
    const peopleIds = [...new Set([...targetIds, ...list.map((r) => r.reviewed_by).filter(Boolean)])] as string[];
    const now = new Date().toISOString();
    const [profiles, roles, emails, canDecide] = await Promise.all([
      peopleIds.length
        ? supabaseAdmin.from("profiles").select("id, display_name, organization, job_title").in("id", peopleIds)
        : Promise.resolve({ data: [], error: null }),
      targetIds.length
        ? supabaseAdmin
            .from("rbac_user_roles")
            .select("user_id, rbac_roles!inner(code)")
            .in("user_id", targetIds)
            .eq("status", "active")
            .lte("valid_from", now)
            .or(`valid_until.is.null,valid_until.gt.${now}`)
        : Promise.resolve({ data: [], error: null }),
      // profiles has no email column; auth is the source (at most 100 distinct users).
      Promise.all(
        targetIds.map(async (id) => {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
          return [id, u?.user?.email ?? null] as const;
        }),
      ),
      canManageRoles(context),
    ]);
    if (profiles.error) throw new Error(profiles.error.message);
    if (roles.error) throw new Error(roles.error.message);

    const profileOf = new Map(
      ((profiles.data ?? []) as Array<{ id: string; display_name: string | null; organization: string | null; job_title: string | null }>).map(
        (p) => [p.id, p],
      ),
    );
    const rolesOf = new Map<string, string[]>();
    for (const r of (roles.data ?? []) as unknown as Array<{ user_id: string; rbac_roles: { code: string } | null }>) {
      if (!r.rbac_roles) continue;
      const set = rolesOf.get(r.user_id) ?? [];
      if (!set.includes(r.rbac_roles.code)) set.push(r.rbac_roles.code);
      rolesOf.set(r.user_id, set);
    }
    const emailOf = new Map(emails);

    return {
      canDecide,
      me: context.userId,
      items: list.map((r) => {
        const p = profileOf.get(r.target_user_id);
        return {
          id: r.id,
          role: r.rbac_roles?.code ?? "",
          action: r.action,
          status: r.status,
          reason: r.reason,
          validUntil: r.requested_valid_until,
          createdAt: r.created_at,
          decisionNote: r.decision_note,
          reviewedAt: r.reviewed_at,
          reviewerName: r.reviewed_by ? profileOf.get(r.reviewed_by)?.display_name || "Super admin" : null,
          target: {
            id: r.target_user_id,
            name: p?.display_name || "Pengguna tanpa nama",
            email: emailOf.get(r.target_user_id) ?? null,
            organization: p?.organization ?? null,
            jobTitle: p?.job_title ?? null,
            activeRoles: rolesOf.get(r.target_user_id) ?? [],
          },
          requestedBySelf: r.requested_by === r.target_user_id,
        };
      }),
    };
  });

export const decideAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        requestId: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        note: z.string().trim().max(NOTE_MAX).default(""),
      })
      .refine((d) => d.decision === "approve" || d.note.length >= 5, {
        message: "Alasan penolakan wajib diisi (minimal 5 karakter).",
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ result: "applied" | "rejected" }> => {
    try {
      const result = await decideRoleChange(context, data.requestId, data.decision, data.note || undefined);
      return { result };
    } catch (err) {
      throw new Error(roleRequestError(err instanceof Error ? err.message : String(err)));
    }
  });
