import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Roles that get at least one place in the curation console (Slide 16):
 * reviewer/verifier read the verification queues, approver decides, operator
 * handles enrollments, publisher sees the console home, admins see everything.
 * Only decides whether links to /governance are shown; the console itself
 * opens on getGovernanceConsoleAccess.
 */
export const CURATION_CONSOLE_ROLE_CODES = [
  "super_admin",
  "admin",
  "approver",
  "verifier",
  "reviewer",
  "operator",
  "publisher",
] as const;

/** Roles of the system administration portal (/admin, gate users.read). */
export const ADMIN_PORTAL_ROLE_CODES = ["super_admin", "admin"] as const;

export type ConsoleMenuKey ="experts" | "modules" | "publications" | "enrollments" | "trainingNeeds";

export type ConsoleMenuAccess = {
  /** May open the queue and read the submissions. */
  read: boolean;
  /** May take the final decision (approve/reject/archive/...); the server still checks. */
  decide: boolean;
};

export type ConsoleAccess = {
  /** Active RBAC role codes, for display. */
  roles: string[];
  /** Admin or super admin (system administration, /admin). */
  isAdmin: boolean;
  menus: Record<ConsoleMenuKey, ConsoleMenuAccess>;
};

/** Menus and actions of the /governance curation console for the signed-in account. */
export const getGovernanceConsoleAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConsoleAccess> => {
    const { readConsoleAccess } = await import("./console-access.server");
    return readConsoleAccess(context);
  });

/**
 * May open the console: at least one readable menu, or the publisher role (no
 * separate publication step exists yet, so publishers see the console home
 * with that explanation instead of being turned away).
 */
export function hasConsoleAccess(access: ConsoleAccess | undefined): boolean {
  return Boolean(
    access && (Object.values(access.menus).some((menu) => menu.read) || access.roles.includes("publisher")),
  );
}
