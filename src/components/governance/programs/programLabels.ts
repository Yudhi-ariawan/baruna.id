// Display labels for Program Academy (values follow the database domains of
// course_offerings, migrations 20260730*).
import type { DraftStatus } from "@/lib/academy/programs.functions";

export const DRAFT_STATUS: Record<DraftStatus, { label: string; tone: string }> = {
  draft: { label: "Draf", tone: "bg-slate-100 text-slate-700" },
  submitted: { label: "Menunggu keputusan", tone: "bg-amber-50 text-amber-800" },
  revision_requested: { label: "Diminta revisi", tone: "bg-orange-50 text-orange-800" },
  approved: { label: "Disetujui", tone: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Ditolak", tone: "bg-red-50 text-red-700" },
  withdrawn: { label: "Ditarik", tone: "bg-slate-100 text-slate-500" },
};

export const LIVE_STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: "Aktif", tone: "bg-emerald-50 text-emerald-700" },
  archived: { label: "Diarsipkan", tone: "bg-slate-100 text-slate-500" },
  published: { label: "Tayang", tone: "bg-emerald-50 text-emerald-700" },
  completed: { label: "Selesai", tone: "bg-sky-50 text-sky-700" },
  closed: { label: "Ditutup", tone: "bg-slate-100 text-slate-600" },
};

export const LEARNING_MODEL = { self_paced: "Mandiri (self-paced)", cohort_based: "Berbasis angkatan (cohort)" } as const;
export const DELIVERY_FORMAT = { fully_online: "Sepenuhnya online", blended: "Blended", in_person: "Tatap muka" } as const;
export const ACCESS_RULE = {
  open: "Terbuka (langsung mulai)",
  registered: "Wajib akun terdaftar",
  approval_required: "Wajib disetujui admin",
  entitlement_required: "Wajib hak akses khusus",
} as const;
/**
 * Rules an offering managed here may use. "Wajib disetujui admin" works through the
 * participant application (migration 20261110010000); who grants an entitlement is
 * not decided yet, so that one is not offered.
 */
export const SELECTABLE_ACCESS_RULE = {
  open: ACCESS_RULE.open,
  registered: ACCESS_RULE.registered,
  approval_required: ACCESS_RULE.approval_required,
} as const;
/** Delivery modes not offered here. */
export const UNSUPPORTED_DELIVERY_MODES: string[] = [];
export const SELF_PACED_ACCESS = { free: "Gratis", paid: "Berbayar", free_to_learn: "Gratis belajar" } as const;
export const PAYMENT_RESPONSIBILITY = {
  participant: "Peserta",
  institution: "Instansi peserta",
  sponsor_or_partner: "Sponsor / mitra",
  government_or_public_funding: "Pemerintah / dana publik",
  cost_sharing: "Berbagi biaya",
  to_be_determined: "Belum ditentukan",
} as const;
export const EVALUATION_CONTEXT = {
  course: "Course",
  training: "Training",
  webinar: "Webinar",
  workshop: "Workshop",
  programme: "Programme",
} as const;

export const PROGRAMS_QUERY_KEY = ["governance", "programs"];

export const KIND_LABEL = { master_course: "Master Course", course_offering: "Course Offering" } as const;

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "–";
