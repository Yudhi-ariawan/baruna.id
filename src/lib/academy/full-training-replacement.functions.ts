// Full Training -> Course Offering (keputusan pemilik proyek 16 Nov; migration
// 20261116040000; CATATAN_PERBAIKAN 2bb). An Approver/Admin links an old Full
// Training program to the Course Offering that replaces it; new applicants are sent
// there, applications already in progress finish on the old program.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Offering code replacing this program, or null (also before the migration). Public. */
export const getFullTrainingReplacement = createServerFn({ method: "GET" })
  .validator((d) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }): Promise<string | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as Db)
      .from("full_training_programs")
      .select("replaced_by_offering_code")
      .eq("course_id", data.slug)
      .maybeSingle();
    if (error || !row) return null;
    return (row.replaced_by_offering_code as string | null) ?? null;
  });

export type FullTrainingReplacements = {
  programs: Array<{ courseId: string; title: string; replacedBy: string | null }>;
  offerings: Array<{ code: string; title: string }>;
};

/** For the Program Academy page; null when the caller cannot decide or before the migration. */
export const listFullTrainingReplacements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FullTrainingReplacements | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as Db;
    const { data: can } = await db.rpc("_can_decide_review", { _uid: context.userId });
    if (!can) return null;
    const [programs, offerings] = await Promise.all([
      db.from("full_training_programs").select("course_id, title, replaced_by_offering_code").order("title"),
      db.from("course_offerings").select("offering_code, offering_title, master_courses(title)")
        .eq("status", "published").eq("enrolment_access_rule", "approval_required").order("offering_code"),
    ]);
    if (programs.error) return null;
    return {
      programs: ((programs.data ?? []) as Array<{ course_id: string; title: string; replaced_by_offering_code: string | null }>).map((p) => ({
        courseId: p.course_id, title: p.title, replacedBy: p.replaced_by_offering_code,
      })),
      offerings: ((offerings.data ?? []) as Array<{ offering_code: string; offering_title: string; master_courses: { title: string } | null }>).map((o) => ({
        code: o.offering_code, title: o.master_courses?.title ? `${o.master_courses.title} — ${o.offering_title}` : o.offering_title,
      })),
    };
  });

export const setFullTrainingReplacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ courseId: z.string().min(1).max(200), offeringCode: z.string().trim().max(80).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase as Db).rpc("full_training_set_replacement", {
      _course_id: data.courseId,
      _offering_code: data.offeringCode || null,
    });
    if (error) {
      const m = error.message;
      throw new Error(
        /full_training_replacement_invalid/.test(m) ? "Pilih Course Offering yang sedang tayang dan memakai aturan \"Wajib disetujui admin\"."
          : /(^|[^_a-z])forbidden([^_a-z]|$)/.test(m) ? "Hanya Approver, Admin, atau Super Admin yang dapat mengatur pengalihan."
          : /full_training_not_found/.test(m) ? "Program Full Training tidak ditemukan."
          : m,
      );
    }
    return res as { replacedBy: string | null };
  });
