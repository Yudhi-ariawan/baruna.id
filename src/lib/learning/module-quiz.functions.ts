import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAssessmentConfig, type RunQuestion } from "@/data/quizzes";
import type { QuizRecordResult } from "./quiz-record.server";

/**
 * Quizzes of the bundled Master modules (and the Full Training assessments that
 * share their banks). Questions are served without answers and graded here; the
 * answer keys live in src/data/quiz-banks.server.ts and never reach the browser.
 * A pass inside a self-paced Master module is recorded on the server
 * (learning_record_quiz_attempt); nothing else can mark it passed.
 */

const BankId = z.string().regex(/^[A-Za-z0-9]{1,40}$/);
const ModuleCode = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/);

export type ModuleQuizGrade = {
  correct: number;
  total: number;
  score: number;
  passed: boolean;
  passMark: number;
  /** Correct choice per question id: only after a pass or when no attempts remain. */
  correctChoices: Record<string, string> | null;
  /** Server learning record (self-paced Master modules only). */
  record: QuizRecordResult | null;
};

export const startModuleQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ bankId: BankId }).parse(d))
  .handler(async ({ data }): Promise<{ questions: RunQuestion[] }> => {
    const { getQuizBank, buildServerAttempt } = await import("@/data/quiz-banks.server");
    const bank = getQuizBank(data.bankId);
    if (!bank) throw new Error("Bank soal kuis ini belum tersedia.");
    return { questions: buildServerAttempt(bank, getAssessmentConfig(data.bankId).count) };
  });

export const gradeModuleQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        bankId: BankId,
        /** Question id -> chosen option text (null = unanswered when time ran out). */
        answers: z
          .record(z.string().max(40), z.string().max(1000).nullable())
          .refine((a) => Object.keys(a).length >= 1 && Object.keys(a).length <= 100, "Jawaban kuis tidak valid."),
        /** Set inside a self-paced Master module: the result becomes a learning record. */
        masterCode: ModuleCode.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ModuleQuizGrade> => {
    const { getQuizBank } = await import("@/data/quiz-banks.server");
    const bank = getQuizBank(data.bankId);
    if (!bank) throw new Error("Bank soal kuis ini belum tersedia.");
    const config = getAssessmentConfig(data.bankId);
    const expected = Math.min(bank.questions.length, config.count);

    const ids = Object.keys(data.answers);
    if (ids.length !== expected) throw new Error("Jumlah jawaban tidak sesuai dengan jumlah soal kuis.");
    const byId = new Map(bank.questions.map((q) => [q.id, q]));
    let correct = 0;
    const keys: Record<string, string> = {};
    for (const id of ids) {
      const question = byId.get(id);
      if (!question) throw new Error("Soal kuis tidak dikenal. Mulai ulang kuis.");
      const picked = data.answers[id];
      if (picked !== null && !question.options.includes(picked)) {
        throw new Error("Jawaban tidak sesuai dengan pilihan soal. Mulai ulang kuis.");
      }
      const right = question.options[question.correctIndex];
      keys[id] = right;
      if (picked === right) correct += 1;
    }
    const score = Math.round((correct / expected) * 100);
    const passMark = config.noPassMark ? 0 : config.passPercent;
    const passed = config.noPassMark ? true : score >= passMark;

    let record: QuizRecordResult | null = null;
    if (data.masterCode) {
      const { masterByCode } = await import("@/data/masterModules");
      const master = masterByCode[data.masterCode];
      if (!master || master.lmsId !== data.bankId) throw new Error("Kuis tidak sesuai dengan modul ini.");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { recordServerQuizAttempt } = await import("./quiz-record.server");
      record = await recordServerQuizAttempt(supabaseAdmin, {
        userId: context.userId,
        code: master.code,
        kind: "master",
        correct,
        total: expected,
        passMark,
        maxAttempts: config.maxAttempts,
        title: master.shortCourseTitle || master.title,
        hours: master.hours,
        instructor: master.instructorSlug,
        category: master.category,
      });
    }

    // Answers are revealed only once they can no longer be used to pass.
    const reveal = passed || record?.attemptsLeft === 0;
    return { correct, total: expected, score, passed, passMark, correctChoices: reveal ? keys : null, record };
  });
