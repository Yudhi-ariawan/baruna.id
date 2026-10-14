/**
 * Single source of truth for BARUNA upload quotas (ENGINEERING_STANDARDS §4):
 * PDF / documents <= 10 MB, presentations (PPT/PPTX) <= 25 MB, images <= 2 MB.
 * Shared by client-side pickers and server-side payload validation so the two
 * can never drift apart.
 */
import { resolveFileContentType } from "./mime";

export const MB = 1024 * 1024;

export const UPLOAD_LIMITS = {
  image: 2 * MB,
  document: 10 * MB,
  presentation: 25 * MB,
} as const;

export type UploadLimitKind = keyof typeof UPLOAD_LIMITS;

const PRESENTATION_EXTENSIONS = ["ppt", "pptx"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];

export function classifyUpload(fileName: string, mimeType?: string | null): UploadLimitKind {
  const mime = resolveFileContentType(fileName, mimeType).toLowerCase();
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (mime.startsWith("image/") || IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (mime.includes("presentation") || mime.includes("powerpoint") || PRESENTATION_EXTENSIONS.includes(ext)) {
    return "presentation";
  }
  return "document";
}

export function maxUploadBytes(fileName: string, mimeType?: string | null): number {
  return UPLOAD_LIMITS[classifyUpload(fileName, mimeType)];
}

const KIND_LABEL_ID: Record<UploadLimitKind, string> = {
  image: "Gambar",
  document: "Dokumen",
  presentation: "Presentasi",
};

/** Returns a user-facing (Indonesian) error message, or null when the file is within quota. */
export function getUploadSizeError(file: { name: string; size: number; type?: string | null }): string | null {
  const kind = classifyUpload(file.name, file.type);
  const limit = UPLOAD_LIMITS[kind];
  if (file.size > limit) {
    return `${KIND_LABEL_ID[kind]} terlalu besar (maksimal ${Math.round(limit / MB)} MB).`;
  }
  return null;
}
