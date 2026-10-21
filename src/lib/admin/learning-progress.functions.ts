import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminAccess } from "@/lib/admin/enrollments.functions";

/**
 * PB-ACA-04 "Monitor Progress Peserta" and "Tindak Lanjut Peserta Bermasalah"
 * (Admin Console / Operator lane). Same access rule as Persetujuan Peserta
 * (super_admin, admin, operator, approver). Every figure comes from the database:
 * approved applications, self-paced records, and server-graded quiz attempts.
 */

export type LearnerFlag = "not_started" | "inactive" | "repeated_failure" | "awaiting_official_quiz";

export type LearnerProgressRow = {
  userId: string;
  name: string;
  email: string;
  organization: string | null;
  courseId: string;
  courseTitle: string;
  approvedAt: string | null;
  started: boolean;
  steps: { video: boolean; pdf: boolean; ppt: boolean };
  progress: number;
  attempts: number;
  bestScore: number | null;
  passed: boolean;
  completedAt: string | null;
  legacyCompletion: boolean;
  lastActivityAt: string | null;
  flags: LearnerFlag[];
};

export type CourseProgressSummary = {
  courseId: string;
  courseTitle: string;
  pending: number;
  approved: number;
  started: number;
  passed: number;
  averageBestScore: number | null;
  needsAttention: number;
  hasOfficialQuiz: boolean | null;
};

export type LearningProgressResponse = {
  rows: LearnerProgressRow[];
  total: number;
  courses: CourseProgressSummary[];
  generatedAt: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 24 * 60 * 60 * 1000;
/** Thresholds for follow-up; shown on the page so the operator knows the rule. */
export const FOLLOW_UP_RULES = { notStartedDays: 7, inactiveDays: 14, failedAttempts: 3 } as const;

type AppRow = {
  user_id: string; course_id: string; course_title: string | null; status: string;
  applicant_name: string | null; applicant_email: string | null; applicant_organization: string | null;
  decision_at: string | null; created_at: string;
};
type CourseRow = { user_id: string; code: string; completed: boolean; completion_source: string | null; completed_at: string | null; completed_steps: Record<string, unknown> | null; updated_at: string | null };
type AttemptRow = { user_id: string; module_code: string; score: number; passed: boolean; created_at: string };

export const listLearningProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        courseId: z.string().max(120).default(""),
        filter: z.enum(["all", "in_progress", "passed", "attention"]).default("all"),
        search: z.string().trim().max(120).default(""),
        page: z.number().int().min(1).max(10_000).default(1),
        pageSize: z.number().int().min(10).max(100).default(50),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data: input, context }): Promise<LearningProgressResponse> => {
    if (!(await assertAdminAccess(context))) {
      throw new Error("Akses ditolak: hanya Admin, Operator, atau Approver yang dapat memantau progres peserta.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchAllPages } = await import("@/lib/supabase/batch.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    const [apps, courses, attempts] = await Promise.all([
      fetchAllPages<AppRow>((from, to) =>
        db.from("course_enrollment_applications")
          .select("user_id, course_id, course_title, status, applicant_name, applicant_email, applicant_organization, decision_at, created_at")
          .order("created_at").order("id").range(from, to),
      ),
      fetchAllPages<CourseRow>((from, to) =>
        db.from("self_paced_enrollments")
          .select("user_id, code, completed, completion_source, completed_at, completed_steps, updated_at")
          .order("id").range(from, to),
      ),
      fetchAllPages<AttemptRow>((from, to) =>
        db.from("module_quiz_attempts")
          .select("user_id, module_code, score, passed, created_at")
          .order("id").range(from, to),
      ).catch((err: Error) => {
        if (/module_quiz_attempts|schema cache/.test(err.message)) {
          throw new Error("Pemantauan membutuhkan migrasi database 20261021100000. Jalankan supabase/check_migrations.sql.");
        }
        throw err;
      }),
    ]);

    const moduleIds = [...new Set(apps.map((a) => a.course_id).filter((c) => UUID.test(c)))];
    const withQuiz = new Set<string>();
    if (moduleIds.length > 0) {
      const { data: keys, error } = await db.from("module_quiz_answer_keys").select("module_id, questions").in("module_id", moduleIds);
      if (error) throw new Error(`Gagal memeriksa kuis modul: ${error.message}`);
      for (const k of (keys ?? []) as Array<{ module_id: string; questions: unknown }>) {
        if (Array.isArray(k.questions) && k.questions.length > 0) withQuiz.add(k.module_id);
      }
    }

    const key = (u: string, c: string) => `${u}|${c}`;
    const courseBy = new Map(courses.map((c) => [key(c.user_id, c.code), c]));
    const attemptsBy = new Map<string, AttemptRow[]>();
    for (const a of attempts) {
      const k = key(a.user_id, a.module_code);
      attemptsBy.set(k, [...(attemptsBy.get(k) ?? []), a]);
    }

    const now = Date.now();
    const rows: LearnerProgressRow[] = apps
      .filter((a) => a.status === "approved")
      .map((a) => {
        const c = courseBy.get(key(a.user_id, a.course_id));
        const mine = attemptsBy.get(key(a.user_id, a.course_id)) ?? [];
        const raw = c?.completed_steps ?? {};
        const steps = { video: raw.video === true, pdf: raw.pdf === true, ppt: raw.ppt === true };
        const passed = Boolean(c?.completed && c.completion_source === "server_quiz");
        const lastAttempt = mine.reduce<string | null>((m, x) => (!m || x.created_at > m ? x.created_at : m), null);
        const lastActivityAt = [c?.updated_at ?? null, lastAttempt].filter(Boolean).sort().pop() ?? null;
        const approvedAt = a.decision_at ?? a.created_at;
        const flags: LearnerFlag[] = [];
        if (!passed) {
          const sinceApproval = now - new Date(approvedAt).getTime();
          if (!c && mine.length === 0 && sinceApproval > FOLLOW_UP_RULES.notStartedDays * DAY) flags.push("not_started");
          if (lastActivityAt && now - new Date(lastActivityAt).getTime() > FOLLOW_UP_RULES.inactiveDays * DAY) flags.push("inactive");
          if (mine.length >= FOLLOW_UP_RULES.failedAttempts) flags.push("repeated_failure");
          if (UUID.test(a.course_id) && !withQuiz.has(a.course_id)) flags.push("awaiting_official_quiz");
        }
        return {
          userId: a.user_id,
          name: a.applicant_name || "Peserta BARUNA",
          email: a.applicant_email || "",
          organization: a.applicant_organization,
          courseId: a.course_id,
          courseTitle: a.course_title || a.course_id,
          approvedAt,
          started: Boolean(c) || mine.length > 0,
          steps,
          progress: passed ? 100 : (Number(steps.video) + Number(steps.pdf) + Number(steps.ppt)) * 25,
          attempts: mine.length,
          bestScore: mine.length ? Math.max(...mine.map((x) => x.score)) : null,
          passed,
          completedAt: passed ? c?.completed_at ?? null : null,
          legacyCompletion: Boolean(c?.completed && c.completion_source === "legacy_browser"),
          lastActivityAt,
          flags,
        };
      });

    // Per-course summary over all approved participants (before search/paging).
    const byCourse = new Map<string, CourseProgressSummary>();
    for (const a of apps) {
      const s = byCourse.get(a.course_id) ?? {
        courseId: a.course_id, courseTitle: a.course_title || a.course_id, pending: 0, approved: 0, started: 0,
        passed: 0, averageBestScore: null, needsAttention: 0,
        hasOfficialQuiz: UUID.test(a.course_id) ? withQuiz.has(a.course_id) : null,
      };
      if (a.status === "pending") s.pending += 1;
      byCourse.set(a.course_id, s);
    }
    for (const r of rows) {
      const s = byCourse.get(r.courseId)!;
      s.approved += 1;
      if (r.started) s.started += 1;
      if (r.passed) s.passed += 1;
      if (r.flags.length) s.needsAttention += 1;
    }
    for (const s of byCourse.values()) {
      const best = rows.filter((r) => r.courseId === s.courseId && r.bestScore !== null).map((r) => r.bestScore!);
      s.averageBestScore = best.length ? Math.round(best.reduce((n, v) => n + v, 0) / best.length) : null;
    }

    const term = input.search.toLocaleLowerCase();
    const filtered = rows
      .filter((r) => !input.courseId || r.courseId === input.courseId)
      .filter((r) =>
        input.filter === "passed" ? r.passed
          : input.filter === "in_progress" ? !r.passed
            : input.filter === "attention" ? r.flags.length > 0
              : true,
      )
      .filter((r) => !term || [r.name, r.email, r.organization ?? "", r.courseTitle].some((v) => v.toLocaleLowerCase().includes(term)))
      .sort((x, y) => y.flags.length - x.flags.length || (y.lastActivityAt ?? "").localeCompare(x.lastActivityAt ?? ""));

    const start = (input.page - 1) * input.pageSize;
    return {
      rows: filtered.slice(start, start + input.pageSize),
      total: filtered.length,
      courses: [...byCourse.values()].sort((x, y) => y.approved - x.approved),
      generatedAt: new Date().toISOString(),
    };
  });
