import { Section, Grid, Field, inp } from "./FormPrimitives";
import type { ModuleFormFields, UpdateField } from "./config";

export function StepInfo({
  isId,
  formFields,
  updateField,
}: {
  isId: boolean;
  formFields: ModuleFormFields;
  updateField: UpdateField;
}) {
  return (
      <Section
        title={isId ? "1. Informasi & Metadata Modul" : "1. Module Information & Metadata"}
        subtitle={
          isId
            ? "Isi informasi dasar, topik bahasan, dan target pembelajaran modul."
            : "Fill in the basic information, topic, and delivery format of your module."
        }
      >
        <Grid>
          <Field label={isId ? "Judul Modul Pelatihan" : "Module Title"} required>
            <input
              value={formFields.title}
              onChange={(e) => updateField("title", e.target.value)}
              className={inp}
              required
              placeholder={
                isId
                  ? "Contoh: Marine Protected Area Management Fundamentals"
                  : "e.g., Marine Protected Area Management Fundamentals"
              }
            />
          </Field>
          <Field label={isId ? "Topik / Bidang Kajian" : "Topic / Subject Area"} required>
            <input
              value={formFields.topic}
              onChange={(e) => updateField("topic", e.target.value)}
              className={inp}
              required
              placeholder={
                isId
                  ? "Contoh: Konservasi Laut, Akuakultur, Kebijakan Maritim"
                  : "e.g., Marine Conservation, Aquaculture, Maritime Policy"
              }
            />
          </Field>
          <Field label={isId ? "Bidang Kompetensi" : "Competency Domain"} required>
            <input
              value={formFields.competency}
              onChange={(e) => updateField("competency", e.target.value)}
              className={inp}
              required
              placeholder={
                isId
                  ? "Contoh: Manajemen Zonasi & Pemantauan Bioekologi"
                  : "e.g., Spatial Zoning & Bioecological Monitoring"
              }
            />
          </Field>
          <Field label={isId ? "Format Pembelajaran" : "Delivery Format"} required>
            <select
              value={formFields.deliveryFormat}
              onChange={(e) => updateField("deliveryFormat", e.target.value)}
              className={inp}
              required
            >
              <option value="Self-paced">Self-paced (Mandiri Online)</option>
              <option value="Scheduled">Scheduled (Terkurasi / Terjadwal)</option>
              <option value="Blended">Blended (Kombinasi Daring &amp; Tatap Muka)</option>
            </select>
          </Field>
          <Field
            label={
              isId
                ? "Estimasi Jam Pembelajaran (Jam)"
                : "Estimated Learning Hours"
            }
            required
          >
            <input
              type="number"
              min={1}
              value={formFields.hours}
              onChange={(e) => updateField("hours", Number(e.target.value))}
              className={inp}
              required
            />
          </Field>
          <Field label={isId ? "Tingkat Kesulitan (Level)" : "Difficulty Level"} required>
            <select
              value={formFields.level}
              onChange={(e) => updateField("level", e.target.value)}
              className={inp}
              required
            >
              <option value="Introductory">Introductory (Pemula)</option>
              <option value="Intermediate">Intermediate (Menengah)</option>
              <option value="Advanced">Advanced (Lanjutan)</option>
            </select>
          </Field>
          <Field label={isId ? "Bahasa Pengantar" : "Instruction Language"} required>
            <input
              value={formFields.language}
              onChange={(e) => updateField("language", e.target.value)}
              className={inp}
              required
            />
          </Field>
          <Field label={isId ? "Profil Target Peserta" : "Target Audience Profile"} required>
            <input
              value={formFields.targetParticipants}
              onChange={(e) => updateField("targetParticipants", e.target.value)}
              className={inp}
              required
              placeholder={
                isId
                  ? "Contoh: Peneliti kelautan, staf BKSDA, mahasiswa perikanan"
                  : "e.g., Marine researchers, conservation officers, students"
              }
            />
          </Field>
        </Grid>

        <Field label={isId ? "Ringkasan Modul (Deskripsi Singkat)" : "Module Summary"} required>
          <textarea
            value={formFields.summary}
            onChange={(e) => updateField("summary", e.target.value)}
            className={`${inp} min-h-[95px]`}
            required
            placeholder={
              isId
                ? "Jelaskan gambaran umum materi pelatihan, relevansi industri maritim, dan kompetensi yang akan dicapai..."
                : "Describe the overview of the training module, maritime industry relevance, and key learning goals..."
            }
          />
        </Field>
      </Section>
  );
}
