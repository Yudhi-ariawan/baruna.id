import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { RbacRoleCode } from "@/lib/auth/rbac.types";

type AuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

export type RoleChangeInput = {
  targetUserId: string;
  role: RbacRoleCode;
  action: "grant" | "revoke";
  reason: string;
  scope?: Json;
  validFrom?: string;
  validUntil?: string;
};

export async function requestRoleChange(
  context: AuthContext,
  input: RoleChangeInput,
): Promise<string> {
  const { data, error } = await context.supabase.rpc("request_rbac_role_change", {
    _target_user_id: input.targetUserId,
    _role_code: input.role,
    _action: input.action,
    _reason: input.reason,
    _scope: input.scope ?? {},
    _valid_from: input.validFrom,
    _valid_until: input.validUntil,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function decideRoleChange(
  context: AuthContext,
  requestId: string,
  decision: "approve" | "reject",
  note?: string,
): Promise<"applied" | "rejected"> {
  const { data, error } = await context.supabase.rpc("decide_rbac_role_change", {
    _request_id: requestId,
    _decision: decision,
    _decision_note: note,
  });
  if (error) throw new Error(error.message);
  if (data !== "applied" && data !== "rejected") {
    throw new Error("unexpected_role_change_result");
  }
  return data;
}
