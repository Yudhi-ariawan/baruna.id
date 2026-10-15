import { UPLOAD_LIMITS } from "@/lib/storage/upload-limits";

/**
 * Server-side guards for Trainer Portal module submissions (PB-ACA-01 via
 * Slide 41 Experts -> Academy). The browser form is never trusted.
 */

const ALLOWED_ATTACHMENT_BUCKETS = new Set(["module-attachments", "expert-applications"]);

type Attachment = Record<string, unknown>;

function attachmentsOf(payload: Record<string, unknown>): Attachment[] {
  const meta = (payload.metadata as Record<string, unknown>) ?? {};
  const lists = [payload.attachments, payload.documents, meta.attached_resources];
  const found = lists.find((list) => Array.isArray(list) && list.length > 0);
  return Array.isArray(found) ? (found as unknown[]).filter((x): x is Attachment => Boolean(x) && typeof x === "object") : [];
}

const isUrl = (value: string) => /^https?:\/\//i.test(value);

/**
 * - Every stored file must live under the caller's own `users/<uid>/` prefix in an
 *   allowed bucket (stops referencing someone else's private files).
 * - On final submit, every listed file must actually have been uploaded: an entry
 *   with only a name and no storage path is a "phantom" attachment that reviewers
 *   and participants could never open.
 */
export function assertModuleAttachments(payload: Record<string, unknown>, userId: string, submit: boolean) {
  const prefix = `users/${userId}/`;
  for (const item of attachmentsOf(payload)) {
    const label = String(item.fileName ?? item.name ?? item.type ?? "lampiran");
    const path = typeof item.path === "string" ? item.path.trim() : "";
    const size = Number(item.fileSize ?? item.size ?? 0);

    if (size > UPLOAD_LIMITS.video) {
      throw new Error(`Berkas "${label}" melebihi batas maksimum 100 MB.`);
    }
    if (!path) {
      if (submit) {
        throw new Error(
          `Berkas "${label}" belum berhasil terunggah. Unggah ulang berkas tersebut sebelum mengirim modul.`,
        );
      }
      continue;
    }
    if (isUrl(path)) continue; // online video / external link

    const bucket = typeof item.bucket === "string" && item.bucket ? item.bucket : "module-attachments";
    if (!ALLOWED_ATTACHMENT_BUCKETS.has(bucket) || !path.startsWith(prefix) || path.includes("..")) {
      throw new Error(`Lampiran "${label}" tidak valid: berkas harus diunggah dari akun Anda sendiri.`);
    }
  }
}

// module_draft_* RPCs enforce the same gates in the database (migration
// 20261015020000); map their exceptions to messages a trainer can act on.
const SUBMISSION_ERRORS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/active_trainer_required/, () => "Akun Anda belum berstatus Trainer aktif. Ajukan kualifikasi trainer terlebih dahulu."],
  [/module_level_limit: (\d+)/, (m) => `Batas level modul tercapai (${m[1]} modul aktif).`],
  [/attachment_not_uploaded: (.+)/, (m) => `Berkas "${m[1]}" belum berhasil terunggah. Unggah ulang berkas tersebut sebelum mengirim modul.`],
  [/attachment_not_owned: (.+)/, (m) => `Lampiran "${m[1]}" tidak valid: berkas harus diunggah dari akun Anda sendiri.`],
  [/attachment_too_large: (.+)/, (m) => `Berkas "${m[1]}" melebihi batas maksimum 100 MB.`],
  [/invalid_module_type/, () => "Jenis modul tidak valid."],
  [/source_type_immutable|invalid_source_type/, () => "Data asal modul tidak boleh diubah."],
  [/payload_too_large/, () => "Isi modul terlalu besar untuk disimpan (maksimal 1 MB teks). Pindahkan materi panjang ke berkas lampiran."],
  [/title_required/, () => "Judul modul wajib diisi (3–240 karakter)."],
  [/draft_not_found/, () => "Draf modul tidak ditemukan. Muat ulang halaman."],
  [/draft_not_editable/, () => "Draf ini sudah dikirim dan tidak dapat diubah lagi. Muat ulang halaman untuk melihat statusnya."],
  [/revision_unchanged/, () => "Tidak ada perubahan sejak pengiriman terakhir. Ubah isi modul sebelum mengirim ulang."],
];

export function toFriendlyModuleSubmissionError(message: string): string {
  for (const [pattern, text] of SUBMISSION_ERRORS) {
    const match = message.match(pattern);
    if (match) return text(match);
  }
  return message;
}
