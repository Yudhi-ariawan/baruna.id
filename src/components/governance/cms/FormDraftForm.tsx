// Form Builder: address, title, description, daily limit, and the list of fields.
import { CMS_DOMAIN_LABEL, CMS_FIELD_TYPES, CMS_FIELD_TYPE_LABEL, type CmsField, type CmsFieldType, type CmsFormPayload } from "@/lib/cms/cms-types";
import { FieldError } from "@/components/baruna/forms/FieldError";
import { fieldErrorCls } from "@/components/baruna/forms/field-errors";
import { CmsBilingual, CmsText, RowTools } from "./CmsInputs";
import { moveItem, setAt } from "./cmsLabels";

type Props = { value: CmsFormPayload; onChange: (f: CmsFormPayload) => void; errors: Record<string, string>; disabled: boolean; isNew: boolean };

const newField = (n: number): CmsField => ({ key: `kolom_${n}`, label_id: "", label_en: "", help_id: "", help_en: "", type: "text", required: false });

export function FormDraftForm({ value: f, onChange, errors, disabled, isNew }: Props) {
  const setFields = (fields: CmsField[]) => onChange({ ...f, fields });
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Menu pemilik: <b className="text-navy">{CMS_DOMAIN_LABEL[f.domain]}</b></p>
      <CmsText label="Alamat formulir (slug)" required value={f.slug} field="slug" error={errors.slug} maxLength={80} disabled={disabled || !isNew}
        onChange={(v) => onChange({ ...f, slug: v.toLowerCase() })}
        hint={isNew ? `Tampil di /f/${f.slug || "alamat"}, dan bisa dipasang di halaman lewat blok Formulir.` : "Alamat tidak bisa diubah setelah tayang."} />
      <CmsBilingual label="Judul" field="title" errors={errors} idValue={f.title_id} enValue={f.title_en} required maxLength={160}
        onId={(v) => onChange({ ...f, title_id: v })} onEn={(v) => onChange({ ...f, title_en: v })} disabled={disabled} />
      <CmsBilingual label="Deskripsi (opsional)" field="description" errors={errors} idValue={f.description_id} enValue={f.description_en}
        multiline rows={2} maxLength={2000} onId={(v) => onChange({ ...f, description_id: v })} onEn={(v) => onChange({ ...f, description_en: v })} disabled={disabled} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-navy" data-field="max_per_user_per_day">
          Batas kiriman per orang per hari (1–20)
          <input type="number" min={1} max={20} value={f.max_per_user_per_day} disabled={disabled}
            onChange={(e) => onChange({ ...f, max_per_user_per_day: Number(e.target.value) })}
            className={"mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm" + fieldErrorCls(errors.max_per_user_per_day)} />
          <FieldError msg={errors.max_per_user_per_day} />
        </label>
        <label className="flex items-center gap-2 pt-5 text-xs font-semibold text-navy">
          <input type="checkbox" checked={f.notify_on_submit} disabled={disabled} onChange={(e) => onChange({ ...f, notify_on_submit: e.target.checked })} />
          Kiriman baru ikut dihitung di lencana menu "Konten Situs (CMS)"
        </label>
      </div>

      <div className="space-y-3" data-field="fields">
        <h3 className="text-sm font-semibold text-navy">Kolom formulir ({f.fields.length}/30). Pengirim wajib login.</h3>
        {f.fields.map((fd, i) => {
          const k = (x: string) => `field.${i}.${x}`;
          const set = (patch: Partial<CmsField>) => setFields(setAt(f.fields, i, { ...fd, ...patch }));
          return (
            <section key={i} className="space-y-2 rounded-2xl border border-border bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-marine">Kolom {i + 1}</span>
                <RowTools disabled={disabled} onUp={i > 0 ? () => setFields(moveItem(f.fields, i, i - 1)) : undefined}
                  onDown={i < f.fields.length - 1 ? () => setFields(moveItem(f.fields, i, i + 1)) : undefined}
                  onRemove={() => setFields(f.fields.filter((_, x) => x !== i))} />
              </div>
              <CmsBilingual label="Label" field={k("label")} errors={errors} idValue={fd.label_id} enValue={fd.label_en} required maxLength={160}
                onId={(v) => set({ label_id: v })} onEn={(v) => set({ label_en: v })} disabled={disabled} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <CmsText label="Kode kolom" required value={fd.key} field={k("key")} error={errors[k("key")]} disabled={disabled} maxLength={40}
                  onChange={(v) => set({ key: v.toLowerCase() })} hint="Untuk judul kolom di CSV (mis. nama_instansi)." />
                <label className="block text-xs font-semibold text-navy" data-field={k("type")}>
                  Jenis
                  <select value={fd.type} disabled={disabled} onChange={(e) => set({ type: e.target.value as CmsFieldType, options: e.target.value === "select" ? (fd.options ?? ["", ""]) : undefined, max_length: null })}
                    className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm">
                    {CMS_FIELD_TYPES.map((tp) => <option key={tp} value={tp}>{CMS_FIELD_TYPE_LABEL[tp]}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 pt-5 text-xs font-semibold text-navy">
                  <input type="checkbox" checked={fd.required} disabled={disabled} onChange={(e) => set({ required: e.target.checked })} /> Wajib diisi
                </label>
              </div>
              {fd.type === "select" ? (
                <CmsText label="Pilihan (satu per baris, 2–30)" multiline rows={3} value={(fd.options ?? []).join("\n")} field={k("options")}
                  error={errors[k("options")]} disabled={disabled} onChange={(v) => set({ options: v.split("\n") })} />
              ) : null}
              <CmsBilingual label="Petunjuk (opsional)" field={k("help")} errors={errors} idValue={fd.help_id} enValue={fd.help_en} maxLength={300}
                onId={(v) => set({ help_id: v })} onEn={(v) => set({ help_en: v })} disabled={disabled} />
            </section>
          );
        })}
        {!disabled ? (
          <button type="button" disabled={f.fields.length >= 30} onClick={() => setFields([...f.fields, newField(f.fields.length + 1)])}
            className="rounded-lg border border-dashed border-marine px-3 py-1.5 text-xs font-semibold text-marine hover:bg-marine/5 disabled:opacity-40">
            + Tambah kolom
          </button>
        ) : null}
        <FieldError msg={errors.fields} />
      </div>
    </div>
  );
}
