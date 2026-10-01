import { supabase } from "@/integrations/supabase/client";
import { courseImages } from "@/data/pages";

export function resolveModuleCoverImage(
  moduleOrMetadata: Record<string, unknown> | null | undefined,
  fallbackIndex = 0
): string {
  if (!moduleOrMetadata) {
    return courseImages[Math.abs(fallbackIndex) % courseImages.length];
  }

  const meta = (
    (moduleOrMetadata.metadata as Record<string, unknown>) ||
    moduleOrMetadata
  ) as Record<string, unknown>;

  // 1. Check direct cover_image_url or image_url
  if (typeof meta.cover_image_url === "string" && meta.cover_image_url.trim()) {
    return meta.cover_image_url.trim();
  }
  if (typeof meta.image_url === "string" && meta.image_url.trim()) {
    return meta.image_url.trim();
  }
  if (typeof moduleOrMetadata.cover_image === "string" && moduleOrMetadata.cover_image.trim()) {
    return (moduleOrMetadata.cover_image as string).trim();
  }
  if (typeof moduleOrMetadata.image === "string" && moduleOrMetadata.image.trim()) {
    return (moduleOrMetadata.image as string).trim();
  }

  // 2. Check attached_resources array for cover image
  const attached = Array.isArray(meta.attached_resources)
    ? (meta.attached_resources as Array<Record<string, unknown>>)
    : Array.isArray(moduleOrMetadata.attached_resources)
      ? (moduleOrMetadata.attached_resources as Array<Record<string, unknown>>)
      : Array.isArray(moduleOrMetadata.documents)
        ? (moduleOrMetadata.documents as Array<Record<string, unknown>>)
        : [];

  const coverResource = attached.find((item) => {
    const type = String(item.type || item.category || "").toLowerCase();
    const name = String(item.name || item.fileName || "").toLowerCase();
    const isImageExt = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(name);
    return (
      type.includes("cover") ||
      type.includes("cover image") ||
      (type.includes("image") && isImageExt) ||
      (isImageExt && !type.includes("doc") && !type.includes("slide") && !type.includes("pdf"))
    );
  });

  if (coverResource) {
    const storagePath = typeof coverResource.path === "string" ? coverResource.path : "";
    const directUrl = typeof coverResource.url === "string" ? coverResource.url : "";

    if (directUrl && (directUrl.startsWith("http://") || directUrl.startsWith("https://"))) {
      return directUrl;
    }

    if (storagePath) {
      if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
        return storagePath;
      }
      // Get public URL from expert-applications or module-attachments
      const { data: pub1 } = supabase.storage
        .from("expert-applications")
        .getPublicUrl(storagePath);
      if (pub1?.publicUrl) {
        return pub1.publicUrl;
      }
    }
  }

  // 3. Fallback to static theme cover image
  return courseImages[Math.abs(fallbackIndex) % courseImages.length];
}

