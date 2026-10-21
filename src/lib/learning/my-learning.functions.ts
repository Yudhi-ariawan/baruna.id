import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * The participant dashboard, read from the database only (Slide 15: no learning
 * data kept outside the official system). Every query runs as the caller, so RLS
 * returns the caller's own rows; nothing here can show another person's data.
 * Order follows PB-ACA-03 (application) -> 04 (learning) -> 05 (pass/certificate).
 */

export type MyApplicationStatus = "pending" | "approved" | "rejected";

export type MyApplication = {
  courseId: string;
  courseTitle: string;
  status: MyApplicationStatus;
  appliedAt: string;
  decisionAt: string | null;
  decisionNotes: string | null;
};

export type MyCourseProgress = {
  code: string;
  title: string;
  /** Approved enrollment (PB-ACA-03); only approved courses open the learning room. */
  approved: boolean;
  steps: { video: boolean; pdf: boolean; ppt: boolean };
  /** 25% per material step marked by the participant + 25% for the server-recorded pass. */
  progress: number;
  /** Passed an official quiz graded and recorded on the server. */
  passed: boolean;
  /** An old "completed" flag written by the browser; not a verified pass. */
  legacyCompletion: boolean;
  score: number | null;
  completedAt: string | null;
  attempts: number;
  bestScore: number | null;
  /** Database modules only: whether the trainer has supplied the official quiz. null = bundled module. */
  hasOfficialQuiz: boolean | null;
  lastActivityAt: string | null;
};

export type MyCertificate = {
  id: string;
  number: string;
  type: string;
  status: string;
  issuedAt: string;
};

export type MyLearningOverview = {
  applications: MyApplication[];
  courses: MyCourseProgress[];
  certificates: MyCertificate[];
  counts: { pending: number; approved: number; rejected: number; inProgress: number; passed: number; certificates: number };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AppRow = { course_id: string; course_title: string | null; status: string; created_at: string; decision_at: string | null; decision_notes: string | null };
type CourseRow = {
  code: string; title: string | null; completed: boolean; completion_source: string | null; score: number | string | null;
  completed_at: string | null; completed_steps: Record<string, unknown> | null; updated_at: string | null;
};
type AttemptRow = { module_code: string; score: number; created_at: string };
type CertRow = { id: string; certificate_number: string; certificate_type: string; certificate_status: string; issue_date: string };

const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

export const getMyLearningOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyLearningOverview> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = context.supabase as any;
    const [apps, courses, attempts, certs] = await Promise.all([
      db.from("course_enrollment_applications")
        .select("course_id, course_title, status, created_at, decision_at, decision_notes")
        .eq("user_id", context.userId).order("created_at", { ascending: false }).limit(500),
      db.from("self_paced_enrollments")
        .select("code, title, completed, completion_source, score, completed_at, completed_steps, updated_at")
        .eq("user_id", context.userId).limit(500),
      db.from("module_quiz_attempts")
        .select("module_code, score, created_at")
        .eq("user_id", context.userId).order("created_at", { ascending: false }).limit(2000),
      db.from("certificates")
        .select("id, certificate_number, certificate_type, certificate_status, issue_date")
        .eq("learner_id", context.userId).order("issue_date", { ascending: false }).limit(200),
    ]);
    for (const [label, res] of [["pendaftaran", apps], ["progres", courses], ["kuis", attempts], ["sertifikat", certs]] as const) {
      if (res.error) {
        if (label === "kuis" && /module_quiz_attempts|schema cache/.test(res.error.message)) {
          throw new Error("Dashboard membutuhkan migrasi database 20261021100000. Jalankan supabase/check_migrations.sql.");
        }
        throw new Error(`Gagal memuat data ${label}: ${res.error.message}`);
      }
    }

    const appRows = (apps.data ?? []) as AppRow[];
    const courseRows = (courses.data ?? []) as CourseRow[];
    const attemptRows = (attempts.data ?? []) as AttemptRow[];

    const applications: MyApplication[] = appRows
      .filter((r) => r.status === "pending" || r.status === "approved" || r.status === "rejected")
      .map((r) => ({
        courseId: r.course_id,
        courseTitle: r.course_title || "Pelatihan BARUNA",
        status: r.status as MyApplicationStatus,
        appliedAt: r.created_at,
        decisionAt: r.decision_at,
        decisionNotes: r.decision_notes,
      }));

    // Whether a database module has its official quiz: answer keys are service-role
    // only, so only this yes/no leaves the server.
    const codes = new Set<string>([
      ...applications.filter((a) => a.status === "approved").map((a) => a.courseId),
      ...courseRows.map((c) => c.code),
    ]);
    const moduleIds = [...codes].filter((c) => UUID.test(c));
    const withQuiz = new Set<string>();
    if (moduleIds.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: keyRows, error: keyErr } = await (supabaseAdmin as any)
        .from("module_quiz_answer_keys").select("module_id, questions").in("module_id", moduleIds);
      if (keyErr) throw new Error(`Gagal memeriksa kuis modul: ${keyErr.message}`);
      for (const k of (keyRows ?? []) as Array<{ module_id: string; questions: unknown }>) {
        if (Array.isArray(k.questions) && k.questions.length > 0) withQuiz.add(k.module_id);
      }
    }

    const approvedSet = new Set(applications.filter((a) => a.status === "approved").map((a) => a.courseId));
    const titleOf = new Map(applications.map((a) => [a.courseId, a.courseTitle]));
    const courseByCode = new Map(courseRows.map((c) => [c.code, c]));
    const result: MyCourseProgress[] = [...codes].map((code) => {
      const row = courseByCode.get(code);
      const mine = attemptRows.filter((a) => a.module_code === code);
      const stepsRaw = row?.completed_steps ?? {};
      const steps = { video: stepsRaw.video === true, pdf: stepsRaw.pdf === true, ppt: stepsRaw.ppt === true };
      const passed = Boolean(row?.completed && row.completion_source === "server_quiz");
      const progress = passed ? 100 : (Number(steps.video) + Number(steps.pdf) + Number(steps.ppt)) * 25;
      return {
        code,
        title: row?.title || titleOf.get(code) || code,
        approved: approvedSet.has(code),
        steps,
        progress,
        passed,
        legacyCompletion: Boolean(row?.completed && row.completion_source === "legacy_browser"),
        score: passed && row?.score !== null && row?.score !== undefined ? Number(row.score) : null,
        completedAt: passed ? row?.completed_at ?? null : null,
        attempts: mine.length,
        bestScore: mine.length ? Math.max(...mine.map((a) => a.score)) : null,
        hasOfficialQuiz: UUID.test(code) ? withQuiz.has(code) : null,
        lastActivityAt: later(row?.updated_at ?? null, mine[0]?.created_at ?? null),
      };
    });
    result.sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""));

    const certificates: MyCertificate[] = ((certs.data ?? []) as CertRow[]).map((c) => ({
      id: c.id,
      number: c.certificate_number,
      type: c.certificate_type,
      status: c.certificate_status,
      issuedAt: c.issue_date,
    }));

    return {
      applications,
      courses: result,
      certificates,
      counts: {
        pending: applications.filter((a) => a.status === "pending").length,
        approved: applications.filter((a) => a.status === "approved").length,
        rejected: applications.filter((a) => a.status === "rejected").length,
        inProgress: result.filter((c) => c.approved && !c.passed).length,
        passed: result.filter((c) => c.passed).length,
        certificates: certificates.filter((c) => c.status === "issued").length,
      },
    };
  });
