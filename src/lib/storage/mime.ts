/**
 * MIME Type and Document Handling Utilities for BARUNA Storage
 * Ensures correct MIME types during upload and determines browser preview capabilities.
 */

export type DocumentPreviewKind =
  | "pdf"
  | "image"
  | "office"
  | "video"
  | "audio"
  | "text"
  | "archive"
  | "generic";

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
};

/**
 * Resolves the exact MIME content-type based on filename extension and provided mime type.
 * Never allows blank or corrupted MIME types to be passed to storage.
 */
export function resolveFileContentType(fileName: string, mimeType?: string | null): string {
  if (
    mimeType &&
    mimeType !== "application/octet-stream" &&
    mimeType !== "binary/octet-stream" &&
    mimeType.trim() !== ""
  ) {
    return mimeType.trim();
  }

  const ext = (fileName.split(".").pop() || "").toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

/**
 * Returns the classification category for previewing a document in the browser.
 */
export function getDocumentPreviewKind(fileName: string, mimeType?: string | null): DocumentPreviewKind {
  const mime = resolveFileContentType(fileName, mimeType).toLowerCase();
  const ext = (fileName.split(".").pop() || "").toLowerCase();

  if (mime === "application/pdf" || ext === "pdf") {
    return "pdf";
  }

  if (
    mime.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp", "ico"].includes(ext)
  ) {
    return "image";
  }

  if (
    [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ].includes(mime) ||
    ["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext)
  ) {
    return "office";
  }

  if (mime.startsWith("video/") || ["mp4", "webm", "mov"].includes(ext)) {
    return "video";
  }

  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg"].includes(ext)) {
    return "audio";
  }

  if (
    mime.startsWith("text/") ||
    ["txt", "csv", "md", "json", "xml", "html"].includes(ext)
  ) {
    return "text";
  }

  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return "archive";
  }

  return "generic";
}

/**
 * Formats byte size into human readable string.
 */
export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Triggers a direct browser download for a remote URL with the specified filename.
 */
export async function triggerFileDownload(url: string, fileName: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Gagal mengambil file untuk diunduh.");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  } catch {
    // Fallback: direct window download
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

