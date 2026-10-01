import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { BusinessPermission } from "@/lib/auth/rbac.types";

export type CorePermission =
  | "users.read"
  | "users.update"
  | "users.invite"
  | "users.suspend"
  | "users.assign_role"
  | "roles.read"
  | "roles.manage"
  | "audit.read"
  | "governance.read"
  | "governance.manage";

export type Permission = CorePermission | BusinessPermission;

type AuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

export async function hasPermission(
  context: AuthContext,
  permission: Permission,
): Promise<boolean> {
  if (!context?.userId) return false;

  const now = new Date().toISOString();
  try {
    // 1. Super admin and admin have full system permissions
    const { data: adminRoles } = await context.supabase
      .from("rbac_user_roles")
      .select("rbac_roles!inner(code)")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .lte("valid_from", now)
      .or(`valid_until.is.null,valid_until.gt.${now}`)
      .in("rbac_roles.code", ["super_admin", "admin", "management"]);

    if (adminRoles && adminRoles.length > 0) {
      return true;
    }
  } catch (err) {
    console.warn("Direct role check failed, falling back to RPC:", err);
  }

  // 2. Fallback to SQL RPC
  try {
    const client = context.supabase as unknown as {
      rpc: (
        name: "current_user_has_permission",
        args: { _permission: string },
      ) => Promise<{
        data: boolean | null;
        error: { message?: string } | null;
      }>;
    };
    const { data, error } = await client.rpc("current_user_has_permission", {
      _permission: permission,
    });
    if (!error && data === true) return true;
  } catch (err) {
    console.warn("RPC permission check failed:", err);
  }

  return false;
}

/** Fail closed. Call this before importing or using the service-role client. */
export async function requirePermission(
  context: AuthContext,
  permission: Permission,
): Promise<void> {
  if (!(await hasPermission(context, permission))) {
    throw new Error("forbidden");
  }
}
