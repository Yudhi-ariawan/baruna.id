// Permintaan Akses / Peran (Slide 42, LS-01). Shared by the account page, the
// Admin Portal queue, and their server functions.
//
// Decided by the project owner (16 Nov): only the curation roles may be requested
// by the user themself. admin / super_admin are given by a super admin directly;
// participant comes from the biodata, expert from the expert application.

export const REQUESTABLE_ROLES = ["operator", "reviewer", "verifier", "approver", "publisher"] as const;
export type RequestableRole = (typeof REQUESTABLE_ROLES)[number];

export const ROLE_INFO: Record<RequestableRole, { id: string; en: string; descId: string; descEn: string }> = {
  operator: {
    id: "Operator",
    en: "Operator",
    descId: "Mengelola data operasional: kehadiran, pendaftaran peserta, dan usulan Data Master.",
    descEn: "Manages operational data: attendance, participant enrolment, and Master Data proposals.",
  },
  reviewer: {
    id: "Reviewer",
    en: "Reviewer",
    descId: "Meninjau isi pengajuan dan memberi rekomendasi.",
    descEn: "Reviews submissions and gives recommendations.",
  },
  verifier: {
    id: "Verifier",
    en: "Verifier",
    descId: "Memeriksa kebenaran, kepatuhan, dan bukti pengajuan.",
    descEn: "Checks correctness, compliance, and evidence of submissions.",
  },
  approver: {
    id: "Approver",
    en: "Approver",
    descId: "Menyetujui atau menolak pengajuan agar dapat dipakai di layanan.",
    descEn: "Approves or rejects submissions for use in services.",
  },
  publisher: {
    id: "Publisher",
    en: "Publisher",
    descId: "Mengatur penayangan konten yang sudah disetujui.",
    descEn: "Manages the publication of approved content.",
  },
};

export type RoleRequestStatus = "pending" | "approved" | "rejected" | "cancelled" | "applied";

export const STATUS_INFO: Record<RoleRequestStatus, { id: string; en: string; tone: string }> = {
  pending: { id: "Menunggu keputusan", en: "Awaiting decision", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  applied: { id: "Disetujui, peran aktif", en: "Approved, role active", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  approved: { id: "Disetujui", en: "Approved", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  rejected: { id: "Ditolak", en: "Rejected", tone: "bg-red-50 text-red-800 border-red-200" },
  cancelled: { id: "Dibatalkan", en: "Cancelled", tone: "bg-slate-50 text-slate-700 border-slate-200" },
};

export function roleName(code: string, isId = true): string {
  const info = ROLE_INFO[code as RequestableRole];
  return info ? (isId ? info.id : info.en) : code.replace(/_/g, " ");
}

export type MyRoleRequest = {
  id: string;
  role: string;
  action: "grant" | "revoke";
  status: RoleRequestStatus;
  reason: string;
  validUntil: string | null;
  decisionNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export const REASON_MIN = 20;
export const REASON_MAX = 1000;
export const NOTE_MAX = 1000;

/** Database error codes → messages the user can act on. */
export function roleRequestError(message: string): string {
  if (message.includes("unauthorized_or_inactive")) return "Akun Anda tidak aktif. Hubungi administrator.";
  if (message.includes("expert_role_managed_by_flow")) return "Peran Expert diperoleh lewat pendaftaran expert, bukan lewat permintaan peran.";
  if (message.includes("reason_required")) return "Alasan wajib diisi.";
  if (message.includes("invalid_validity_window")) return "Tanggal berakhir harus setelah hari ini.";
  if (message.includes("role_not_found")) return "Peran tidak dikenal.";
  if (message.includes("separation_of_duties_required")) return "Permintaan Anda sendiri (atau untuk akun Anda) harus diputuskan oleh super admin lain.";
  if (message.includes("request_not_pending")) return "Permintaan ini sudah diputuskan sebelumnya. Muat ulang halaman.";
  if (message.includes("request_not_found")) return "Permintaan tidak ditemukan.";
  if (message.includes("forbidden")) return "Anda tidak berwenang melakukan tindakan ini.";
  return message;
}
