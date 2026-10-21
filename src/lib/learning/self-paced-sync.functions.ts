import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SelfPacedEnrollmentPayload = {
  code: string;
  enrolledAt: number;
  completed: boolean;
  completedAt?: number;
  score?: number;
  /** 'server_quiz' = passed an official quiz graded on the server; 'legacy_browser' = old, unverified. */
  completionSource?: "server_quiz" | "legacy_browser";
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
  explicitlyEnrolled?: boolean;
};

// Lenient on purpose: a single odd local entry must not block every future sync.
// The database (public.self_paced_sync) validates each course and skips bad ones.
const SelfPacedPayloadSchema = z.object({
  courses: z
    .record(
      z.string().max(120),
      z
        .object({
          code: z.string().max(120),
          enrolledAt: z.number().optional(),
          completed: z.boolean().optional().default(false),
          completedAt: z.number().optional(),
          score: z.number().optional(),
          source: z.enum(["self-paced", "full-training-program"]).optional().default("self-paced"),
          title: z.string().max(1000).optional(),
          hours: z.union([z.string().max(100), z.number()]).optional(),
          instructor: z.string().max(1000).optional(),
          category: z.string().max(1000).optional(),
          completedSteps: z
            .object({
              video: z.boolean().optional(),
              pdf: z.boolean().optional(),
              ppt: z.boolean().optional(),
              quiz: z.boolean().optional(),
            })
            .optional(),
          explicitlyEnrolled: z.boolean().optional().default(false),
        })
        .passthrough(),
    )
    .refine((courses) => Object.keys(courses).length <= 200, "Terlalu banyak kursus untuk disinkronkan."),
});

type SelfPacedRow = {
  code: string;
  title: string | null;
  hours: string | null;
  instructor: string | null;
  category: string | null;
  score: number | string | null;
  source: string | null;
  completed: boolean;
  completed_at: string | null;
  completion_source: string | null;
  completed_steps: SelfPacedEnrollmentPayload["completedSteps"] | null;
  enrolled_at: string | null;
};

function rowToPayload(row: SelfPacedRow): SelfPacedEnrollmentPayload {
  return {
    code: row.code,
    enrolledAt: row.enrolled_at ? new Date(row.enrolled_at).getTime() : Date.now(),
    completed: Boolean(row.completed),
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
    completionSource:
      row.completion_source === "server_quiz" || row.completion_source === "legacy_browser"
        ? row.completion_source
        : undefined,
    score: row.score === null || row.score === undefined ? undefined : Number(row.score),
    source: row.source === "full-training-program" ? "full-training-program" : "self-paced",
    title: row.title ?? undefined,
    hours: row.hours ?? undefined,
    instructor: row.instructor ?? undefined,
    category: row.category ?? undefined,
    completedSteps: row.completed_steps ?? {},
    explicitlyEnrolled: true,
  };
}

function legacyMetadataCourses(meta: Record<string, unknown>): Record<string, SelfPacedEnrollmentPayload> {
  const stored = meta.self_paced_courses;
  if (!stored || typeof stored !== "object") return {};
  // Enrolments only: a completion written by the browser into user_metadata is not
  // evidence of a pass (migration 20261021100000).
  return Object.fromEntries(
    Object.entries(stored as Record<string, SelfPacedEnrollmentPayload>)
      .filter(([, course]) => course?.code && course.explicitlyEnrolled === true)
      .map(([code, course]) => [
        code,
        { ...course, completed: false, completedAt: undefined, score: undefined, completionSource: undefined },
      ]),
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readMyCourses(client: any): Promise<Record<string, SelfPacedEnrollmentPayload>> {
  const { data, error } = await client
    .from("self_paced_enrollments")
    .select("code,title,hours,instructor,category,score,source,completed,completed_at,completion_source,completed_steps,enrolled_at")
    .order("code")
    .limit(500);
  if (error) throw new Error(`Gagal memuat progres pelatihan mandiri: ${error.message}`);
  return Object.fromEntries(((data ?? []) as SelfPacedRow[]).map((row) => [row.code, rowToPayload(row)]));
}

function toFriendlySyncError(message: string): string {
  if (message.includes("Could not find the function") || message.includes("schema cache")) {
    return "Sinkron pelatihan mandiri membutuhkan migrasi database 20261020040000.";
  }
  if (message.includes("too_many_courses")) return "Terlalu banyak kursus untuk disinkronkan.";
  return `Gagal menyinkronkan progres pelatihan mandiri: ${message}`;
}

/**
 * The caller's self-paced enrolments. Read-only: the table is the source; courses
 * still parked in legacy user_metadata (written before the table) are shown too
 * and moved into the table by the next sync.
 */
export const getMySelfPacedCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, SelfPacedEnrollmentPayload>> => {
    const fromTable = await readMyCourses(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const legacy = legacyMetadataCourses((userRecord?.user?.user_metadata as Record<string, unknown>) ?? {});
    return { ...legacy, ...fromTable };
  });

/**
 * Saves local progress. Merging happens per row inside ONE database call
 * (public.self_paced_sync) and never lowers progress, so two devices syncing at
 * the same time cannot overwrite each other. Since migration 20261021100000 it
 * stores enrolments and the video/pdf/ppt steps only; a pass comes solely from a
 * quiz graded and recorded on the server.
 */
export const syncMySelfPacedCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => SelfPacedPayloadSchema.parse(input))
  .handler(async ({ data, context }): Promise<Record<string, SelfPacedEnrollmentPayload>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const meta = (userRecord?.user?.user_metadata as Record<string, unknown>) ?? {};
    const legacy = legacyMetadataCourses(meta);

    const courses = Object.fromEntries(
      Object.entries({ ...legacy, ...data.courses }).filter(([, course]) => course.explicitlyEnrolled === true),
    );
    if (Object.keys(courses).length > 0) {
      const { error } = await context.supabase.rpc("self_paced_sync" as never, { _courses: courses } as never);
      if (error) throw new Error(toFriendlySyncError(error.message));
    }

    // Legacy copy now lives in the table; drop it from the login token.
    if (meta.self_paced_courses !== undefined) {
      const { self_paced_courses: _legacy, ...rest } = meta;
      void _legacy;
      const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
        user_metadata: { ...rest, self_paced_courses: null },
      });
      if (metaError) console.error("[syncMySelfPacedCourses] legacy metadata cleanup failed:", metaError.message);
    }

    return readMyCourses(context.supabase);
  });

/** Removes one self-paced enrolment (course reset). RLS allows deleting own rows that are not passed. */
export const deleteMySelfPacedCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ code: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: kept, error: keptError } = await (context.supabase as any)
      .from("self_paced_enrollments")
      .select("code")
      .eq("user_id", context.userId)
      .eq("code", data.code)
      .eq("completed", true)
      .maybeSingle();
    if (keptError) throw new Error(`Gagal mengatur ulang kursus: ${keptError.message}`);
    if (kept) throw new Error("Kursus yang sudah lulus tidak dapat diatur ulang; catatan kelulusannya tetap tersimpan.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from("self_paced_enrollments")
      .delete()
      .eq("user_id", context.userId)
      .eq("code", data.code);
    if (error) throw new Error(`Gagal mengatur ulang kursus: ${error.message}`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const meta = (userRecord?.user?.user_metadata as Record<string, unknown>) ?? {};
    const stored = meta.self_paced_courses as Record<string, unknown> | null | undefined;
    if (stored && typeof stored === "object" && data.code in stored) {
      const copy = { ...stored };
      delete copy[data.code];
      const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
        user_metadata: { ...meta, self_paced_courses: copy },
      });
      if (metaError) throw new Error(`Gagal mengatur ulang kursus: ${metaError.message}`);
    }
    return { success: true };
  });