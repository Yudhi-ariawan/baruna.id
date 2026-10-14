import { ModuleQuizBuilder } from "@/components/baruna/experts/ModuleQuizBuilder";
import type { CustomQuizQuestion } from "@/lib/learning/learning.functions";
import { Section, Grid, Field, inp } from "./FormPrimitives";
import type { ModuleFormFields, UpdateField } from "./config";

export function StepSyllabus({
  isId,
  formFields,
  updateField,
  quizQuestions,
  setQuizQuestions,
}: {
  isId: boolean;
  formFields: ModuleFormFields;
  updateField: UpdateField;
  quizQuestions: CustomQuizQuestion[];
  setQuizQuestions: (q: CustomQuizQuestion[]) => void;
}) {
  return (
      <Section
        title={isId ? "2. Rancangan Pembelajaran & Evaluasi" : "2. Learning Design & Evaluation"}
        subtitle={
          isId
            ? "Tentukan tujuan pembelajaran per baris, capaian kompetensi, serta metode evaluasi kelulusan."
            : "Define learning objectives, expected outcomes, assessment methods, and passing criteria."
        }
      >
        <Field
          label={isId ? "Tujuan Pembelajaran (Satu per baris)" : "Learning Objectives (One per line)"}
          required
        >
          <textarea
            value={formFields.objectives}
            onChange={(e) => updateField("objectives", e.target.value)}
            className={`${inp} min-h-[110px] font-mono text-xs`}
            required
            placeholder={
              isId
                ? "1. Memahami prinsip penetapan batas kawasan konservasi laut\n2. Mampu menyusun indikator kesehatan terumbu karang\n3. Mengetahui regulasi perizinan zonasi pemanfaatan"
                : "1. Understand marine protected area zoning principles\n2. Analyze coral reef ecosystem health indicators\n3. Apply national fisheries compliance standards"
            }
          />
        </Field>

        <Field
          label={
            isId
              ? "Capaian Hasil Kompetensi (Expected Outcomes)"
              : "Expected Competency Outcomes"
          }
          required
        >
          <textarea
            value={formFields.outcomes}
            onChange={(e) => updateField("outcomes", e.target.value)}
            className={`${inp} min-h-[90px]`}
            required
            placeholder={
              isId
                ? "Peserta mampu merancang dokumen rencana pengelolaan kawasan konservasi perairan sesuai pedoman nasional..."
                : "Participants will be able to design a marine management document aligned with national guidelines..."
            }
          />
        </Field>

        <Grid>
          <Field label={isId ? "Metode Penilaian / Ujian" : "Assessment Method"} required>
            <input
              value={formFields.assessment}
              onChange={(e) => updateField("assessment", e.target.value)}
              className={inp}
              required
              placeholder={
                isId
                  ? "Contoh: Kuis Pilihan Ganda 20 Soal & Studi Kasus"
                  : "e.g., 20 Multiple Choice Questions & Case Study"
              }
            />
          </Field>
          <Field
            label={
              isId
                ? "Nilai Kelulusan Minimum (Passing Score %)"
                : "Minimum Passing Score (%)"
            }
            required
          >
            <input
              type="number"
              min={0}
              max={100}
              value={formFields.passingScore}
              onChange={(e) => updateField("passingScore", Number(e.target.value))}
              className={inp}
              required
            />
          </Field>
        </Grid>

        <div className="mt-6 pt-5 border-t border-border">
          <ModuleQuizBuilder
            questions={quizQuestions}
            onChange={setQuizQuestions}
            isId={isId}
          />
        </div>
      </Section>
  );
}
