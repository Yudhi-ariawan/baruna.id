// Maps course_enrollment_apply / admin_course_enrollment_decide exceptions to
// messages a participant or admin can act on.
const MESSAGES: Array<[RegExp, string]> = [
  [/biodata_required/, "Anda wajib melengkapi Formulir Biodata Peserta terlebih dahulu sebelum mendaftar pelatihan ini. Silakan buka menu Daftar Peserta."],
  [/authentication_required/, "Sesi login berakhir. Silakan masuk kembali."],
  [/documents_required:(.+)/, "Dokumen persyaratan belum lengkap. Unggah semua dokumen yang diminta, lalu kirim lagi."],
  [/document_file_invalid/, "Ada dokumen yang tidak valid (harus PDF milik Anda, maksimal 10 MB). Unggah ulang dokumennya."],
  [/document_requirement_unknown|documents_invalid|documents_not_applicable/, "Daftar dokumen tidak sesuai dengan yang diminta course ini. Muat ulang halaman."],
  [/document_not_found/, "Dokumen tidak ditemukan atau Anda tidak berwenang membukanya."],
  [/revision_note_required/, "Tuliskan catatan perbaikan untuk peserta (minimal 5 karakter)."],
  [/application_awaiting_revision/, "Pengajuan ini sedang menunggu perbaikan dari peserta. Keputusan bisa diambil setelah peserta mengirim ulang."],
  [/offering_no_application/, "Course ini tidak memerlukan pengajuan. Silakan langsung mendaftar dari halaman course."],
  [/offering_closed/, "Course ini sudah tidak menerima pendaftaran."],
  [/enrolment_window_closed/, "Masa pendaftaran course ini belum dibuka atau sudah ditutup."],
  [/self_decision_forbidden/, "Anda tidak dapat memutuskan pendaftaran milik akun Anda sendiri."],
  [/decision_already_final/, "Pendaftaran ini sudah diputuskan sebelumnya dan tidak dapat diubah. Muat ulang halaman untuk melihat status terbaru."],
  [/application_not_found/, "Permohonan kepesertaan tidak ditemukan. Muat ulang halaman."],
  [/participant_role_missing/, "Peran 'participant' belum terdaftar di sistem RBAC. Hubungi pengelola sistem."],
  [/exactly_one_primary_role_required/, "Gagal memberikan peran Participant karena konflik peran primer pengguna. Tidak ada perubahan yang disimpan."],
  [/forbidden|42501/, "Akses ditolak: Hanya Administrator atau Pengelola Tata Kelola yang dapat memutuskan persetujuan peserta."],
  [/invalid_course|invalid_course_title/, "Data pelatihan tidak valid."],
  [/notes_too_long/, "Catatan terlalu panjang (maksimal 1000 karakter)."],
  [
    /course_enrollment_applications|participant_biodata|course_enrollment_apply|admin_course_enrollment_decide|schema cache/,
    "Fitur pendaftaran peserta belum aktif di database (migrasi belum dijalankan). Hubungi pengelola sistem.",
  ],
];

export function toFriendlyEnrollmentError(message: string): string {
  for (const [pattern, text] of MESSAGES) if (pattern.test(message)) return text;
  return message;
}
