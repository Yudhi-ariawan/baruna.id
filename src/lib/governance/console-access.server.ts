// ============================================================================
// Curation console access — server only.
// ----------------------------------------------------------------------------
// What the signed-in account may see and do in /governance, per menu. Nothing
// here is a new rule: every answer comes from the check that the menu's own
// server functions and decision RPCs already enforce, so the console can never
// show a button the server would refuse (and the server still checks anyway).
//
//   Verifikasi Expert     getExpertGovernanceAccess (experts.functions)
//   Verifikasi Modul      assertAdminOrReviewer (modules.functions) + _can_decide_review
//   Verifikasi Publikasi  assertAdminOrReviewer (publications.functions) + _can_decide_review
//   Persetujuan Peserta   assertAdminAccess (enrollments.functions) = _is_enrollment_admin
//   Permintaan Pelatihan  has_role(admin|management|qa_reviewer); decide = admin|management
// ============================================================================
import type { ConsoleAccess } from "./console-access.functions";
import { getGovernanceRoles } from "./governance-roles";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { supabase: any; userId: string };

export async function readConsoleAccess(context: Ctx): Promise<ConsoleAccess> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getExpertGovernanceAccess } = await import("@/lib/admin/experts.functions");
  const { assertAdminOrReviewer: canReadModules } = await import("@/lib/admin/modules.functions");
  const { assertAdminOrReviewer: canReadPublications } = await import("@/lib/admin/publications.functions");
  const { assertAdminAccess: canUseEnrollments } = await import("@/lib/admin/enrollments.functions");

  const now = new Date().toISOString();
  const [experts, modulesRead, publicationsRead, enrollments, governanceRoles, decideReview, roleRows, isAdmin] =
    await Promise.all([
      getExpertGovernanceAccess(context),
      canReadModules(context),
      canReadPublications(context),
      canUseEnrollments(context),
      getGovernanceRoles(context),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any).rpc("_can_decide_review", { _uid: context.userId }),
      context.supabase
        .from("rbac_user_roles")
        .select("rbac_roles!inner(code)")
        .eq("user_id", context.userId)
        .eq("status", "active")
        .lte("valid_from", now)
        .or(`valid_until.is.null,valid_until.gt.${now}`),
      context.supabase.rpc("_is_service_admin", { _user_id: context.userId }),
    ]);

  if (decideReview.error) throw new Error(`Gagal memeriksa hak keputusan: ${decideReview.error.message}`);
  const canDecideReview = Boolean(decideReview.data);
  const trainingRead = governanceRoles.length > 0;
  const trainingDecide = governanceRoles.includes("admin") || governanceRoles.includes("management");

  const roles = Array.from(
    new Set(
      ((roleRows.data ?? []) as Array<{ rbac_roles: { code: string } | { code: string }[] }>).flatMap((row) =>
        Array.isArray(row.rbac_roles) ? row.rbac_roles.map((r) => r.code) : [row.rbac_roles.code],
      ),
    ),
  ).sort();

  return {
    roles,
    isAdmin: Boolean(isAdmin.data),
    menus: {
      experts: { read: experts.canRead, decide: experts.canRead && experts.canDecide },
      modules: { read: Boolean(modulesRead), decide: Boolean(modulesRead) && canDecideReview },
      publications: { read: Boolean(publicationsRead), decide: Boolean(publicationsRead) && canDecideReview },
      enrollments: { read: Boolean(enrollments), decide: Boolean(enrollments) },
      trainingNeeds: { read: trainingRead, decide: trainingDecide },
    },
  };
}
