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

/** Check the authenticated caller, including profile and assignment lifecycle. */
export async function hasPermission(
  context: AuthContext,
  permission: Permission,
): Promise<boolean> {
  // Generated database types are refreshed after the remote migration is applied.
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
  if (error) throw new Error(error.message ?? "permission_check_failed");
  return data === true;
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
