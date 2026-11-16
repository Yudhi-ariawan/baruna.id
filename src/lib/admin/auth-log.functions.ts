import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission } from "@/lib/auth/permissions.server";
import { AUTH_EVENTS, type AuthEvent, type AuthLogEntry } from "./auth-log.shared";

// Authentication Log (Slide 42, LS-01; migration 20261116050000). Read-only, admin
// only (audit.read). The table has no grants for signed-in roles, so the read goes
// through the service-role client after the permission check.
// The table is newer than the generated Database type; the untyped boundary stays here.
/* eslint-disable @typescript-eslint/no-explicit-any */

const PAGE_SIZE = 50;
/** Accounts created by the automated tests (scripts/test-*.mjs). */
const TEST_DOMAIN = "@example.test";

const Input = z.object({
  event: z.union([z.literal("all"), z.enum(AUTH_EVENTS)]).default("all"),
  // Part of an email address; no characters that change the meaning of ILIKE/filters.
  search: z
    .string()
    .trim()
    .max(120)
    .regex(/^[a-z0-9@.+\- ]*$/i, "Kata kunci hanya huruf, angka, titik, @, +, atau tanda minus.")
    .default(""),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  adminsOnly: z.boolean().default(false),
  hideTestAccounts: z.boolean().default(true),
  /** id of the last row already shown (rows are ordered by id, newest first). */
  beforeId: z.number().int().positive().optional(),
});

export const listAuthEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input) => Input.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ items: AuthLogEntry[]; nextBeforeId: number | null }> => {
    await requirePermission(context, "audit.read");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    // Current admins and super admins (to mark them, and for the "admins only" filter).
    const now = new Date().toISOString();
    const { data: adminRows, error: adminError } = await db
      .from("rbac_user_roles")
      .select("user_id, rbac_roles!inner(code)")
      .in("rbac_roles.code", ["admin", "super_admin"])
      .eq("status", "active")
      .lte("valid_from", now)
      .or(`valid_until.is.null,valid_until.gt.${now}`);
    if (adminError) throw new Error(adminError.message);
    const adminIds = [...new Set((adminRows ?? []).map((r: any) => r.user_id as string))];

    let q = db
      .from("auth_event_log")
      .select("id, user_id, email, event, ip, user_agent, created_at")
      .order("id", { ascending: false })
      .limit(PAGE_SIZE);
    if (data.event !== "all") q = q.eq("event", data.event);
    if (data.search) q = q.ilike("email", `%${data.search.replace(/\s+/g, "")}%`);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lt("created_at", data.to);
    if (data.beforeId) q = q.lt("id", data.beforeId);
    if (data.adminsOnly) {
      if (adminIds.length === 0) return { items: [], nextBeforeId: null };
      q = q.in("user_id", adminIds);
    }
    if (data.hideTestAccounts) q = q.or(`email.is.null,email.not.ilike.%${TEST_DOMAIN}`);

    const { data: rows, error } = await q;
    if (error) {
      if (/auth_event_log/.test(error.message)) {
        throw new Error("Tabel log autentikasi belum ada. Jalankan migrasi 20261116050000_auth_event_log.sql.");
      }
      throw new Error(error.message);
    }
    const list = (rows ?? []) as Array<{
      id: number;
      user_id: string | null;
      email: string | null;
      event: AuthEvent;
      ip: string | null;
      user_agent: string | null;
      created_at: string;
    }>;

    const ids = [...new Set(list.map((r) => r.user_id).filter(Boolean))] as string[];
    const { data: profiles } = ids.length
      ? await db.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] };
    const nameOf = new Map<string, string>((profiles ?? []).map((p: any) => [p.id, p.display_name || ""]));
    const admins = new Set(adminIds);

    const items = list.map((r) => ({
      id: r.id,
      event: r.event,
      at: r.created_at,
      userId: r.user_id,
      email: r.email,
      name: r.user_id ? nameOf.get(r.user_id) || null : null,
      isAdmin: r.user_id ? admins.has(r.user_id) : false,
      ip: r.ip,
      userAgent: r.user_agent,
    }));
    return { items, nextBeforeId: items.length === PAGE_SIZE ? items[items.length - 1].id : null };
  });
