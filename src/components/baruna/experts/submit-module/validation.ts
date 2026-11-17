// Field-level checks for the trainer module submission (/experts/portal/submit-module),
// per step. The title rule (3-240 characters, also for a draft) is the server's
// (ModuleSubmission) and the database's (trainer_module_save: title_required); the
// other required fields are the wizard's own rules, now shown per field. The
// copyright holder was marked required but never checked; it is now.
import type { CustomQuizQuestion } from "@/lib/learning/learning.functions";
import type { ModuleFormFields } from "./config";

export type ModuleFieldErrors = Record<string, string>;

export function moduleFormLabels(isId: boolean): Record<string, string> {
  return isId
    ? {
        title: "Judul modul", topic: "Topik", competency: "Bidang kompetensi", hours: "Jam pembelajaran",
        language: "Bahasa pengantar", targetParticipants: "Target peserta", summary: "Ringkasan",
        objectives: "Tujuan pembelajaran", outcomes: "Capaian kompetensi", assessment: "Metode penilaian",
        passingScore: "Nilai kelulusan", quiz: "Soal kuis", copyrightHolder: "Pemegang hak cipta", declarations: "Pernyataan etika",
      }
    : {
        title: "Module title", topic: "Topic", competency: "Competency domain", hours: "Learning hours",
        language: "Instruction language", targetParticipants: "Target audience", summary: "Summary",
        objectives: "Learning objectives", outcomes: "Expected outcomes", assessment: "Assessment method",
        passingScore: "Passing score", quiz: "Quiz questions", copyrightHolder: "Copyright holder", declarations: "Ethics declarations",
      };
}

/** Title rule of the server and database (3-240 characters after trimming). */
export function moduleTitleError(title: string, isId: boolean): string | undefined {
  const n = title.trim().length;
  if (n === 0) return isId ? "Isi judul modul." : "Enter the module title.";
  if (n < 3 || n > 240) return isId ? `Judul 3–240 karakter (sekarang ${n}).` : `Title must be 3–240 characters (now ${n}).`;
  return undefined;
}

/** Quiz problems by question number: text, at least 2 options, answer key on a filled option. */
export function quizProblems(questions: CustomQuizQuestion[], isId: boolean): string[] {
  const out: string[] = [];
  questions.forEach((q, i) => {
    const filled = q.options.map((o) => o.trim().length > 0);
    const n = i + 1;
    if (!q.question.trim()) out.push(isId ? `Soal #${n}: teks pertanyaan kosong.` : `Question #${n}: text is empty.`);
    if (filled.filter(Boolean).length < 2) out.push(isId ? `Soal #${n}: isi minimal 2 pilihan jawaban.` : `Question #${n}: fill at least 2 options.`);
    else if (!filled[q.correctAnswer]) out.push(isId ? `Soal #${n}: kunci jawaban menunjuk pilihan yang kosong.` : `Question #${n}: the answer key points to an empty option.`);
  });
  return out;
}

export function moduleStepErrors(
  step: number,
  f: ModuleFormFields,
  quiz: CustomQuizQuestion[],
  allDecls: boolean,
  isId: boolean,
): ModuleFieldErrors {
  const e: ModuleFieldErrors = {};
  const t = (id: string, en: string) => (isId ? id : en);
  const need = (k: keyof ModuleFormFields, id: string, en: string) => {
    const v = f[k];
    if (typeof v === "string" && !v.trim()) e[k] = t(id, en);
  };
  if (step === 1) {
    const title = moduleTitleError(f.title, isId);
    if (title) e.title = title;
    need("topic", "Isi topik / bidang kajian.", "Enter the topic.");
    need("competency", "Isi bidang kompetensi.", "Enter the competency domain.");
    const h = Number(f.hours);
    if (!Number.isFinite(h) || h <= 0) e.hours = t("Jam harus lebih dari 0.", "Hours must be more than 0.");
    need("language", "Isi bahasa pengantar.", "Enter the instruction language.");
    need("targetParticipants", "Isi profil target peserta.", "Describe the target audience.");
    need("summary", "Isi ringkasan modul.", "Write a module summary.");
  }
  if (step === 2) {
    need("objectives", "Isi minimal satu tujuan pembelajaran.", "Enter at least one learning objective.");
    need("outcomes", "Isi capaian kompetensi.", "Enter the expected outcomes.");
    need("assessment", "Isi metode penilaian.", "Enter the assessment method.");
    const s = Number(f.passingScore);
    if (!Number.isFinite(s) || s < 0 || s > 100) e.passingScore = t("Nilai kelulusan 0–100.", "Passing score must be 0–100.");
    const problems = quizProblems(quiz, isId);
    if (problems.length) e.quiz = problems.join(" ");
  }
  if (step === 4) {
    need("copyrightHolder", "Isi pemegang hak cipta.", "Enter the copyright holder.");
    if (!allDecls) e.declarations = t("Centang keempat pernyataan.", "Tick all four declarations.");
  }
  return e;
}

/** First step that still has a field to fix (step 3 has no required field). */
export function firstModuleStepWithErrors(
  f: ModuleFormFields,
  quiz: CustomQuizQuestion[],
  allDecls: boolean,
  isId: boolean,
): { step: number; errors: ModuleFieldErrors } | null {
  for (const step of [1, 2, 4]) {
    const errors = moduleStepErrors(step, f, quiz, allDecls, isId);
    if (Object.keys(errors).length) return { step, errors };
  }
  return null;
}
