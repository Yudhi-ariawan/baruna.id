/**
 * Maps exception codes raised by the service-request / trainer-application RPCs
 * to messages people can act on. Unknown messages pass through unchanged.
 */
const FRIENDLY: Array<[RegExp, string]> = [
  [/stale_request/, "Data permintaan ini baru saja diubah oleh pengguna lain. Muat ulang lalu coba lagi."],
  [/invalid_transition/, "Aksi ini tidak berlaku untuk status permintaan saat ini. Muat ulang halaman."],
  [/request_not_respondable/, "Permintaan ini sudah ditutup sehingga tidak dapat ditanggapi lagi."],
  [/request_not_awaiting_information/, "Permintaan ini tidak sedang menunggu informasi dari Anda."],
  [/request_not_cancellable/, "Permintaan yang sudah selesai atau ditolak tidak dapat dibatalkan."],
  [/request_not_found/, "Permintaan tidak ditemukan atau Anda tidak memiliki akses."],
  [/(reply_message_required|info_request_message_required|message_required)/, "Pesan wajib diisi (minimal 5 karakter)."],
  [/message_too_long|reply_message_too_long|note_too_long/, "Pesan terlalu panjang (maksimal 2.000 karakter)."],
  [/cannot_process_own_request/, "Anda tidak dapat memproses permintaan yang Anda ajukan sendiri."],
  [/conflict_of_interest/, "Konflik kepentingan: expert tersebut adalah pemohon permintaan ini."],
  [/expert_has_no_active_portal/, "Expert ini belum berstatus trainer aktif sehingga tidak dapat menerima permintaan."],
  [/expert_not_available/, "Profil expert tidak tersedia (belum tayang atau diarsipkan)."],
  [/expert_required/, "Pilih expert terlebih dahulu."],
  [/activity_title_required/, "Judul kegiatan wajib diisi untuk mencatat riwayat fasilitasi."],
  [/active_trainer_required/, "Fitur ini hanya untuk trainer aktif."],
  [/verified_expert_required/, "Hanya expert terverifikasi yang dapat mengajukan kualifikasi trainer."],
  [/already_active_trainer/, "Anda sudah berstatus trainer aktif."],
  [/application_not_pending/, "Pengajuan ini sudah tidak menunggu keputusan."],
  [/application_already_decided/, "Pengajuan ini sudah diputuskan sebelumnya."],
  [/self_approval_forbidden/, "Anda tidak dapat memutuskan pengajuan milik sendiri."],
  [/rejection_reason_required/, "Alasan penolakan wajib diisi (minimal 5 karakter)."],
  [/expert_not_published/, "Profil expert tidak aktif (diarsipkan). Pulihkan profil terlebih dahulu."],
  [/forbidden|42501/, "Anda tidak memiliki hak akses untuk aksi ini."],
];

export function toFriendlyServiceError(message: string): string {
  for (const [pattern, friendly] of FRIENDLY) {
    if (pattern.test(message)) return friendly;
  }
  return message;
}
