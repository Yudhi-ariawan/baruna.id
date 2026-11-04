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
};

function Options({ map }: { map: Record<string, string> }) {
  return <>{Object.entries(map).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</>;
}

export function OfferingDraftForm({ value, onChange, lookups, isNew, inUse, disabled, courseTitle }: Props) {
  const set = (patch: Partial<OfferingPayload>) => onChange({ ...value, ...patch });
  const locked = disabled || inUse;
  const selfPaced = value.learning_model === "self_paced";
  const modes = lookups.deliveryModes.filter(
    (m) => !UNSUPPORTED_DELIVERY_MODES.includes(m.code) && (!value.learning_model || SELF_PACED_MODES.includes(m.code) === selfPaced),
  );
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
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={`${label} sm:col-span-2`}>
        Master Course {isNew ? "" : "(tetap)"}
        {isNew ? (
          <select className={input} value={value.master_course_id ?? ""} disabled={disabled} onChange={(e) => set({ master_course_id: e.target.value })}>
            <option value="">Pilih Master Course aktif…</option>
            {lookups.activeCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        ) : (
          <input className={input} value={courseTitle ?? value.master_course_id ?? ""} disabled />
        )}
      </label>
      <label className={label}>
        Kode offering {isNew ? "(tidak bisa diubah setelah disetujui)" : "(tetap)"}
        <input className={input} value={value.offering_code ?? ""} disabled={disabled || !isNew} maxLength={80}
          onChange={(e) => set({ offering_code: e.target.value.toLowerCase() })} placeholder="mis. of-seaweed-2026" />
      </label>
      <label className={label}>
        Judul offering
        <input className={input} value={value.offering_title ?? ""} disabled={disabled} maxLength={200} onChange={(e) => set({ offering_title: e.target.value })} />
      </label>
      <label className={label}>
        Nama angkatan (opsional)
        <input className={input} value={value.cohort_name ?? ""} disabled={disabled} maxLength={120}
          onChange={(e) => set({ cohort_name: e.target.value || null })} placeholder="mis. Angkatan 1" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={label}>
          Tahun
          <input className={input} inputMode="numeric" value={value.year ?? ""} disabled={disabled}
            onChange={(e) => set({ year: e.target.value === "" ? undefined : Number(e.target.value) })} />
        </label>
        <label className={label}>
          Batch (opsional)
          <input className={input} inputMode="numeric" value={value.batch_number ?? ""} disabled={disabled}
            onChange={(e) => set({ batch_number: e.target.value === "" ? null : Number(e.target.value) })} />
        </label>
      </div>

      {inUse ? (
        <p className="text-xs text-amber-800 sm:col-span-2">
          Offering ini sudah punya pendaftar: model belajar, delivery mode, aturan pendaftaran, dan model biaya tidak bisa diubah.
        </p>
      ) : null}
      <label className={label}>
        Model belajar
        <select className={input} value={value.learning_model ?? ""} disabled={locked}
          onChange={(e) => setModel(e.target.value as OfferingPayload["learning_model"])}>
          <option value="">Pilih…</option>
          <Options map={LEARNING_MODEL} />
        </select>
      </label>
      <label className={label}>
        Delivery mode
        <select className={input} value={value.delivery_mode_code ?? ""} disabled={locked || !value.learning_model}
          onChange={(e) => set({ delivery_mode_code: e.target.value })}>
          <option value="">Pilih…</option>
          {modes.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
        </select>
      </label>
      <label className={label}>
        Format penyampaian
        <select className={input} value={value.delivery_format ?? ""} disabled={locked || selfPaced}
          onChange={(e) => set({ delivery_format: e.target.value as OfferingPayload["delivery_format"] })}>
          <option value="">Pilih…</option>
          <Options map={selfPaced ? { fully_online: DELIVERY_FORMAT.fully_online } : DELIVERY_FORMAT} />
        </select>
      </label>
      <label className={label}>
        Aturan pendaftaran
        <select className={input} value={value.enrolment_access_rule ?? ""} disabled={locked}
          onChange={(e) => set({ enrolment_access_rule: e.target.value as OfferingPayload["enrolment_access_rule"] })}>
          <option value="">Pilih…</option>
          <Options map={rules} />
        </select>
        <span className="mt-1 block font-normal text-muted-foreground">
          "Wajib disetujui admin" dan "Wajib hak akses khusus" belum tersedia: peserta belum punya formulir pengajuan untuk offering ini.
        </span>
      </label>
      {selfPaced ? (
        <label className={label}>
          Model akses mandiri
          <select className={input} value={value.self_paced_access_model ?? ""} disabled={locked}
            onChange={(e) => set({ self_paced_access_model: (e.target.value || null) as OfferingPayload["self_paced_access_model"] })}>
            <option value="">Pilih…</option>
            <Options map={SELF_PACED_ACCESS} />
          </select>
        </label>
      ) : value.learning_model === "cohort_based" ? (
        <label className={label}>
          Penanggung biaya (model biaya: fee-based)
          <select className={input} value={value.cohort_payment_responsibility ?? ""} disabled={locked}
            onChange={(e) => set({ cohort_payment_responsibility: e.target.value || null })}>
            <option value="">Pilih…</option>
            <Options map={PAYMENT_RESPONSIBILITY} />
          </select>
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
          <input type="date" className={input} value={value[key] ?? ""} disabled={disabled}
            onChange={(e) => set({ [key]: e.target.value || null })} />
        </label>
      ))}

      <label className={`${label} flex items-center gap-2 sm:col-span-2`}>
        <input type="checkbox" checked={Boolean(value.completion_evaluation_required)} disabled={disabled}
          onChange={(e) => set({ completion_evaluation_required: e.target.checked, completion_evaluation_context: e.target.checked ? value.completion_evaluation_context ?? null : null })} />
        Peserta wajib mengisi evaluasi akhir sebelum sertifikat
      </label>
      {value.completion_evaluation_required ? (
        <label className={label}>
          Konteks evaluasi
          <select className={input} value={value.completion_evaluation_context ?? ""} disabled={disabled}
            onChange={(e) => set({ completion_evaluation_context: e.target.value || null })}>
            <option value="">Pilih…</option>
            <Options map={EVALUATION_CONTEXT} />
          </select>
        </label>
      ) : null}
    </div>
  );
}
