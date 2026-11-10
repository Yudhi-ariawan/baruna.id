import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enrollmentKind, type LearningKind } from "./enrollment-target";

/**
 * The participant dashboard, read from the database only (Slide 15: no learning
 * data kept outside the official system). Every query runs as the caller, so RLS
 * returns the caller's own rows; nothing here can show another person's data.
 * Order follows PB-ACA-03 (application) -> 04 (learning) -> 05 (pass/certificate).
 * Two learning paths: modules (self_paced_enrollments + module quiz) and Course
 * Offerings (enrolments + progress_records + completion review); an offering is
 * never counted as a module.
 */

export type MyApplicationStatus = "pending" | "approved" | "rejected" | "revision_requested";

export type MyApplication = {
  courseId: string;
  courseTitle: string;
  /** Course Offering, module or Full Training: decides which page the participant is sent to. */
  kind: LearningKind;
  status: MyApplicationStatus;
  appliedAt: string;
  decisionAt: string | null;
  decisionNotes: string | null;
};

export type MyCourseProgress = {
  code: string;
  title: string;
  kind: LearningKind;
  /** Course Offering only: modules done out of the course's modules, and the completion review. */
  offering: { completedModules: number; totalModules: number; reviewStatus: string | null } | null;
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
  counts: {
    pending: number; revisionRequested: number; approved: number; rejected: number;
    inProgress: number; passed: number; certificates: number;
  };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AppRow = { course_id: string; course_title: string | null; status: string; created_at: string; decision_at: string | null; decision_notes: string | null };
type CourseRow = {
  code: string; title: string | null; completed: boolean; completion_source: string | null; score: number | string | null;
  completed_at: string | null; completed_steps: Record<string, unknown> | null; updated_at: string | null;
};
type AttemptRow = { module_code: string; score: number; created_at: string };
type CertRow = { id: string; certificate_number: string; certificate_type: string; certificate_status: string; issue_date: string };

type OfferingRef = {
  offering_code: string; offering_title: string; master_course_id: string; learning_engine_version: string | null;
  master_courses: { title: string } | { title: string }[] | null;
};
type EnrolRow = {
  id: string; enrolment_status: string; completion_status: string; completion_date: string | null; updated_at: string | null;
  course_offerings: OfferingRef | OfferingRef[] | null;
};

const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

/**
 * Progress of Course Offerings, counted like the course page: modules of the master
 * course marked completed (activity "module:<code>"). A pass is the approved
 * completion (enrolments.completion_status = 'completed', PB-ACA-05).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function offeringProgress(db: any, rows: Array<EnrolRow & { offering: OfferingRef | null }>): Promise<MyCourseProgress[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const courseIds = [...new Set(rows.map((r) => r.offering!.master_course_id))];
  const [prog, mods, reviews] = await Promise.all([
    db.from("progress_records").select("enrolment_id, learning_activity_id").in("enrolment_id", ids).eq("status", "completed").limit(5000),
    db.from("master_modules").select("master_course_id, module_code").in("master_course_id", courseIds).limit(2000),
    db.from("course_completions").select("enrolment_id, status").in("enrolment_id", ids),
  ]);
  if (prog.error) throw new Error(`Gagal memuat progres course: ${prog.error.message}`);
  if (mods.error) throw new Error(`Gagal memuat modul course: ${mods.error.message}`);
  // course_completions exists from migration 20261109010000; without it there is no review state yet.
  const reviewOf = new Map(((reviews.error ? [] : reviews.data ?? []) as Array<{ enrolment_id: string; status: string }>).map((r) => [r.enrolment_id, r.status]));
  const finished = new Map<string, Set<string>>();
  for (const p of (prog.data ?? []) as Array<{ enrolment_id: string; learning_activity_id: string }>) {
    if (!finished.has(p.enrolment_id)) finished.set(p.enrolment_id, new Set());
    finished.get(p.enrolment_id)!.add(p.learning_activity_id);
  }
  const modulesOf = new Map<string, string[]>();
  for (const m of (mods.data ?? []) as Array<{ master_course_id: string; module_code: string }>) {
    modulesOf.set(m.master_course_id, [...(modulesOf.get(m.master_course_id) ?? []), m.module_code]);
  }

  return rows.map((r) => {
    const o = r.offering!;
    const modules = modulesOf.get(o.master_course_id) ?? [];
    const done = finished.get(r.id) ?? new Set<string>();
    const completedModules = modules.filter((code) => done.has(`module:${code}`)).length;
    const passed = r.completion_status === "completed";
    const master = Array.isArray(o.master_courses) ? o.master_courses[0] : o.master_courses;
    return {
      code: o.offering_code,
      title: master?.title ?? o.offering_title,
      kind: "offering" as const,
      offering: { completedModules, totalModules: modules.length, reviewStatus: reviewOf.get(r.id) ?? null },
      approved: true,
      steps: { video: false, pdf: false, ppt: false },
      progress: passed ? 100 : modules.length ? Math.round((completedModules / modules.length) * 100) : 0,
      passed,
      legacyCompletion: false,
      score: null,
      completedAt: passed ? r.completion_date ?? null : null,
      attempts: 0,
      bestScore: null,
      hasOfficialQuiz: null,
      lastActivityAt: r.updated_at,
    };
  });
}

export const getMyLearningOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyLearningOverview> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = context.supabase as any;
    const [apps, courses, attempts, certs, enrols] = await Promise.all([
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
      db.from("enrolments")
        .select("id, enrolment_status, completion_status, completion_date, updated_at, course_offerings(offering_code, offering_title, master_course_id, learning_engine_version, master_courses(title))")
        .eq("user_id", context.userId).limit(200),
    ]);
    for (const [label, res] of [["pendaftaran", apps], ["progres", courses], ["kuis", attempts], ["sertifikat", certs], ["course", enrols]] as const) {
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

    // Course Offerings: enrolled ones (shared engine, not withdrawn), plus application
    // ids that are offering codes (the offering page applies with its code).
    const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
    const enrolRows = ((enrols.data ?? []) as EnrolRow[])
      .map((e) => ({ ...e, offering: one(e.course_offerings) }))
      .filter((e) => e.enrolment_status !== "withdrawn" && e.offering?.learning_engine_version === "shared_v1");
    const offeringCodes = new Set<string>(enrolRows.map((e) => e.offering!.offering_code));
    const unknownIds = [...new Set(appRows.map((r) => r.course_id))].filter((id) => !UUID.test(id) && !offeringCodes.has(id));
    if (unknownIds.length > 0) {
      const { data: offs, error: offErr } = await db.from("course_offerings").select("offering_code").in("offering_code", unknownIds);
      if (offErr) throw new Error(`Gagal memeriksa course: ${offErr.message}`);
      for (const o of (offs ?? []) as Array<{ offering_code: string }>) offeringCodes.add(o.offering_code);
    }

    const applications: MyApplication[] = appRows
      .filter((r) => ["pending", "approved", "rejected", "revision_requested"].includes(r.status))
      .map((r) => ({
        courseId: r.course_id,
        courseTitle: r.course_title || "Pelatihan BARUNA",
        kind: enrollmentKind(r.course_id, offeringCodes),
        status: r.status as MyApplicationStatus,
        appliedAt: r.created_at,
        decisionAt: r.decision_at,
        decisionNotes: r.decision_notes,
      }));

    // Whether a database module has its official quiz: answer keys are service-role
    // only, so only this yes/no leaves the server.
    const codes = new Set<string>(
      [...applications.filter((a) => a.status === "approved").map((a) => a.courseId), ...courseRows.map((c) => c.code)]
        .filter((code) => !offeringCodes.has(code)),
    );
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
        kind: enrollmentKind(code, offeringCodes),
        offering: null,
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
    result.push(...(await offeringProgress(db, enrolRows)));
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
        revisionRequested: applications.filter((a) => a.status === "revision_requested").length,
        approved: applications.filter((a) => a.status === "approved").length,
        rejected: applications.filter((a) => a.status === "rejected").length,
        inProgress: result.filter((c) => c.approved && !c.passed).length,
        passed: result.filter((c) => c.passed).length,
        certificates: certificates.filter((c) => c.status === "issued").length,
      },
    };
  });
