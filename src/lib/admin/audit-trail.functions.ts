import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission } from "@/lib/auth/permissions.server";
import { AUDIT_SOURCES, type AuditEntry, type AuditSource } from "./audit-labels";

// Jejak Audit (Slide 42-45, 49 baris 8): one read-only view over the audit tables
// the system already writes. Admin-only (audit.read). The service-role client is
// needed because learning_audit_log and review_subject_status_history are not
// readable by any signed-in role, by design.
//
// Some of these tables are missing from the generated Database type; the untyped
// boundary stays inside this server-only module.
/* eslint-disable @typescript-eslint/no-explicit-any */

const PAGE_SIZE = 50;

const Input = z.object({
  source: z.union([z.literal("all"), z.enum(AUDIT_SOURCES)]).default("all"),
  // Event codes are snake_case; anything else is refused instead of escaped.
  search: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z0-9_ .-]*$/i, "Kata kunci hanya huruf, angka, spasi, titik, garis bawah, atau tanda minus.")
    .default(""),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  before: z.string().datetime({ offset: true }).optional(),
});

type Query = any;

// "before" is inclusive: rows written in one transaction share now(), and an
// exclusive cursor would drop the ones left past the page edge. The page drops
// the repeats by key.
function applyWindow(q: Query, column: string, input: z.infer<typeof Input>): Query {
  let out = q;
  if (input.before) out = out.lte(column, input.before);
  if (input.from) out = out.gte(column, input.from);
  if (input.to) out = out.lt(column, input.to);
  return out.order(column, { ascending: false }).limit(PAGE_SIZE);
}

export const listAuditTrail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input) => Input.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ items: AuditEntry[]; nextBefore: string | null }> => {
    await requirePermission(context, "audit.read");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    // Spaces become "_" (a one-character wildcard in ILIKE), so "role assigned" finds role_assigned.
    const like = data.search ? `%${data.search.replace(/\s+/g, "_")}%` : null;
    const wants = (s: AuditSource) => data.source === "all" || data.source === s;

    const tasks: Array<Promise<AuditEntry[]>> = [];

    if (wants("admin")) {
      let q = db
        .from("admin_audit_log")
        .select("id, event_type, actor_id, target_user_id, entity_type, entity_id, before_data, after_data, metadata, created_at");
      if (like) q = q.ilike("event_type", like);
      tasks.push(
        applyWindow(q, "created_at", data).then(({ data: rows, error }: any) => {
          if (error) throw new Error(error.message);
          return (rows ?? []).map((r: any): AuditEntry => ({
            key: `admin-${r.id}`,
            source: "admin",
            eventType: r.event_type,
            at: r.created_at,
            actorId: r.actor_id,
            actorName: null,
            targetUserId: r.target_user_id,
            targetName: null,
            entityType: r.entity_type,
            entityId: r.entity_id,
            subjectId: null,
            subjectTitle: null,
            before: r.before_data,
            after: r.after_data,
            details: r.metadata && Object.keys(r.metadata).length ? r.metadata : null,
          }));
        }),
      );
    }

    if (wants("governance")) {
      let q = db
        .from("governance_audit_log")
        .select("id, event_type, actor_id, subject_id, entity_type, entity_id, before, after, created_at");
      if (like) q = q.ilike("event_type", like);
      tasks.push(
        applyWindow(q, "created_at", data).then(({ data: rows, error }: any) => {
          if (error) throw new Error(error.message);
          return (rows ?? []).map((r: any): AuditEntry => ({
            key: `governance-${r.id}`,
            source: "governance",
            eventType: r.event_type,
            at: r.created_at,
            actorId: r.actor_id,
            actorName: null,
            targetUserId: null,
            targetName: null,
            entityType: r.entity_type,
            entityId: r.entity_id,
            subjectId: r.subject_id,
            subjectTitle: null,
            before: r.before,
            after: r.after,
            details: null,
          }));
        }),
      );
    }

    if (wants("learning")) {
      let q = db.from("learning_audit_log").select("id, event_type, actor_id, entity_type, entity_id, details, created_at");
      if (like) q = q.ilike("event_type", like);
      tasks.push(
        applyWindow(q, "created_at", data).then(({ data: rows, error }: any) => {
          if (error) throw new Error(error.message);
          return (rows ?? []).map((r: any): AuditEntry => ({
            key: `learning-${r.id}`,
            source: "learning",
            eventType: r.event_type,
            at: r.created_at,
            actorId: r.actor_id,
            actorName: null,
            targetUserId: null,
            targetName: null,
            entityType: r.entity_type,
            entityId: r.entity_id,
            subjectId: null,
            subjectTitle: null,
            before: null,
            after: null,
            details: r.details && Object.keys(r.details).length ? r.details : null,
          }));
        }),
      );
    }

    if (wants("status")) {
      let q = db
        .from("review_subject_status_history")
        .select("id, subject_id, subject_kind, from_status, to_status, changed_by, changed_at, is_backfill");
      // The status rows have no event code; the keyword matches the new status or the kind.
      if (like) q = q.or(`to_status.ilike.${like},subject_kind.ilike.${like}`);
      tasks.push(
        applyWindow(q, "changed_at", data).then(({ data: rows, error }: any) => {
          if (error) throw new Error(error.message);
          return (rows ?? []).map((r: any): AuditEntry => ({
            key: `status-${r.id}`,
            source: "status",
            eventType: "status_changed",
            at: r.changed_at,
            actorId: r.changed_by,
            actorName: null,
            targetUserId: null,
            targetName: null,
            entityType: r.subject_kind,
            entityId: null,
            subjectId: r.subject_id,
            subjectTitle: null,
            before: r.from_status ? { status: r.from_status } : null,
            after: { status: r.to_status },
            details: r.is_backfill ? { catatan: "diisi ulang dari data lama (backfill)" } : null,
          }));
        }),
      );
    }

    const merged = (await Promise.all(tasks))
      .flat()
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      .slice(0, PAGE_SIZE);

    const userIds = [...new Set(merged.flatMap((e) => [e.actorId, e.targetUserId]).filter(Boolean))] as string[];
    const subjectIds = [...new Set(merged.map((e) => e.subjectId).filter(Boolean))] as string[];
    const [profiles, subjects] = await Promise.all([
      userIds.length
        ? db.from("profiles").select("id, display_name").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      subjectIds.length
        ? db.from("review_subjects").select("id, title").in("id", subjectIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (profiles.error) throw new Error(profiles.error.message);
    if (subjects.error) throw new Error(subjects.error.message);
    const nameOf = new Map<string, string>((profiles.data ?? []).map((p: any) => [p.id, p.display_name || ""]));
    const titleOf = new Map<string, string>((subjects.data ?? []).map((s: any) => [s.id, s.title]));

    const items = merged.map((e) => ({
      ...e,
      actorName: e.actorId ? nameOf.get(e.actorId) || null : null,
      targetName: e.targetUserId ? nameOf.get(e.targetUserId) || null : null,
      subjectTitle: e.subjectId ? titleOf.get(e.subjectId) ?? null : null,
    }));
    return { items, nextBefore: items.length === PAGE_SIZE ? items[items.length - 1].at : null };
  });
