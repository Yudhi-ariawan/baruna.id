// ============================================================================
// Program Academy: Master Course, Master Module, Course Offering (PB-ACA-01/02,
// Slide 20-21). Every read and write goes through RPCs (migration 20261104010000)
// that check the role, validate the draft, keep the live version until a
// different approver decides, and write the audit trail.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// The program RPCs are newer than the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type ProgramKind = "master_course" | "course_offering";
export type DraftStatus = "draft" | "submitted" | "revision_requested" | "approved" | "rejected" | "withdrawn";

export type ModulePayload = { module_code: string; title: string; learning_hours: number };
export type CoursePayload = {
  course_code?: string;
  title?: string;
  description?: string | null;
  language?: string;
  learning_template_code?: string;
  /** Uploaded cover in the public cover bucket (academy-courses/…), or null. */
  cover_path?: string | null;
  modules?: ModulePayload[];
};
export type OfferingPayload = {
  master_course_id?: string;
  offering_code?: string;
  offering_title?: string;
  cohort_name?: string | null;
  batch_number?: number | null;
  year?: number;
  delivery_mode_code?: string;
  opening_date?: string | null;
  closing_date?: string | null;
  enrolment_start_date?: string | null;
  enrolment_end_date?: string | null;
  learning_model?: "self_paced" | "cohort_based";
  delivery_format?: "fully_online" | "blended" | "in_person";
  enrolment_access_rule?: "open" | "registered" | "approval_required" | "entitlement_required";
  self_paced_access_model?: "free" | "paid" | "free_to_learn" | null;
  cohort_payment_responsibility?: string | null;
  completion_evaluation_required?: boolean;
  completion_evaluation_context?: string | null;
};

export type ProgramOverview = {
  canDecide: boolean;
  courses: Array<{
    id: string; code: string; title: string; status: string; version: number; language: string | null; updatedAt: string;
    moduleCount: number; offeringCount: number; inUse: boolean; legacy: boolean; openDraftId: string | null;
  }>;
  offerings: Array<{
    id: string; code: string; title: string; courseId: string; courseTitle: string | null; status: string; version: number;
    year: number | null; cohortName: string | null; deliveryMode: string | null; learningModel: string | null; engine: string;
    path: string | null; inUse: boolean; legacy: boolean; openDraftId: string | null;
  }>;
  drafts: Array<{
    id: string; kind: ProgramKind; targetId: string | null; status: DraftStatus; title: string; createdBy: string | null;
    mine: boolean; submittedAt: string | null; updatedAt: string; decisionNote: string | null;
  }>;
  lookups: {
    deliveryModes: Array<{ code: string; name: string }>;
    templates: Array<{ code: string; name: string }>;
    languages: Array<{ code: string; name: string }>;
    activeCourses: Array<{ id: string; title: string }>;
  };
};

export type ProgramDraft = {
  id: string; kind: ProgramKind; targetId: string | null; status: DraftStatus;
  payload: CoursePayload & OfferingPayload; baseVersion: number | null; updatedAt: string; submittedAt: string | null;
  decisionNote: string | null; decidedAt: string | null; createdBy: string | null; mine: boolean; canDecide: boolean;
  /** First validation problem (error code), or null when the draft can be sent. */
  problem: string | null;
  live: (CoursePayload & OfferingPayload) | null;
  inUse: boolean;
  versions: Array<{ version: number; approvedAt: string; approvedBy: string | null }>;
};

const ERRORS: Record<string, string> = {
  forbidden: "Akun Anda tidak berwenang untuk tindakan ini.",
  authentication_required: "Sesi login berakhir. Silakan masuk kembali.",
  program_kind_invalid: "Jenis program tidak dikenal.",
  program_target_not_found: "Course atau offering tidak ditemukan. Muat ulang halaman.",
  program_legacy_readonly: "Program lama ini isinya ada di kode aplikasi, jadi hanya bisa dilihat di sini.",
  program_archived: "Course ini sudah diarsipkan.",
  program_draft_exists: "Sudah ada draf perubahan yang terbuka untuk data ini. Selesaikan atau tarik draf itu dulu.",
  program_draft_not_found: "Draf tidak ditemukan.",
  program_draft_not_editable: "Draf ini sudah dikirim atau sudah diputuskan, jadi tidak bisa diubah.",
  program_draft_stale: "Draf baru saja berubah di perangkat atau oleh orang lain. Muat ulang lalu ulangi.",
  program_draft_unchanged: "Belum ada perubahan dibanding versi yang tayang.",
  program_payload_invalid: "Isi draf tidak bisa dibaca. Muat ulang halaman.",
  program_course_code_invalid: "Kode course: 3–80 huruf kecil, angka, dan tanda hubung (mis. seaweed-farming).",
  program_course_code_exists: "Kode course itu sudah dipakai.",
  program_course_code_immutable: "Kode course tidak bisa diubah setelah dibuat.",
  program_title_invalid: "Judul wajib 3–200 karakter.",
  program_description_too_long: "Deskripsi maksimal 4.000 karakter.",
  program_language_unknown: "Pilih bahasa dari Data Master.",
  program_template_unknown: "Pilih template pembelajaran.",
  program_cover_invalid: "Gambar sampul tidak ditemukan atau tidak valid (PNG/JPG/WebP, maksimal 2 MB). Unggah ulang gambarnya.",
  program_modules_required: "Course wajib punya minimal satu modul.",
  program_modules_too_many: "Maksimal 60 modul per course.",
  program_module_code_invalid: "Kode modul: 2–30 huruf besar, angka, dan tanda hubung (mis. SW-01).",
  program_module_code_duplicate: "Ada kode modul yang sama.",
  program_module_title_invalid: "Judul modul wajib 2–200 karakter.",
  program_module_hours_invalid: "Jam pelajaran modul harus angka lebih dari 0 dan paling banyak 500.",
  program_modules_locked_in_use:
    "Course ini sudah dipakai peserta, jadi modul tidak bisa ditambah, dihapus, atau diganti kodenya (kelulusan dihitung dari semua modul). Judul, jam, dan urutan tetap bisa diubah.",
  program_offering_code_invalid: "Kode offering: 3–80 huruf kecil, angka, dan tanda hubung (mis. of-seaweed-2026).",
  program_offering_code_exists: "Kode offering itu sudah dipakai.",
  program_offering_code_immutable: "Kode offering tidak bisa diubah setelah dibuat.",
  program_offering_course_immutable: "Master Course offering tidak bisa diganti setelah dibuat.",
  program_course_not_active: "Master Course harus aktif.",
  program_cohort_invalid: "Nama angkatan maksimal 120 karakter.",
  program_year_invalid: "Tahun harus bilangan bulat 2020–2100.",
  program_batch_invalid: "Nomor batch harus bilangan bulat 1–1.000.",
  program_delivery_mode_unknown: "Pilih delivery mode.",
  program_learning_model_invalid: "Pilih model belajar.",
  program_delivery_format_invalid: "Pilih format penyampaian.",
  program_access_rule_invalid: "Pilih aturan pendaftaran.",
  program_access_rule_unsupported:
    "Aturan \"Wajib disetujui admin\", \"Wajib hak akses khusus\", dan delivery mode Approved Self-Paced belum tersedia: peserta belum punya formulir pengajuan untuk offering ini. Pilih \"Terbuka\" atau \"Wajib akun terdaftar\".",
  program_self_paced_online_only: "Pelatihan mandiri (self-paced) hanya bisa sepenuhnya online.",
  program_delivery_mode_mismatch: "Delivery mode tidak cocok dengan model belajar (mandiri atau berbasis angkatan).",
  program_self_paced_access_required: "Pelatihan mandiri wajib memilih model akses (gratis, berbayar, atau gratis belajar).",
  program_self_paced_access_not_applicable: "Model akses mandiri hanya untuk pelatihan self-paced.",
  program_payment_required: "Pelatihan berbasis angkatan wajib memilih penanggung biaya.",
  program_payment_not_applicable: "Penanggung biaya hanya untuk pelatihan berbasis angkatan.",
  program_evaluation_invalid: "Tentukan apakah evaluasi akhir wajib.",
  program_evaluation_context_required: "Evaluasi akhir wajib memilih konteks evaluasi.",
  program_date_invalid: "Tanggal tidak valid.",
  program_dates_order:
    "Urutan tanggal salah: penutupan tidak boleh sebelum pembukaan, dan pendaftaran harus selesai sebelum program ditutup.",
  program_offering_locked_in_use:
    "Offering ini sudah punya pendaftar, jadi delivery mode, model belajar, aturan pendaftaran, dan model biaya tidak bisa diubah. Judul, angkatan, dan tanggal tetap bisa diubah.",
  program_decision_invalid: "Keputusan tidak dikenal.",
  program_note_required: "Tuliskan alasan (minimal 5 karakter).",
  program_note_too_long: "Alasan maksimal 2.000 karakter.",
  program_self_decision_forbidden: "Draf yang Anda buat atau kirim sendiri harus diputuskan Approver/Admin lain.",
  program_not_submitted: "Draf ini belum dikirim atau sudah diputuskan.",
  program_stale: "Data tayang sudah berubah sejak draf dibuat. Tarik draf ini lalu buat draf baru.",
  program_status_invalid: "Status tidak dikenal.",
  program_status_unchanged: "Status sudah seperti itu.",
  program_course_has_published_offerings: "Course masih punya offering yang tayang. Selesaikan atau tutup offering-nya dulu.",
  program_open_drafts_exist: "Masih ada draf terbuka untuk course ini. Selesaikan atau tarik dulu.",
};

/** Friendly Indonesian message for an RPC error code (shared with the UI for the draft's `problem`). */
export function programErrorText(code: string): string {
  // Longest matching key wins: "program_self_decision_forbidden" must not read as "forbidden".
  const key = Object.keys(ERRORS)
    .filter((k) => code.includes(k))
    .sort((a, b) => b.length - a.length)[0];
  if (key) return ERRORS[key];
  if (/Could not find the function|schema cache/.test(code)) {
    return "Program Academy membutuhkan migrasi database 20261104010000. Jalankan supabase/check_migrations.sql.";
  }
  return code;
}

async function rpc<T>(context: { supabase: unknown }, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (context.supabase as Db).rpc(fn, args ?? {});
  if (error) throw new Error(programErrorText(error.message));
  return data as T;
}

const kind = z.enum(["master_course", "course_offering"]);

export const getProgramOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => rpc<ProgramOverview>(context, "program_overview"));

export const getProgramDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => rpc<ProgramDraft>(context, "program_draft_get", { _draft_id: data.id }));

export const openProgramDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ kind, targetId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) =>
    rpc<string>(context, "program_draft_open", { _kind: data.kind, _target_id: data.targetId }),
  );

export const saveProgramDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({ id: z.string().uuid(), payload: z.record(z.unknown()), expectedUpdatedAt: z.string().min(10) }).parse(d),
  )
  .handler(async ({ data, context }) =>
    rpc<string>(context, "program_draft_save", {
      _draft_id: data.id,
      _payload: data.payload,
      _expected_updated_at: data.expectedUpdatedAt,
    }),
  );

export const submitProgramDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => rpc<null>(context, "program_draft_submit", { _draft_id: data.id }));

export const withdrawProgramDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => rpc<null>(context, "program_draft_withdraw", { _draft_id: data.id }));

export const decideProgramDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approve", "request_revision", "reject"]),
        note: z.string().trim().max(2000).nullable(),
        expectedUpdatedAt: z.string().min(10),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    rpc<{ status: string; resultId: string | null }>(context, "program_draft_decide", {
      _draft_id: data.id,
      _decision: data.decision,
      _note: data.note,
      _expected_updated_at: data.expectedUpdatedAt,
    }),
  );

export const setProgramStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        kind,
        id: z.string().uuid(),
        status: z.enum(["active", "archived", "published", "completed", "closed"]),
        note: z.string().trim().min(5).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    rpc<null>(context, "program_set_status", { _kind: data.kind, _id: data.id, _status: data.status, _note: data.note }),
  );
