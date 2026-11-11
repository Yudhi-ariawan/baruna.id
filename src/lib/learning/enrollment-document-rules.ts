// File rules for application documents, shared by the page (early, friendly check) and
// the server. The database checks the same rules again (migration 20261111020000):
// PDF up to 10 MB everywhere; JPG/PNG up to 2 MB only for Full Training documents.
export const ENROLLMENT_DOCUMENT_BUCKET = "enrollment-documents";
export const ENROLLMENT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ENROLLMENT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

type FileLike = { name: string; type: string; size: number };

/** Content type the upload will be stored with, or null when the file is not allowed. */
export function enrollmentContentType(file: FileLike, allowImages: boolean): string | null {
  const name = file.name.toLowerCase();
  if (/\.pdf$/.test(name) && (file.type === "application/pdf" || file.type === "")) return "application/pdf";
  if (!allowImages) return null;
  if (/\.(jpe?g)$/.test(name) && (file.type === "image/jpeg" || file.type === "")) return "image/jpeg";
  if (/\.png$/.test(name) && (file.type === "image/png" || file.type === "")) return "image/png";
  return null;
}

/** Why the file cannot be used (Indonesian and English), or null when it is fine. */
export function enrollmentFileProblem(file: FileLike, allowImages: boolean): { id: string; en: string } | null {
  const type = enrollmentContentType(file, allowImages);
  if (!type) {
    return allowImages
      ? { id: "Dokumen harus berformat PDF, JPG, atau PNG.", en: "The document must be a PDF, JPG or PNG file." }
      : { id: "Dokumen harus berformat PDF.", en: "The document must be a PDF file." };
  }
  if (file.size < 1) return { id: "Berkas kosong.", en: "The file is empty." };
  if (type === "application/pdf" && file.size > ENROLLMENT_DOCUMENT_MAX_BYTES) {
    return { id: "Ukuran PDF maksimal 10 MB.", en: "PDF files can be at most 10 MB." };
  }
  if (type !== "application/pdf" && file.size > ENROLLMENT_IMAGE_MAX_BYTES) {
    return { id: "Ukuran gambar maksimal 2 MB.", en: "Images can be at most 2 MB." };
  }
  return null;
}
