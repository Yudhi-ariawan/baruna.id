import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission } from "@/lib/auth/permissions.server";
import type { ConsoleMenuKey } from "./console-access.functions";

// Sidebar badges: how many items wait in each queue, so a curator sees new work
// without opening every menu. Counts only (head requests), and only for menus the
// account may open; the rule is the one each queue page uses for "Menunggu".
// The service-role client is used for counting because several queues are not
// readable through RLS; access is checked first (readConsoleAccess / users.read).

export type ConsoleBadges = Partial<Record<ConsoleMenuKey, number>>;
export type AdminBadges = { accessRequests?: number; trainerApplications?: number };

/** review_subjects still in the review chain (same as the "Menunggu" tabs). */
const OPEN_REVIEW = ["pending", "under_review", "decision_pending"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CountQuery = PromiseLike<{ count: number | null; error: any }>;

/** A failed count hides that one badge instead of breaking the sidebar. */
async function countOf(query: CountQuery): Promise<number | undefined> {
  try {
    const { count, error } = await query;
    return error ? undefined : (count ?? 0);
  } catch {
    return undefined;
  }
}

export const getConsoleBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConsoleBadges> => {
    const { readConsoleAccess } = await import("./console-access.server");
    const access = await readConsoleAccess(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const head = (table: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any).from(table).select("id", { count: "exact", head: true });
    const review = (kind: string) => head("review_subjects").eq("kind", kind).in("current_status", OPEN_REVIEW);

    const queries: Partial<Record<ConsoleMenuKey, () => CountQuery>> = {
      experts: () => review("expert"),
      modules: () => review("module"),
      publications: () => review("knowledge_resource"),
      trainingNeeds: () => review("training_need"),
      enrollments: () => head("course_enrollment_applications").eq("status", "pending"),
      completions: () => head("course_completions").eq("status", "pending_review"),
      programs: () => head("academy_program_drafts").eq("status", "submitted"),
      masterData: () => head("master_data_change_requests").eq("status", "pending"),
    };
    const keys = (Object.keys(queries) as ConsoleMenuKey[]).filter((k) => access.menus[k]?.read);
    const values = await Promise.all(keys.map((k) => countOf(queries[k]!())));
    const out: ConsoleBadges = {};
    keys.forEach((k, i) => {
      if (values[i] !== undefined) out[k] = values[i];
    });
    return out;
  });

export const getAdminBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminBadges> => {
    await requirePermission(context, "users.read");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [accessRequests, trainerApplications] = await Promise.all([
      countOf(supabaseAdmin.from("rbac_role_change_requests").select("id", { count: "exact", head: true }).eq("status", "pending")),
      countOf(supabaseAdmin.from("expert_trainer_applications").select("id", { count: "exact", head: true }).eq("status", "submitted")),
    ]);
    return { accessRequests, trainerApplications };
  });
