import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Learning summary of the signed-in trainer's published modules. Aggregates only
 * (no names, emails or participant ids): per-participant monitoring and follow-up
 * belong to Admin/Operator (PB-ACA-04). Computed in the database by
 * trainer_module_learning_summary (migration 20261021100000) for an active trainer.
 */
export type TrainerModuleLearning = {
  moduleId: string;
  title: string;
  hasOfficialQuiz: boolean;
  applicationsPending: number;
  participantsApproved: number;
  participantsStarted: number;
  participantsPassed: number;
  quizAttempts: number;
  averageBestScore: number | null;
};

export type TrainerLearningSummary = {
  modules: TrainerModuleLearning[];
  totals: { approved: number; passed: number; completionRate: number | null };
};

export const getTrainerLearningSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrainerLearningSummary> => {
    const { data, error } = await context.supabase.rpc("trainer_module_learning_summary" as never);
    if (error) {
      if (/Could not find the function|schema cache/.test(error.message)) {
        throw new Error("Statistik peserta membutuhkan migrasi database 20261021100000.");
      }
      if (error.message.includes("trainer_access_required")) {
        throw new Error("Statistik peserta hanya untuk trainer aktif.");
      }
      throw new Error(`Gagal memuat statistik peserta: ${error.message}`);
    }
    const raw = ((data as unknown as { modules?: Array<Record<string, unknown>> })?.modules ?? []);
    const modules: TrainerModuleLearning[] = raw.map((m) => ({
      moduleId: String(m.moduleId),
      title: String(m.title ?? ""),
      hasOfficialQuiz: m.hasOfficialQuiz === true,
      applicationsPending: Number(m.applicationsPending ?? 0),
      participantsApproved: Number(m.participantsApproved ?? 0),
      participantsStarted: Number(m.participantsStarted ?? 0),
      participantsPassed: Number(m.participantsPassed ?? 0),
      quizAttempts: Number(m.quizAttempts ?? 0),
      averageBestScore: m.averageBestScore === null || m.averageBestScore === undefined ? null : Number(m.averageBestScore),
    }));
    const approved = modules.reduce((n, m) => n + m.participantsApproved, 0);
    const passed = modules.reduce((n, m) => n + m.participantsPassed, 0);
    return { modules, totals: { approved, passed, completionRate: approved > 0 ? Math.round((passed / approved) * 100) : null } };
  });
