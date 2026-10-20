// ============================================================================
// Governance roles, read with the database's own rule.
// ----------------------------------------------------------------------------
// public.has_role(_user_id, _role) is the single source: since migration
// 20261020070000 it reads rbac_user_roles (active, within its validity window,
// profile active; super_admin counts as admin). Every RLS policy and RPC of the
// governance layer uses the same function, so the pages show exactly the access
// the database grants. The legacy user_roles table is no longer read.
// ============================================================================

export const GOVERNANCE_ROLES = ["admin", "management", "qa_reviewer"] as const;
export type GovernanceRole = (typeof GOVERNANCE_ROLES)[number];

// Supabase clients (user or service role); typed loosely like the other
// governance helpers because the generated RPC names are a closed union.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RpcClient = any;

export async function hasGovernanceRole(
  client: RpcClient,
  userId: string,
  role: GovernanceRole,
): Promise<boolean> {
  const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: role });
  if (error) throw new Error((error as { message?: string }).message ?? "role_check_failed");
  return Boolean(data);
}

/** The caller's governance roles, in GOVERNANCE_ROLES order. */
export async function getGovernanceRoles(context: {
  supabase: RpcClient;
  userId: string;
}): Promise<GovernanceRole[]> {
  const granted = await Promise.all(
    GOVERNANCE_ROLES.map(async (role) =>
      (await hasGovernanceRole(context.supabase, context.userId, role)) ? role : null,
    ),
  );
  return granted.filter((role): role is GovernanceRole => role !== null);
}
