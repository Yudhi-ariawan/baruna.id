import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SelfPacedEnrollmentPayload = {
  code: string;
  enrolledAt: number;
  completed: boolean;
  completedAt?: number;
  score?: number;
  source?: "self-paced" | "full-training-program";
  title?: string;
  hours?: number | string;
  instructor?: string;
  category?: string;
  completedSteps?: {
    video?: boolean;
    pdf?: boolean;
    ppt?: boolean;
    quiz?: boolean;
  };
};

const SelfPacedPayloadSchema = z.object({
  courses: z.record(
    z.string(),
    z.object({
      code: z.string(),
      enrolledAt: z.number().optional().default(() => Date.now()),
      completed: z.boolean().optional().default(false),
      completedAt: z.number().optional(),
      score: z.number().optional(),
      source: z.enum(["self-paced", "full-training-program"]).optional().default("self-paced"),
      title: z.string().optional(),
      hours: z.union([z.string(), z.number()]).optional(),
      instructor: z.string().optional(),
      category: z.string().optional(),
      completedSteps: z
        .object({
          video: z.boolean().optional(),
          pdf: z.boolean().optional(),
          ppt: z.boolean().optional(),
          quiz: z.boolean().optional(),
        })
        .optional(),
    }),
  ),
});

/**
 * Fetch authenticated user's self-paced course enrollments from Supabase.
 * Multi-source fallback: checks `self_paced_enrollments` table, then `user_metadata`.
 */
export const getMySelfPacedCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, SelfPacedEnrollmentPayload>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result: Record<string, SelfPacedEnrollmentPayload> = {};

    // 1. Try reading from auth.users.user_metadata first for fast, reliable access
    try {
      const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const meta = (userRecord?.user?.user_metadata as Record<string, any>) || {};
      const metaCourses = (meta.self_paced_courses as Record<string, SelfPacedEnrollmentPayload>) || {};
      if (metaCourses && typeof metaCourses === "object") {
        for (const [code, item] of Object.entries(metaCourses)) {
          if (item && item.code) {
            result[code] = item;
          }
        }
      }
    } catch (metaErr) {
      console.warn("[getMySelfPacedCourses] user_metadata lookup warning:", metaErr);
    }

    // 2. Query primary table `self_paced_enrollments`
    try {
      const { data: rows, error: tableErr } = await (supabaseAdmin as any)
        .from("self_paced_enrollments")
        .select("*")
        .eq("user_id", context.userId);

      if (!tableErr && Array.isArray(rows)) {
        for (const row of rows) {
          const enrolledAtNum = row.enrolled_at ? new Date(row.enrolled_at).getTime() : Date.now();
          const completedAtNum = row.completed_at ? new Date(row.completed_at).getTime() : undefined;
          
          const existing = result[row.code];
          // Take the one with higher completion / progress
          if (!existing || (!existing.completed && row.completed)) {
            result[row.code] = {
              code: row.code,
              enrolledAt: enrolledAtNum,
              completed: Boolean(row.completed),
              completedAt: completedAtNum,
              score: row.score ? Number(row.score) : undefined,
              source: row.source || "self-paced",
              title: row.title || undefined,
              hours: row.hours || undefined,
              instructor: row.instructor || undefined,
              category: row.category || undefined,
              completedSteps: (row.completed_steps as any) || {},
            };
          }
        }
      }
    } catch (tableErr) {
      console.warn("[getMySelfPacedCourses] table query warning:", tableErr);
    }

    return result;
  });

/**
 * Synchronize local self-paced enrollments with Supabase server.
 * Merges local and remote data, updates both `self_paced_enrollments` table and `auth.users.user_metadata`.
 */
export const syncMySelfPacedCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => SelfPacedPayloadSchema.parse(input))
  .handler(async ({ data, context }): Promise<Record<string, SelfPacedEnrollmentPayload>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const coursesToSync = data.courses;

    // 1. Fetch current server state to merge
    let currentRemote: Record<string, SelfPacedEnrollmentPayload> = {};
    try {
      const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const meta = (userRecord?.user?.user_metadata as Record<string, any>) || {};
      if (meta.self_paced_courses && typeof meta.self_paced_courses === "object") {
        currentRemote = { ...meta.self_paced_courses };
      }
    } catch {}

    // Merge: combine courses, keeping best score & highest completion
    const merged: Record<string, SelfPacedEnrollmentPayload> = { ...currentRemote };
    for (const [code, incoming] of Object.entries(coursesToSync)) {
      const existing = merged[code];
      if (!existing) {
        merged[code] = incoming;
      } else {
        // Merge steps
        const mergedSteps = {
          ...(existing.completedSteps || {}),
          ...(incoming.completedSteps || {}),
        };
        const completed = existing.completed || incoming.completed;
        const score = Math.max(existing.score || 0, incoming.score || 0) || undefined;
        merged[code] = {
          ...existing,
          ...incoming,
          completed,
          completedAt: completed ? (existing.completedAt || incoming.completedAt || Date.now()) : undefined,
          score,
          completedSteps: mergedSteps,
        };
      }
    }

    const nowIso = new Date().toISOString();

    // 2. Persist to auth.users.user_metadata (100% resilient across devices)
    try {
      const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const meta = (userRecord?.user?.user_metadata as Record<string, any>) || {};
      await supabaseAdmin.auth.admin.updateUserById(context.userId, {
        user_metadata: {
          ...meta,
          self_paced_courses: merged,
        },
      });
    } catch (metaErr) {
      console.warn("[syncMySelfPacedCourses] user_metadata sync warning:", metaErr);
    }

    // 3. Upsert to `self_paced_enrollments` table
    try {
      const upsertRows = Object.values(merged).map((c) => ({
        user_id: context.userId,
        code: c.code,
        title: c.title || null,
        hours: c.hours ? String(c.hours) : null,
        instructor: c.instructor || null,
        category: c.category || null,
        score: c.score ?? null,
        source: c.source || "self-paced",
        completed: c.completed,
        completed_at: c.completedAt ? new Date(c.completedAt).toISOString() : null,
        completed_steps: c.completedSteps || {},
        enrolled_at: c.enrolledAt ? new Date(c.enrolledAt).toISOString() : nowIso,
        updated_at: nowIso,
      }));

      if (upsertRows.length > 0) {
        await (supabaseAdmin as any)
          .from("self_paced_enrollments")
          .upsert(upsertRows, { onConflict: "user_id, code" });
      }
    } catch (tableErr) {
      console.warn("[syncMySelfPacedCourses] table upsert warning:", tableErr);
    }

    return merged;
  });
