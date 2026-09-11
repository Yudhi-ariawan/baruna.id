import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Permission } from "@/lib/auth/permissions.server";

type AuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

/**
 * Check the authenticated caller only. The database function derives the user
 * from auth.uid() and also enforces profile and assignment lifecycle state.
 */
export async function currentUserHasPermission(
  context: AuthContext,
  permission: Permission,
): Promise<boolean> {
  const client = context.supabase as unknown as {
    rpc: (
      name: "current_user_has_permission",
      args: { _permission: string },
    ) => Promise<{ data: boolean | null; error: { message?: string } | null }>;
  };
  const { data, error } = await client.rpc("current_user_has_permission", {
    _permission: permission,
  });
  if (error) throw new Error(error.message ?? "permission_check_failed");
  return data === true;
}

export async function requireCurrentUserPermission(
  context: AuthContext,
  permission: Permission,
): Promise<void> {
  if (!(await currentUserHasPermission(context, permission))) {
    throw new Error("forbidden");
  }
}
