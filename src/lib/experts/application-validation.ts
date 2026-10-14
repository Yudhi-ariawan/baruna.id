import { z } from "zod";

/**
 * Server-side contract for the Join-as-Expert payload (PB-EXP-02 "Cek Kelengkapan").
 * The browser form is never trusted: every field is bounded and document paths
 * must live under the caller's own storage prefix.
 */

const shortText = (max: number) => z.string().trim().max(max).optional().default("");

// `size` is client-declared metadata; the real quota is enforced by the
// expert-applications bucket file_size_limit. The bound here only keeps legacy
// drafts (uploaded under the former 50 MB bucket limit) loadable.
const LEGACY_BUCKET_LIMIT = 50 * 1024 * 1024;

const DocumentSchema = z.object({
  category: z.enum(["cv", "photo", "certifications", "supporting"]),
  path: z.string().min(1).max(512),
  name: z.string().min(1).max(255),
  size: z.number().nonnegative().max(LEGACY_BUCKET_LIMIT),
  type: z.string().max(160),
  uploadedAt: z.string().max(40),
});

export const ExpertPayloadSchema = z
  .object({
    fullName: shortText(160),
    title: shortText(160),
    institution: shortText(200),
    country: shortText(80),
    email: shortText(254),
    phone: shortText(40),
    linkedin: shortText(300),
    website: shortText(300),
    expertise: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
    roles: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
    biography: shortText(20000),
    yearsExperience: shortText(20),
    keyProjects: shortText(20000),
    publications: shortText(20000),
    languages: shortText(1000),
    structuredLanguages: z.array(z.record(z.unknown())).max(20).optional(),
    structuredProjects: z.array(z.record(z.unknown())).max(30).optional(),
    structuredPublications: z.array(z.record(z.unknown())).max(50).optional(),
    documents: z.array(DocumentSchema).max(8).default([]),
    schemaVersion: z.literal(1).default(1),
  })
  // Keep legacy keys (cv/photo/... FileMeta, display_name) without failing old drafts.
  .passthrough();

export type ValidatedExpertPayload = z.infer<typeof ExpertPayloadSchema>;

/**
 * Rejects document references that point outside users/<userId>/ in the private
 * bucket. Without this an applicant could reference another applicant's CV path
 * and the admin console would mint a signed URL for it.
 */
export function assertOwnedDocumentPaths(payload: ValidatedExpertPayload, userId: string) {
  const prefix = `users/${userId}/`;
  for (const doc of payload.documents) {
    if (!doc.path.startsWith(prefix) || doc.path.includes("..")) {
      throw new Error("Dokumen pengajuan tidak valid: berkas harus diunggah dari akun Anda sendiri.");
    }
  }
}

/** Completeness gate before a draft may enter the verification queue. */
export function getExpertPayloadIncompleteFields(payload: Record<string, unknown>): string[] {
  const missing: string[] = [];
  const text = (key: string) => (typeof payload[key] === "string" ? (payload[key] as string).trim() : "");
  const list = (key: string) => (Array.isArray(payload[key]) ? (payload[key] as unknown[]).length : 0);
  if (!text("fullName")) missing.push("nama lengkap");
  if (!text("title")) missing.push("jabatan/gelar profesional");
  if (!text("institution")) missing.push("institusi");
  if (!text("country")) missing.push("negara");
  if (!text("email")) missing.push("email");
  if (list("expertise") === 0) missing.push("bidang keahlian");
  if (list("roles") === 0) missing.push("peran yang tersedia");
  if (!text("biography")) missing.push("biografi profesional");
  return missing;
}

const RPC_ERROR_MESSAGES: Record<string, string> = {
  draft_not_editable: "Draf ini sudah dikirim dan sedang diverifikasi, sehingga tidak dapat diubah.",
  draft_already_submitted: "Pengajuan ini sudah dikirim sebelumnya.",
  draft_not_found: "Draf pengajuan tidak ditemukan.",
  revision_unchanged: "Tidak ada perubahan dibanding pengajuan sebelumnya. Perbarui data atau dokumen sebelum mengirim ulang.",
  forbidden: "Anda tidak memiliki akses ke pengajuan ini.",
  display_name_required: "Nama lengkap wajib diisi.",
  expert_application_already_pending: "Anda masih memiliki pengajuan expert yang sedang diverifikasi.",
};

/** Maps raw PostgreSQL RPC exception codes to user-facing messages. */
export function toFriendlyExpertError(message: string | undefined | null): string {
  if (!message) return "Terjadi kesalahan saat memproses pengajuan expert.";
  for (const [code, friendly] of Object.entries(RPC_ERROR_MESSAGES)) {
    if (message.includes(code)) return friendly;
  }
  return message;
}
