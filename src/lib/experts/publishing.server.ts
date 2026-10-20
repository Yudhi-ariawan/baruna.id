import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PUBLIC_AVATAR_BUCKET = "expert-avatars";

export async function publishExpertAvatar(
  subjectId: string,
  sourcePath: string,
  fileName?: string,
): Promise<string | null> {
  if (!sourcePath || !sourcePath.trim()) return null;
  const trimmed = sourcePath.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  try {
    const { data: blob, error: downloadError } = await supabaseAdmin.storage
      .from("expert-applications")
      .download(trimmed);

    if (downloadError || !blob) {
      const { data: signed } = await supabaseAdmin.storage
        .from("expert-applications")
        .createSignedUrl(trimmed, 31536000);
      return signed?.signedUrl ?? trimmed;
    }

    const buckets = await supabaseAdmin.storage.listBuckets();
    if (!buckets.data?.some((b) => b.id === PUBLIC_AVATAR_BUCKET)) {
      const created = await supabaseAdmin.storage.createBucket(PUBLIC_AVATAR_BUCKET, {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      });
      if (created.error && !created.error.message?.includes("already exists")) {
        console.warn("[publishExpertAvatar] createBucket notice:", created.error);
      }
    }

    const extension =
      String(fileName || trimmed)
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "jpg";
    const destination = `experts/${subjectId}/avatar.${extension}`;
    const contentType =
      blob.type || (extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg");

    const uploaded = await supabaseAdmin.storage
      .from(PUBLIC_AVATAR_BUCKET)
      .upload(destination, blob, { contentType, upsert: true });

    if (uploaded.error) {
      const { data: signed } = await supabaseAdmin.storage
        .from("expert-applications")
        .createSignedUrl(trimmed, 31536000);
      return signed?.signedUrl ?? trimmed;
    }

    return supabaseAdmin.storage.from(PUBLIC_AVATAR_BUCKET).getPublicUrl(destination).data.publicUrl;
  } catch (err) {
    console.warn("[publishExpertAvatar] error:", err);
    return trimmed;
  }
}

export async function resolvePublicAvatarUrl(
  rawAvatarUrl: string | null | undefined,
  expertId?: string | null,
): Promise<string | null> {
  if (expertId) {
    try {
      const { data: expRow } = await supabaseAdmin
        .from("experts")
        .select("original_contributor_id")
        .eq("id", expertId)
        .maybeSingle();
      // Linked account only (see ./ownership); never the admin who created the row.
      const uid = expRow?.original_contributor_id;
      if (uid) {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("avatar_url")
          .eq("id", uid)
          .maybeSingle();
        if (
          prof?.avatar_url &&
          (prof.avatar_url.startsWith("http://") || prof.avatar_url.startsWith("https://"))
        ) {
          return prof.avatar_url;
        }
      }
    } catch {
      // continue to rawAvatarUrl fallback
    }
  }

  if (!rawAvatarUrl || !rawAvatarUrl.trim()) return null;
  const url = rawAvatarUrl.trim();
  if (url.startsWith("http://") || url.startsWith("https://")) {
    if (url.includes("/expert-applications/")) {
      const match = url.match(/\/expert-applications\/(.+?)(\?|$)/);
      if (match && match[1]) {
        try {
          const { data: signed } = await supabaseAdmin.storage
            .from("expert-applications")
            .createSignedUrl(decodeURIComponent(match[1]), 86400);
          return signed?.signedUrl ?? null;
        } catch {
          return null;
        }
      }
    }
    return url;
  }
  try {
    const { data: signed } = await supabaseAdmin.storage
      .from("expert-applications")
      .createSignedUrl(url, 86400);
    return signed?.signedUrl ?? null;
  } catch {
    return null;
  }
}

// Expert publication lives in the database (public._expert_publish_from_subject,
// migration 20261015060000) so the decision, profile, child tables, trainer status
// and role change commit together. Only the avatar copy (storage) stays here.
