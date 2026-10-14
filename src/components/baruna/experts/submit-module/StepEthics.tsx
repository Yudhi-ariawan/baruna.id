import { Eye } from "lucide-react";
import { Section, Grid, Field, inp } from "./FormPrimitives";
import { DECLARATIONS, type ModuleFormFields, type UpdateField } from "./config";

export function StepEthics({
  isId,
  formFields,
  updateField,
  totalFilesCount,
  videoUrl,
  checked,
  setChecked,
  allDecls,
}: {
  isId: boolean;
  formFields: ModuleFormFields;
  updateField: UpdateField;
  totalFilesCount: number;
  videoUrl: string;
  checked: Record<number, boolean>;
  setChecked: (v: Record<number, boolean>) => void;
  allDecls: boolean;
}) {
  return (
    <>
      {/* Summary Card Preview */}
      <div className="rounded-2xl border border-marine/30 bg-marine/5 p-5 shadow-soft">
        <div className="flex items-center gap-2 font-display text-sm font-bold text-navy mb-3">
          <Eye className="h-4 w-4 text-marine" />
          {isId ? "Ringkasan Pratinjau Modul" : "Module Summary Preview"}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="rounded-xl border border-border bg-card p-3">
            <span className="text-[10px] text-muted-foreground uppercase font-bold block">
              {isId ? "Judul Modul" : "Title"}
            </span>
            <p className="font-semibold text-navy truncate mt-0.5">
              {formFields.title || "-"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <span className="text-[10px] text-muted-foreground uppercase font-bold block">
              {isId ? "Format & Jam" : "Format & Hours"}
            </span>
            <p className="font-semibold text-navy truncate mt-0.5">
              {formFields.deliveryFormat} ({formFields.hours} Jam)
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <span className="text-[10px] text-muted-foreground uppercase font-bold block">
              {isId ? "Tingkat Kesulitan" : "Level"}
            </span>
            <p className="font-semibold text-navy truncate mt-0.5">
              {formFields.level} ({formFields.language})
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <span className="text-[10px] text-muted-foreground uppercase font-bold block">
              {isId ? "Berkas / Media" : "Attached Files"}
            </span>
            <p className="font-semibold text-navy truncate mt-0.5">
              {totalFilesCount} Berkas {videoUrl ? "+ 1 Video" : ""}
            </p>
          </div>
        </div>
      </div>

      <Section
        title={isId ? "4. Hak Cipta, Orisinalitas & Etika" : "4. Copyright, Ethics & Declarations"}
        subtitle={
          isId
            ? "Lengkapi deklarasi kepemilikan karya dan setujui kode etik peninjauan modul BARUNA."
            : "Complete copyright ownership details and accept the BARUNA trainer review code of conduct."
        }
      >
        <Grid>
          <Field
            label={isId ? "Pemegang Hak Cipta (Copyright Holder)" : "Copyright Holder"}
            required
          >
            <input
              value={formFields.copyrightHolder}
              onChange={(e) => updateField("copyrightHolder", e.target.value)}
              className={inp}
              required
            />
          </Field>
          <Field label={isId ? "Lisensi Penggunaan" : "Usage License"}>
            <input
              value={formFields.licensing}
              onChange={(e) => updateField("licensing", e.target.value)}
              className={inp}
              placeholder="e.g. CC BY-NC-SA 4.0"
            />
          </Field>
        </Grid>

        <div className="space-y-3 rounded-xl border border-marine/20 bg-marine/5 p-4">
          <div className="flex items-center justify-between border-b border-marine/15 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-marine">
              {isId ? "Pernyataan Etika & Orisinalitas (Wajib)" : "Ethics & Originality Declarations (Required)"}
            </span>
            <button
              type="button"
              onClick={() => {
                const next = !allDecls;
                setChecked({ 0: next, 1: next, 2: next, 3: next });
              }}
              className="text-xs font-semibold text-marine hover:underline cursor-pointer"
            >
              {allDecls
                ? isId
                  ? "Batal Pilih Semua"
                  : "Deselect All"
                : isId
                  ? "Pilih Semua (Select All)"
                  : "Select All"}
            </button>
          </div>
          {DECLARATIONS.map((d, i) => (
            <label
              key={i}
              className="flex items-start gap-2 text-xs font-medium text-foreground/85 cursor-pointer"
            >
              <input
                type="checkbox"
                className="mt-0.5 accent-marine cursor-pointer"
                checked={!!checked[i]}
                onChange={(e) => setChecked({ ...checked, [i]: e.target.checked })}
              />
              {d}
            </label>
          ))}
        </div>
      </Section>
    </>
  );
}
