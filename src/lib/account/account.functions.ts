import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AVATAR_BUCKET, AVATAR_PRESETS, type AccountProfile } from "./account.types";

const ProfileInput = z.object({
  displayName: z.string().trim().min(2).max(120),
  organization: z.string().trim().min(2).max(160),
  jobTitle: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .min(8)
    .max(40)
    .regex(/^\+?[0-9 ()-]+$/),
  country: z.string().trim().max(100).optional().nullable(),
  linkedin: z.string().trim().max(255).optional().nullable(),
  website: z.string().trim().max(255).optional().nullable(),
  bio: z.string().trim().max(1000).optional().nullable(),
});

const AvatarPathInput = z.object({ objectPath: z.string().trim().nullable() });
const presetPaths = new Set<string>(AVATAR_PRESETS.map((preset) => preset.path));

function objectPathFromPublicUrl(url: string | null, userId: string): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) return null;
  const path = decodeURIComponent(url.slice(markerIndex + marker.length).split("?")[0] ?? "");
  return path.startsWith(`users/${userId}/`) ? path : null;
}

async function writeProfileAudit(
  actorId: string,
  eventType: string,
  before: unknown,
  after: unknown,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("admin_audit_log").insert({
    event_type: eventType,
    actor_id: actorId,
    target_user_id: actorId,
    entity_type: "profile",
    entity_id: actorId,
    before_data: before as never,
    after_data: after as never,
    metadata: { source: "account_profile" },
  });
  if (error) throw new Error(error.message);
}

export const getAccountProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountProfile> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [
      { data: profile, error },
      { data: identity, error: identityError },
      { data: rbacUserRoles },
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("display_name, organization, job_title, phone, avatar_url, created_at")
        .eq("id", context.userId)
        .single(),
      supabaseAdmin.auth.admin.getUserById(context.userId),
      supabaseAdmin
        .from("rbac_user_roles")
        .select("role_id, status, rbac_roles!inner(code, name)")
        .eq("user_id", context.userId)
        .eq("status", "active"),
    ]);

    if (error || !profile) throw new Error(error?.message ?? "profile_not_found");
    if (identityError || !identity.user) throw new Error("user_identity_not_found");

    const activeRoles: string[] = [];
    if (Array.isArray(rbacUserRoles)) {
      for (const item of rbacUserRoles) {
        const code = (item as unknown as { rbac_roles?: { code?: string } })?.rbac_roles?.code;
        if (code && !activeRoles.includes(code)) activeRoles.push(code);
      }
    }

    const meta = (identity.user.user_metadata as Record<string, unknown>) ?? {};

    return {
      id: context.userId,
      email: identity.user.email ?? "",
      displayName: profile.display_name ?? (meta.display_name as string) ?? "",
      organization: profile.organization ?? (meta.organization as string) ?? "",
      jobTitle: profile.job_title ?? (meta.job_title as string) ?? "",
      phone: profile.phone ?? (meta.phone as string) ?? "",
      avatarUrl: profile.avatar_url ?? (meta.avatar_url as string) ?? null,
      country: (meta.country as string) ?? null,
      linkedin: (meta.linkedin as string) ?? null,
      website: (meta.website as string) ?? null,
      bio: (meta.bio as string) ?? null,
      roles: activeRoles,
      createdAt: (profile as unknown as { created_at?: string })?.created_at ?? identity.user.created_at ?? null,
    };
  });

export const updateAccountProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before, error: beforeError } = await supabaseAdmin
      .from("profiles")
      .select("display_name, organization, job_title, phone")
      .eq("id", context.userId)
      .single();
    if (beforeError || !before) throw new Error(beforeError?.message ?? "profile_not_found");
    const after = {
      display_name: data.displayName,
      organization: data.organization,
      job_title: data.jobTitle,
      phone: data.phone,
    };
    const { error } = await supabaseAdmin.from("profiles").update(after).eq("id", context.userId);
    if (error) throw new Error(error.message);

    const { data: currentUserData } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const existingMeta = (currentUserData?.user?.user_metadata as Record<string, unknown>) ?? {};

    const userMetaUpdate = {
      ...existingMeta,
      ...after,
      full_name: data.displayName,
      country: data.country ?? null,
      linkedin: data.linkedin ?? null,
      website: data.website ?? null,
      bio: data.bio ?? null,
    };

    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      user_metadata: userMetaUpdate,
    });
    if (metadataError) throw new Error(metadataError.message);
    await writeProfileAudit(context.userId, "user_profile_self_updated", before, { ...after, ...userMetaUpdate });
    return { ok: true };
  });

export const setAccountAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => AvatarPathInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const objectPath = data.objectPath;
    if (
      objectPath !== null &&
      !presetPaths.has(objectPath) &&
      !objectPath.startsWith(`users/${context.userId}/`)
    ) {
      throw new Error("invalid_avatar_path");
    }
    if (objectPath) {
      const folder = objectPath.slice(0, objectPath.lastIndexOf("/"));
      const fileName = objectPath.slice(objectPath.lastIndexOf("/") + 1);
      const { data: objects, error: objectError } = await supabaseAdmin.storage
        .from(AVATAR_BUCKET)
        .list(folder, { search: fileName, limit: 10 });
      if (objectError || !objects?.some((item) => item.name === fileName)) {
        throw new Error("avatar_object_not_found");
      }
    }

    const { data: before, error: beforeError } = await supabaseAdmin
      .from("profiles")
      .select("avatar_url")
      .eq("id", context.userId)
      .single();
    if (beforeError || !before) throw new Error(beforeError?.message ?? "profile_not_found");
    const avatarUrl = objectPath
      ? supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath).data.publicUrl
      : null;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      user_metadata: { avatar_url: avatarUrl },
    });
    if (metadataError) throw new Error(metadataError.message);
    await writeProfileAudit(
      context.userId,
      avatarUrl ? "user_avatar_updated" : "user_avatar_removed",
      before,
      { avatar_url: avatarUrl, object_path: objectPath },
    );

    const oldObjectPath = objectPathFromPublicUrl(before.avatar_url, context.userId);
    if (oldObjectPath && oldObjectPath !== objectPath) {
      await supabaseAdmin.storage.from(AVATAR_BUCKET).remove([oldObjectPath]);
    }
    return { avatarUrl };
  });
