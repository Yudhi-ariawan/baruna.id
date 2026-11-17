// Course Offering draft form (PB-ACA-02): which Master Course, schedule,
// delivery mode, learning model, enrolment rule, cost model and completion
// evaluation. Choices follow the database rules (self-paced is online only and
// has an access model; cohort-based has a payment responsibility).
import type { OfferingPayload, ProgramOverview } from "@/lib/academy/programs.functions";
import {
  ACCESS_RULE,
  DELIVERY_FORMAT,
  EVALUATION_CONTEXT,
  LEARNING_MODEL,
  PAYMENT_RESPONSIBILITY,
  SELECTABLE_ACCESS_RULE,
  SELF_PACED_ACCESS,
  UNSUPPORTED_DELIVERY_MODES,
} from "./programLabels";
import { cleanCode, errCls, type FieldErrors } from "./programValidation";
import { FieldError } from "./FieldError";

const input = "mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm disabled:bg-slate-50";
const label = "block text-xs font-semibold text-navy";
const SELF_PACED_MODES = ["open_self_paced", "approved_self_paced"];

type Props = {
  value: OfferingPayload;
  onChange: (next: OfferingPayload) => void;
  lookups: ProgramOverview["lookups"];
  isNew: boolean;
  /** Offering already has applicants/participants: learning setup is fixed. */
  inUse: boolean;
  disabled: boolean;
  courseTitle?: string | null;
  /** Field-level problems to show (red border + message). */
  errors?: FieldErrors;
};

function Options({ map }: { map: Record<string, string> }) {
  return <>{Object.entries(map).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</>;
}

export function OfferingDraftForm({ value, onChange, lookups, isNew, inUse, disabled, courseTitle, errors = {} }: Props) {
  const set = (patch: Partial<OfferingPayload>) => onChange({ ...value, ...patch });
  const locked = disabled || inUse;
  const selfPaced = value.learning_model === "self_paced";
  const modes = lookups.deliveryModes.filter(
    (m) => !UNSUPPORTED_DELIVERY_MODES.includes(m.code) && (!value.learning_model || SELF_PACED_MODES.includes(m.code) === selfPaced),
  );
  const templates = (lookups.evaluationTemplates ?? []).filter((t) => t.context === value.completion_evaluation_context);
  // Paid access models need a payment that does not exist yet (migration 20261105030000).
  const accessModels: Record<string, string> =
    value.self_paced_access_model && value.self_paced_access_model !== "free"
      ? { free: SELF_PACED_ACCESS.free, [value.self_paced_access_model]: `${SELF_PACED_ACCESS[value.self_paced_access_model]} (belum tersedia)` }
      : { free: SELF_PACED_ACCESS.free };
  // An older draft may still hold a rule that is no longer offered: show it so the form is honest.
  const rules: Record<string, string> =
    value.enrolment_access_rule && !(value.enrolment_access_rule in SELECTABLE_ACCESS_RULE)
      ? { ...SELECTABLE_ACCESS_RULE, [value.enrolment_access_rule]: `${ACCESS_RULE[value.enrolment_access_rule]} (belum tersedia)` }
      : SELECTABLE_ACCESS_RULE;

  // Switching the learning model clears the fields that no longer apply.
  const setModel = (model: OfferingPayload["learning_model"]) =>
    set(
      model === "self_paced"
        ? { learning_model: model, delivery_format: "fully_online", cohort_payment_responsibility: null, delivery_mode_code: undefined }
        : { learning_model: model, self_paced_access_model: null, delivery_mode_code: undefined },
    );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className={`${label} sm:col-span-2`}>
        Master Course {isNew ? "" : "(tetap)"}
        {isNew ? (
          <select className={`${input} ${errCls(errors.master_course_id)}`} data-field="master_course_id" value={value.master_course_id ?? ""} disabled={disabled} onChange={(e) => set({ master_course_id: e.target.value })}>
            <option value="">Pilih Master Course aktif…</option>
            {lookups.activeCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        ) : (
          <input className={input} value={courseTitle ?? value.master_course_id ?? ""} disabled />
        )}
        <FieldError msg={errors.master_course_id} />
      </label>
      <label className={label}>
        Kode offering {isNew ? "(tidak bisa diubah setelah disetujui)" : "(tetap)"}
        <input className={`${input} ${errCls(errors.offering_code)}`} data-field="offering_code" value={value.offering_code ?? ""} disabled={disabled || !isNew} maxLength={80}
          onChange={(e) => set({ offering_code: cleanCode(e.target.value, "lower") })} placeholder="mis. africa-fisheries-2026-b1" />
        <FieldError msg={errors.offering_code} />
      </label>
      <label className={label}>
        Judul offering
        <input className={`${input} ${errCls(errors.offering_title)}`} data-field="offering_title" value={value.offering_title ?? ""} disabled={disabled} maxLength={200} onChange={(e) => set({ offering_title: e.target.value })} />
        <FieldError msg={errors.offering_title} />
      </label>
      <label className={label}>
        Nama angkatan (opsional)
        <input className={`${input} ${errCls(errors.cohort_name)}`} data-field="cohort_name" value={value.cohort_name ?? ""} disabled={disabled} maxLength={120}
          onChange={(e) => set({ cohort_name: e.target.value || null })} placeholder="mis. Angkatan 1" />
        <FieldError msg={errors.cohort_name} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={label}>
          Tahun
          <input className={`${input} ${errCls(errors.year)}`} data-field="year" inputMode="numeric" value={value.year ?? ""} disabled={disabled}
            onChange={(e) => set({ year: e.target.value === "" ? undefined : Number(e.target.value) })} />
          <FieldError msg={errors.year} />
      </label>
        <label className={label}>
          Batch (opsional)
          <input className={`${input} ${errCls(errors.batch_number)}`} data-field="batch_number" inputMode="numeric" value={value.batch_number ?? ""} disabled={disabled}
            onChange={(e) => set({ batch_number: e.target.value === "" ? null : Number(e.target.value) })} />
          <FieldError msg={errors.batch_number} />
      </label>
      </div>

      {inUse ? (
        <p className="text-xs text-amber-800 sm:col-span-2">
          Offering ini sudah punya pendaftar: model belajar, delivery mode, aturan pendaftaran, model biaya, dan evaluasi akhir tidak bisa diubah.
        </p>
      ) : null}
      <label className={label}>
        Model belajar
        <select className={`${input} ${errCls(errors.learning_model)}`} data-field="learning_model" value={value.learning_model ?? ""} disabled={locked}
          onChange={(e) => setModel(e.target.value as OfferingPayload["learning_model"])}>
          <option value="">Pilih…</option>
          <Options map={LEARNING_MODEL} />
        </select>
        <FieldError msg={errors.learning_model} />
      </label>
      <label className={label}>
        Delivery mode
        <select className={`${input} ${errCls(errors.delivery_mode_code)}`} data-field="delivery_mode_code" value={value.delivery_mode_code ?? ""} disabled={locked || !value.learning_model}
          onChange={(e) => set({ delivery_mode_code: e.target.value })}>
          <option value="">Pilih…</option>
          {modes.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
        </select>
        <FieldError msg={errors.delivery_mode_code} />
      </label>
      <label className={label}>
        Format penyampaian
        <select className={`${input} ${errCls(errors.delivery_format)}`} data-field="delivery_format" value={value.delivery_format ?? ""} disabled={locked || selfPaced}
          onChange={(e) => set({ delivery_format: e.target.value as OfferingPayload["delivery_format"] })}>
          <option value="">Pilih…</option>
          <Options map={selfPaced ? { fully_online: DELIVERY_FORMAT.fully_online } : DELIVERY_FORMAT} />
        </select>
        <FieldError msg={errors.delivery_format} />
      </label>
      <label className={label}>
        Aturan pendaftaran
        <select className={`${input} ${errCls(errors.enrolment_access_rule)}`} data-field="enrolment_access_rule" value={value.enrolment_access_rule ?? ""} disabled={locked}
          onChange={(e) => set({ enrolment_access_rule: e.target.value as OfferingPayload["enrolment_access_rule"] })}>
          <option value="">Pilih…</option>
          <Options map={rules} />
        </select>
        <span className="mt-1 block font-normal text-muted-foreground">
          "Wajib disetujui admin": peserta mengajukan dari halaman course, lalu disetujui di Persetujuan Peserta. "Wajib hak akses khusus" belum tersedia.
        </span>
        <FieldError msg={errors.enrolment_access_rule} />
      </label>
      {value.enrolment_access_rule === "approval_required" ? (
        <label className={`${label} sm:col-span-2`}>
          Dokumen persyaratan (opsional, satu per baris, maks 10)
          <textarea className={`${input} min-h-[70px] ${errCls(errors.required_documents)}`} data-field="required_documents" disabled={disabled} maxLength={1400}
            value={(value.required_documents ?? []).join("\n")}
            onChange={(e) => set({ required_documents: e.target.value.split("\n") })}
            placeholder={"mis. Surat tugas dari instansi\nCV terbaru"} />
          <span className="mt-1 block font-normal text-muted-foreground">
            Peserta mengunggah tiap dokumen sebagai PDF (maks 10 MB) saat mengajukan. Kosongkan bila tidak ada.
          </span>
          <FieldError msg={errors.required_documents} />
      </label>
      ) : null}
      {selfPaced ? (
        <label className={label}>
          Model akses mandiri
          <select className={`${input} ${errCls(errors.self_paced_access_model)}`} data-field="self_paced_access_model" value={value.self_paced_access_model ?? ""} disabled={locked}
            onChange={(e) => set({ self_paced_access_model: (e.target.value || null) as OfferingPayload["self_paced_access_model"] })}>
            <option value="">Pilih…</option>
            <Options map={accessModels} />
          </select>
          <span className="mt-1 block font-normal text-muted-foreground">
            "Berbayar" dan "Gratis belajar" (sertifikat berbayar) belum tersedia: sistem belum punya pembayaran.
          </span>
          <FieldError msg={errors.self_paced_access_model} />
      </label>
      ) : value.learning_model === "cohort_based" ? (
        <label className={label}>
          Penanggung biaya (model biaya: fee-based)
          <select className={`${input} ${errCls(errors.cohort_payment_responsibility)}`} data-field="cohort_payment_responsibility" value={value.cohort_payment_responsibility ?? ""} disabled={locked}
            onChange={(e) => set({ cohort_payment_responsibility: e.target.value || null })}>
            <option value="">Pilih…</option>
            <Options map={PAYMENT_RESPONSIBILITY} />
          </select>
          <FieldError msg={errors.cohort_payment_responsibility} />
      </label>
      ) : <div />}

      {([
        ["opening_date", "Tanggal pembukaan"],
        ["closing_date", "Tanggal penutupan"],
        ["enrolment_start_date", "Pendaftaran dibuka"],
        ["enrolment_end_date", "Pendaftaran ditutup"],
      ] as const).map(([key, text]) => (
        <label key={key} className={label}>
          {text} (opsional)
          <input type="date" className={`${input} ${errCls(errors[key])}`} data-field={key} value={value[key] ?? ""} disabled={disabled}
            onChange={(e) => set({ [key]: e.target.value || null })} />
          <FieldError msg={errors[key]} />
        </label>
      ))}

      <label className={`${label} flex items-center gap-2 sm:col-span-2`}>
        <input type="checkbox" checked={Boolean(value.completion_evaluation_required)} disabled={locked}
          onChange={(e) => set({
            completion_evaluation_required: e.target.checked,
            completion_evaluation_context: e.target.checked ? value.completion_evaluation_context ?? null : null,
            completion_evaluation_template_id: e.target.checked ? value.completion_evaluation_template_id ?? null : null,
          })} />
        Peserta wajib mengisi evaluasi akhir sebelum sertifikat
      </label>
      {value.completion_evaluation_required ? (
        <>
          <label className={label}>
            Konteks evaluasi
            <select className={`${input} ${errCls(errors.completion_evaluation_context)}`} data-field="completion_evaluation_context" value={value.completion_evaluation_context ?? ""} disabled={locked}
              // A template belongs to one context: changing the context clears it.
              onChange={(e) => set({ completion_evaluation_context: e.target.value || null, completion_evaluation_template_id: null })}>
              <option value="">Pilih…</option>
              <Options map={EVALUATION_CONTEXT} />
            </select>
            <FieldError msg={errors.completion_evaluation_context} />
      </label>
          <label className={label}>
            Template evaluasi
            <select className={`${input} ${errCls(errors.completion_evaluation_template_id)}`} data-field="completion_evaluation_template_id" value={value.completion_evaluation_template_id ?? ""} disabled={locked || !value.completion_evaluation_context}
              onChange={(e) => set({ completion_evaluation_template_id: e.target.value || null })}>
              <option value="">{value.completion_evaluation_context ? "Pilih template…" : "Pilih konteks dulu"}</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            {value.completion_evaluation_context && templates.length === 0 ? (
              <span className="mt-1 block font-normal text-amber-800">
                Belum ada template aktif untuk konteks ini. Pilih konteks lain atau matikan evaluasi akhir.
              </span>
            ) : (
              <span className="mt-1 block font-normal text-muted-foreground">
                Kuesioner yang diisi peserta di tab Evaluation; sertifikat baru bisa terbit setelah peserta mengirimnya.
              </span>
            )}
            <FieldError msg={errors.completion_evaluation_template_id} />
      </label>
        </>
      ) : null}
    </div>
  );
}
