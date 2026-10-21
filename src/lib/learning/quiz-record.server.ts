// ============================================================================
// Server learning record of a graded quiz — server only.
// ----------------------------------------------------------------------------
// The only way a module becomes "passed": a quiz graded on the server, recorded
// by public.learning_record_quiz_attempt (migration 20261021100000) in one
// transaction (attempt row + self_paced_enrollments). The browser can no longer
// report completion (self_paced_sync ignores it).
// ============================================================================

export type QuizRecordResult = {
  recorded: boolean;
  /** Why nothing was recorded: not an approved participant, or already passed. */
  reason?: "not_enrolled" | "already_passed";
  attemptsUsed?: number;
  /** null = no attempt limit for this module. */
  attemptsLeft?: number | null;
};

export async function recordServerQuizAttempt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  input: {
    userId: string;
    code: string;
    kind: "published" | "master";
    correct: number;
    total: number;
    passMark: number;
    maxAttempts: number | null;
    title?: string | null;
    hours?: string | number | null;
    instructor?: string | null;
    category?: string | null;
  },
): Promise<QuizRecordResult> {
  const { data, error } = await supabaseAdmin.rpc("learning_record_quiz_attempt", {
    _uid: input.userId,
    _code: input.code,
    _kind: input.kind,
    _correct: input.correct,
    _total: input.total,
    _pass_mark: input.passMark,
    _max_attempts: input.maxAttempts,
    _title: input.title ?? null,
    _hours: input.hours === null || input.hours === undefined ? null : String(input.hours),
    _instructor: input.instructor ?? null,
    _category: input.category ?? null,
  });
  if (error) {
    const message = String(error.message ?? "");
    if (/Could not find the function|schema cache/.test(message)) {
      throw new Error("Pencatatan kuis membutuhkan migrasi database 20261021100000. Jalankan supabase/check_migrations.sql.");
    }
    if (message.includes("quiz_attempts_exhausted")) {
      throw new Error("Kesempatan mengerjakan kuis ini sudah habis.");
    }
    throw new Error(`Gagal mencatat hasil kuis: ${message}`);
  }
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    recorded: row.recorded === true,
    reason: row.reason === "not_enrolled" || row.reason === "already_passed" ? row.reason : undefined,
    attemptsUsed: typeof row.attemptsUsed === "number" ? row.attemptsUsed : undefined,
    attemptsLeft: typeof row.attemptsLeft === "number" ? row.attemptsLeft : row.attemptsLeft === null ? null : undefined,
  };
}
