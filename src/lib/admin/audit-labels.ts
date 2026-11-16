// Shared by the Jejak Audit server function and page: sources, row shape, and
// Indonesian labels for the event codes the database writes.

import type { Json } from "@/integrations/supabase/types";

export const AUDIT_SOURCES = ["admin", "governance", "learning", "status"] as const;
export type AuditJson = { [key: string]: Json | undefined };
export type AuditSource = (typeof AUDIT_SOURCES)[number];

export type AuditEntry = {
  key: string;
  source: AuditSource;
  eventType: string;
  at: string;
  actorId: string | null;
  actorName: string | null;
  targetUserId: string | null;
  targetName: string | null;
  entityType: string | null;
  entityId: string | null;
  subjectId: string | null;
  subjectTitle: string | null;
  before: AuditJson | null;
  after: AuditJson | null;
  details: AuditJson | null;
};

export const SOURCE_LABEL: Record<AuditSource, string> = {
  admin: "Akun, Peran & Operasional",
  governance: "Kurasi & Data Master",
  learning: "Pembelajaran",
  status: "Status Alur Kerja",
};

const EVENT_LABEL: Record<string, string> = {
  // admin_audit_log
  first_super_admin_bootstrapped: "Super admin pertama dibuat",
  user_created: "Pengguna dibuat",
  user_invited: "Pengguna diundang",
  user_profile_updated: "Profil pengguna diubah",
  user_status_changed: "Status akun diubah",
  user_avatar_updated: "Foto profil diubah",
  user_profile_self_updated: "Profil diubah oleh pemiliknya",
  role_assigned: "Peran diberikan",
  default_role_assigned: "Peran awal diberikan",
  role_revoked: "Peran dicabut",
  user_roles_batch_updated: "Peran pengguna diubah sekaligus",
  legacy_role_revoked: "Peran lama dicabut",
  legacy_role_code_retired: "Kode peran lama dihentikan",
  participant_biodata_saved: "Biodata peserta disimpan",
  course_enrollment_approved: "Pendaftaran course disetujui",
  course_enrollment_revision_requested: "Pendaftaran course diminta perbaikan",
  "module.withdrawal_requested": "Penarikan modul diajukan",
  "module.withdrawal_rejected_by_admin": "Penarikan modul ditolak admin",
  "expert_service_request.created": "Permintaan layanan expert dibuat",
  "expert_service_request.admin_matching": "Permintaan layanan expert dicocokkan",
  "expert_service_request.admin_assign": "Expert ditugaskan ke permintaan layanan",
  "expert.test_account_linked": "Akun uji ditautkan ke expert",
  attendance_recorded: "Kehadiran dicatat",
  attendance_session_saved: "Sesi kehadiran disimpan",
  attendance_session_deleted: "Sesi kehadiran dihapus",
  course_enrollment_requested: "Pendaftaran course diajukan",
  full_training_replacement_set: "Pengganti Full Training ditetapkan",
  master_change_requested: "Usulan Data Master diajukan",
  master_change_cancelled: "Usulan Data Master dibatalkan",
  publication_held: "Konten diturunkan sementara",
  publication_released: "Konten ditayangkan lagi",
  // governance_audit_log
  assignment_created: "Reviewer ditugaskan",
  assignment_reassigned: "Reviewer diganti",
  assignment_cancelled: "Penugasan reviewer dibatalkan",
  audit_exported: "Audit diekspor",
  completion_approved: "Kelulusan disetujui",
  completion_remedial: "Kelulusan dikembalikan (remedial)",
  conflict_declared: "Konflik kepentingan dinyatakan",
  decision_approve: "Keputusan: disetujui",
  decision_reject: "Keputusan: ditolak",
  decision_return_for_revision: "Keputusan: dikembalikan untuk revisi",
  review_submitted: "Rekomendasi reviewer dikirim",
  required_recommendations_set: "Jumlah rekomendasi wajib diubah",
  subject_withdrawn: "Pengajuan ditarik",
  draft_submitted: "Draf diajukan untuk review",
  expert_unarchived: "Expert dipulihkan dari arsip",
  program_draft_approved: "Draf program disetujui",
  program_draft_revision_requested: "Draf program diminta revisi",
  module_published: "Modul ditayangkan",
  module_archived: "Modul diarsipkan",
  module_restored: "Modul dipulihkan",
  module_master_activated: "Modul master diaktifkan",
  publication_archived: "Publikasi diarsipkan",
  publication_restored: "Publikasi dipulihkan",
  program_draft_opened: "Draf program dibuka",
  program_draft_submitted: "Draf program diajukan",
  program_draft_withdrawn: "Draf program ditarik",
  program_status_changed: "Status program diubah",
  sla_policy_updated: "Kebijakan SLA diubah",
  master_expertise_created: "Keahlian ditambahkan",
  master_expertise_updated: "Keahlian diubah",
  master_kh_topic_created: "Topik Knowledge Hub ditambahkan",
  master_kh_topic_updated: "Topik Knowledge Hub diubah",
  master_language_created: "Bahasa ditambahkan",
  master_language_updated: "Bahasa diubah",
  master_training_category_created: "Kategori pelatihan ditambahkan",
  master_training_category_updated: "Kategori pelatihan diubah",
  master_module_limits_changed: "Batas modul trainer diubah",
  master_trainer_levels_changed: "Level trainer diubah",
  template_created: "Template review dibuat",
  template_version_added: "Versi template ditambahkan",
  template_version_published: "Versi template diterbitkan",
  template_active_version_set: "Versi aktif template diubah",
  template_deprecated: "Template dinonaktifkan",
  test_approval_reverted: "Persetujuan uji dibatalkan",
  // learning_audit_log
  enrolment_created: "Peserta terdaftar",
  enrolment_reactivated: "Pendaftaran diaktifkan lagi",
  completion_submitted: "Penyelesaian diajukan",
  certificate_issued: "Sertifikat diterbitkan",
  rollback_executed: "Rollback dijalankan",
  // review_subject_status_history
  status_changed: "Status berubah",
};

/** Indonesian label; unknown codes fall back to readable words. */
export function auditEventLabel(code: string): string {
  return EVENT_LABEL[code] ?? code.replace(/[_.]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

const ENTITY_LABEL: Record<string, string> = {
  user: "Pengguna",
  profile: "Profil",
  rbac_user_role: "Peran pengguna",
  expert: "Expert",
  module: "Modul",
  knowledge_resource: "Knowledge Hub",
  master_course: "Master Course",
  course_offering: "Course Offering",
  training_need: "Permintaan Pelatihan",
  full_training: "Full Training",
  enrolment: "Pendaftaran",
};

export function auditEntityLabel(type: string | null): string | null {
  if (!type) return null;
  return ENTITY_LABEL[type] ?? type.replace(/_/g, " ");
}
