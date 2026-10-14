import { supabase } from "@/integrations/supabase/client";
import { resolveFileContentType } from "@/lib/storage/mime";
import { MODULE_ATTACHMENTS_BUCKET } from "@/lib/experts/module-attachments";
import type {
  ExistingResource,
  ModuleResource,
} from "@/components/baruna/experts/submit-module/config";

type UploadArgs = {
  uid: string | undefined;
  /** Folder segment under users/<uid>/modules/. */
  draftKey: string | number;
  attachedFiles: Record<string, File>;
  existingFiles: Record<string, ExistingResource>;
  videoUrl: string;
  isId: boolean;
  onProgress: (message: string) => void;
};

/**
 * Uploads newly picked files and merges them with the untouched existing ones.
 * A failed upload throws: storing only the file name would publish a "phantom"
 * attachment nobody can open.
 */
export async function uploadModuleAttachments({
  uid,
  draftKey,
  attachedFiles,
  existingFiles,
  videoUrl,
  isId,
  onProgress,
}: UploadArgs): Promise<ModuleResource[]> {
  let uploadedResources: ModuleResource[] = [];

  // Keep existing attached files that weren't replaced
  for (const [type, ex] of Object.entries(existingFiles)) {
    if (!attachedFiles[type]) {
      uploadedResources.push({
        type,
        name: ex.fileName || ex.name || "Berkas",
        fileName: ex.fileName || ex.name || "Berkas",
        fileSize: ex.fileSize || 0,
        fileType: ex.fileType || "application/octet-stream",
        path: ex.path,
        bucket: ex.bucket || (ex.path?.includes("/modules/") ? MODULE_ATTACHMENTS_BUCKET : "expert-applications"),
        uploadedAt: ex.uploadedAt || new Date().toISOString(),
      });
    }
  }

  const newEntries = Object.entries(attachedFiles);
  if (newEntries.length > 0) {
    onProgress(isId ? `Mengunggah ${newEntries.length} berkas...` : `Uploading ${newEntries.length} files...`);
  }

  if (newEntries.length > 0 && !uid) {
    throw new Error(
      isId
        ? "Sesi login berakhir. Silakan masuk kembali sebelum mengunggah berkas."
        : "Your session has expired. Please sign in again before uploading files.",
    );
  }

  let completedCount = 0;
  const newUploaded = await Promise.all(
    newEntries.map(async ([type, f]) => {
      const contentType = resolveFileContentType(f.name, f.type);
      const safeName = f.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
      const storagePath = `users/${uid}/modules/${draftKey}/${Date.now()}-${safeName}`;

      // Single official bucket.
      const { error: upErr } = await supabase.storage
        .from(MODULE_ATTACHMENTS_BUCKET)
        .upload(storagePath, f, { contentType, upsert: true });
      if (upErr) {
        throw new Error(
          isId
            ? `Gagal mengunggah "${f.name}": ${upErr.message}. Tidak ada data yang dikirim; silakan coba lagi.`
            : `Failed to upload "${f.name}": ${upErr.message}. Nothing was submitted; please try again.`,
        );
      }

      completedCount++;
      onProgress(
        isId
          ? `Mengunggah (${completedCount}/${newEntries.length}) berkas...`
          : `Uploading (${completedCount}/${newEntries.length}) files...`,
      );

      return {
        type,
        name: f.name,
        fileName: f.name,
        fileSize: f.size,
        fileType: contentType,
        path: storagePath,
        bucket: MODULE_ATTACHMENTS_BUCKET,
        uploadedAt: new Date().toISOString(),
      };
    }),
  );

  uploadedResources.push(...newUploaded);

  // An online video link replaces any uploaded video resource.
  if (videoUrl.trim()) {
    const nonVideoResources = uploadedResources.filter((r) => !r.type.toLowerCase().includes("video"));
    nonVideoResources.push({
      type: "Learning video (optional but strongly encouraged)",
      name: isId ? "Video Pembelajaran (Tautan Online)" : "Learning Video (Online URL)",
      fileName: videoUrl.trim(),
      fileSize: 0,
      fileType: "video/online-stream",
      path: videoUrl.trim(),
      uploadedAt: new Date().toISOString(),
    });
    uploadedResources = nonVideoResources;
  }

  return uploadedResources;
}

/** Public URL of the uploaded cover image, if any. */
export function resolveCoverImageUrl(resources: ModuleResource[]): string | undefined {
  const coverRes = resources.find(
    (r) =>
      r.type.toLowerCase().includes("cover") ||
      r.type === "Course cover image" ||
      (r.type.toLowerCase().includes("image") && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(r.name || r.fileName || "")),
  );
  if (!coverRes?.path) return undefined;
  if (coverRes.path.startsWith("http")) return coverRes.path;
  const primaryBucket = coverRes.bucket || MODULE_ATTACHMENTS_BUCKET;
  const { data: pub1 } = supabase.storage.from(primaryBucket).getPublicUrl(coverRes.path);
  if (pub1?.publicUrl) return pub1.publicUrl;
  const { data: pub2 } = supabase.storage.from("expert-applications").getPublicUrl(coverRes.path);
  return pub2?.publicUrl || undefined;
}
