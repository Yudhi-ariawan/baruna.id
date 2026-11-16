// Field-level checks for the Program Academy draft forms, mirroring the database
// rules (_program_course_problem / _program_offering_problem). The database stays the
// authority; this only tells the user WHICH field to fix, before sending.
import type { CoursePayload, OfferingPayload } from "@/lib/academy/programs.functions";

export type FieldErrors = Record<string, string>;

/**
 * Codes: drop every whitespace (also tabs and non-breaking spaces from pasting) and
 * turn typographic dashes into "-". Course/offering codes join words with "-".
 */
export function cleanCode(v: string, mode: "upper" | "lower"): string {
  const dashed = v.replace(/[‐-―−]/g, "-");
  if (mode === "upper") return dashed.replace(/\s+/g, "").toUpperCase();
  return dashed.trim().replace(/\s+/g, "-").toLowerCase();
}

// Same as [[:cntrl:]] in the database check (_program_text_ok).
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

/** Red border for a field that needs fixing. */
export const errCls = (msg?: string) => (msg ? "border-red-400 bg-red-50/40 focus:outline-red-500" : "");
const textOk = (v: string | null | undefined, min: number, max: number) => {
  const t = (v ?? "").trim();
  return t.length >= min && t.length <= max && !CONTROL.test(v ?? "");
};
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MODULE_CODE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

export function courseFieldErrors(p: CoursePayload, opts: { isNew: boolean; languages: string[]; templates: string[] }): FieldErrors {
  const e: FieldErrors = {};
  const code = p.course_code ?? "";
  if (opts.isNew && (!SLUG.test(code) || code.length < 3 || code.length > 80)) {
    e.course_code = "3–80 karakter: huruf kecil, angka, dan tanda hubung di antara kata (mis. africa-fisheries-training). Tanpa spasi.";
  }
  if (!textOk(p.title, 3, 200)) e.title = "Judul wajib 3–200 karakter.";
  if ((p.description ?? "").length > 4000) e.description = "Deskripsi maksimal 4.000 karakter.";
  if (!opts.languages.includes((p.language ?? "").toLowerCase())) e.language = "Pilih bahasa.";
  if (!opts.templates.includes(p.learning_template_code ?? "")) e.learning_template_code = "Pilih template pembelajaran.";
  const modules = p.modules ?? [];
  if (modules.length === 0) e.modules = "Tambahkan minimal satu modul.";
  if (modules.length > 60) e.modules = "Maksimal 60 modul.";
  const seen = new Map<string, number>();
  modules.forEach((m, i) => {
    const c = m.module_code ?? "";
    if (!MODULE_CODE.test(c) || c.length < 2 || c.length > 30) {
      e[`module.${i}.code`] = /\s/.test(c)
        ? "Ada spasi/Tab tersembunyi. Hapus lalu ketik ulang kodenya."
        : "2–30 karakter: huruf besar, angka, dan tanda hubung (mis. AFT-01).";
    } else if (seen.has(c)) {
      e[`module.${i}.code`] = `Kode sama dengan modul #${(seen.get(c) ?? 0) + 1}.`;
    } else {
      seen.set(c, i);
    }
    if (!textOk(m.title, 2, 200)) e[`module.${i}.title`] = "Judul modul wajib 2–200 karakter.";
    const h = Number(m.learning_hours);
    if (!Number.isFinite(h) || h <= 0 || h > 500) e[`module.${i}.hours`] = "Jam harus angka lebih dari 0 (maks 500).";
  });
  return e;
}

export function offeringFieldErrors(p: OfferingPayload, opts: { isNew: boolean }): FieldErrors {
  const e: FieldErrors = {};
  if (opts.isNew) {
    if (!p.master_course_id) e.master_course_id = "Pilih Master Course.";
    const code = p.offering_code ?? "";
    if (!SLUG.test(code) || code.length < 3 || code.length > 80) {
      e.offering_code = "3–80 karakter: huruf kecil, angka, dan tanda hubung di antara kata (mis. africa-fisheries-2026-b1). Tanpa spasi.";
    }
  }
  if (!textOk(p.offering_title, 3, 200)) e.offering_title = "Judul offering wajib 3–200 karakter.";
  if (p.cohort_name && !textOk(p.cohort_name, 1, 120)) e.cohort_name = "Nama angkatan maksimal 120 karakter.";
  if (typeof p.year !== "number" || !Number.isInteger(p.year) || p.year < 2020 || p.year > 2100) e.year = "Tahun 2020–2100.";
  if (p.batch_number !== null && p.batch_number !== undefined && (!Number.isInteger(p.batch_number) || p.batch_number < 1 || p.batch_number > 1000)) {
    e.batch_number = "Batch harus bilangan bulat 1–1.000.";
  }
  if (!p.learning_model) e.learning_model = "Pilih model belajar.";
  if (!p.delivery_mode_code) e.delivery_mode_code = "Pilih delivery mode.";
  if (!p.delivery_format) e.delivery_format = "Pilih format penyampaian.";
  if (!p.enrolment_access_rule) e.enrolment_access_rule = "Pilih aturan pendaftaran.";
  if (p.learning_model === "self_paced" && !p.self_paced_access_model) e.self_paced_access_model = "Pilih model akses mandiri.";
  if (p.learning_model === "cohort_based" && !p.cohort_payment_responsibility) e.cohort_payment_responsibility = "Pilih penanggung biaya.";

  const docs = (p.required_documents ?? []).map((d) => d.trim()).filter(Boolean);
  if (p.enrolment_access_rule === "approval_required") {
    const bad = docs.findIndex((d) => d.length < 2 || d.length > 120);
    const lower = docs.map((d) => d.toLowerCase());
    const dup = lower.findIndex((d, i) => lower.indexOf(d) !== i);
    if (docs.length > 10) e.required_documents = "Maksimal 10 dokumen.";
    else if (bad >= 0) e.required_documents = `Baris ${bad + 1}: nama dokumen 2–120 karakter.`;
    else if (dup >= 0) e.required_documents = `Baris ${dup + 1}: "${docs[dup]}" ditulis dua kali.`;
  }

  const d = (k: keyof OfferingPayload) => (p[k] as string | null | undefined) || null;
  if (d("opening_date") && d("closing_date") && d("closing_date")! < d("opening_date")!) e.closing_date = "Tanggal penutupan tidak boleh sebelum pembukaan.";
  if (d("enrolment_start_date") && d("enrolment_end_date") && d("enrolment_end_date")! < d("enrolment_start_date")!) {
    e.enrolment_end_date = "Pendaftaran ditutup tidak boleh sebelum dibuka.";
  }
  if (d("enrolment_end_date") && d("closing_date") && d("enrolment_end_date")! > d("closing_date")!) {
    e.enrolment_end_date = "Pendaftaran harus ditutup paling lambat pada tanggal penutupan.";
  }
  if (p.completion_evaluation_required) {
    if (!p.completion_evaluation_context) e.completion_evaluation_context = "Pilih konteks evaluasi.";
    else if (!p.completion_evaluation_template_id) e.completion_evaluation_template_id = "Pilih template evaluasi.";
  }
  return e;
}

/** Labels for the summary under the form ("Modul #1 — Kode: …"). */
export function fieldLabel(key: string): string {
  const m = key.match(/^module\.(\d+)\.(code|title|hours)$/);
  if (m) return `Modul #${Number(m[1]) + 1} — ${{ code: "Kode", title: "Judul", hours: "Jam" }[m[2] as "code"]}`;
  return ({
    course_code: "Kode course", title: "Judul", description: "Deskripsi", language: "Bahasa", learning_template_code: "Template pembelajaran",
    modules: "Master Module", master_course_id: "Master Course", offering_code: "Kode offering", offering_title: "Judul offering",
    cohort_name: "Nama angkatan", year: "Tahun", batch_number: "Batch", learning_model: "Model belajar", delivery_mode_code: "Delivery mode",
    delivery_format: "Format penyampaian", enrolment_access_rule: "Aturan pendaftaran", required_documents: "Dokumen persyaratan",
    self_paced_access_model: "Model akses mandiri", cohort_payment_responsibility: "Penanggung biaya", closing_date: "Tanggal penutupan",
    enrolment_end_date: "Pendaftaran ditutup", completion_evaluation_context: "Konteks evaluasi", completion_evaluation_template_id: "Template evaluasi",
  } as Record<string, string>)[key] ?? key;
}
