import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AVATAR_BUCKET, AVATAR_PRESETS, type AccountProfile } from "./account.types";
import { EXPERT_OWNER_COLUMN } from "@/lib/experts/ownership";
import { saveParticipantBiodataRpc, validateParticipantBiodata } from "@/lib/academy/participant-biodata.functions";

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
  // Participant biodata fields
  nip: z.string().trim().max(50).optional().nullable(),
  tempatLahir: z.string().trim().max(100).optional().nullable(),
  tanggalLahir: z.string().trim().max(30).optional().nullable(),
  jenisKelamin: z.string().trim().max(30).optional().nullable(),
  agama: z.string().trim().max(50).optional().nullable(),
  pangkatGolongan: z.string().trim().max(100).optional().nullable(),
  pendidikanTerakhir: z.string().trim().max(100).optional().nullable(),
  unitEselon1: z.string().trim().max(150).optional().nullable(),
  alamatKantor: z.string().trim().max(500).optional().nullable(),
  provinsi: z.string().trim().max(100).optional().nullable(),
  kabupatenKota: z.string().trim().max(100).optional().nullable(),
  fotoUrl: z.string().trim().max(2000).optional().nullable(),
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

    // Roles come from RBAC only; user_metadata is user-editable and not evidence of a
    // role. It is still read below for display fields (name, avatar, links).
    const meta = (identity.user.user_metadata as Record<string, unknown>) ?? {};

    // Coba baca dari tabel participant_biodata atau fallback ke user_metadata
    let biodata: Record<string, any> | null = null;
    try {
      const { data: tableBio } = await (supabaseAdmin as any)
        .from("participant_biodata")
        .select("*")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (tableBio) {
        biodata = {
          nama: tableBio.nama,
          nip: tableBio.nip,
          tempatLahir: tableBio.tempat_lahir,
          tanggalLahir: tableBio.tanggal_lahir,
          jenisKelamin: tableBio.jenis_kelamin,
          agama: tableBio.agama,
          jabatan: tableBio.jabatan,
          pangkatGolongan: tableBio.pangkat_golongan,
          pendidikanTerakhir: tableBio.pendidikan_terakhir,
          noHp: tableBio.no_hp,
          unitEselon1: tableBio.unit_eselon_1,
          instansiUnitKerja: tableBio.instansi_unit_kerja,
          alamatKantor: tableBio.alamat_kantor,
          provinsi: tableBio.provinsi,
          kabupatenKota: tableBio.kabupaten_kota,
          fotoUrl: tableBio.foto_url,
        };
      }
    } catch {
      /* fallback below */
    }

    if (!biodata && meta.participant_biodata) {
      biodata = meta.participant_biodata as Record<string, any>;
    }

    return {
      id: context.userId,
      email: identity.user.email ?? "",
      displayName: profile.display_name ?? (meta.display_name as string) ?? (biodata?.nama as string) ?? "",
      organization: profile.organization ?? (meta.organization as string) ?? (biodata?.instansiUnitKerja as string) ?? "",
      jobTitle: profile.job_title ?? (meta.job_title as string) ?? (biodata?.jabatan as string) ?? "",
      phone: profile.phone ?? (meta.phone as string) ?? (biodata?.noHp as string) ?? "",
      avatarUrl: profile.avatar_url ?? (meta.avatar_url as string) ?? (biodata?.fotoUrl as string) ?? null,
      country: (meta.country as string) ?? null,
      linkedin: (meta.linkedin as string) ?? null,
      website: (meta.website as string) ?? null,
      bio: (meta.bio as string) ?? null,
      roles: activeRoles,
      createdAt: (profile as unknown as { created_at?: string })?.created_at ?? identity.user.created_at ?? null,
      // Participant biodata fields
      nip: (biodata?.nip as string) ?? null,
      tempatLahir: (biodata?.tempatLahir || biodata?.tempat_lahir) ?? null,
      tanggalLahir: (biodata?.tanggalLahir || biodata?.tanggal_lahir) ?? null,
      jenisKelamin: (biodata?.jenisKelamin || biodata?.jenis_kelamin) ?? null,
      agama: (biodata?.agama as string) ?? null,
      pangkatGolongan: (biodata?.pangkatGolongan || biodata?.pangkat_golongan) ?? null,
      pendidikanTerakhir: (biodata?.pendidikanTerakhir || biodata?.pendidikan_terakhir) ?? null,
      unitEselon1: (biodata?.unitEselon1 || biodata?.unit_eselon_1) ?? null,
      instansiUnitKerja: (biodata?.instansiUnitKerja || biodata?.instansi_unit_kerja || profile.organization) ?? null,
      alamatKantor: (biodata?.alamatKantor || biodata?.alamat_kantor) ?? null,
      provinsi: (biodata?.provinsi as string) ?? null,
      kabupatenKota: (biodata?.kabupatenKota || biodata?.kabupaten_kota) ?? null,
      fotoUrl: (biodata?.fotoUrl || biodata?.foto_url || profile.avatar_url) ?? null,
      isParticipantRegistered: Boolean(biodata?.nip || activeRoles.includes("participant")),
    };
  });

export const updateAccountProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Biodata (when the participant fields are filled) goes through the same
    // validated, single-transaction RPC as the biodata form, BEFORE anything else
    // changes, so an invalid biodata never leaves a half-saved profile.
    const hasBioData = Boolean(data.nip && data.nip.trim().length > 0);
    if (hasBioData) {
      const biodata = validateParticipantBiodata({
        nama: data.displayName,
        nip: data.nip,
        tempatLahir: data.tempatLahir ?? "",
        tanggalLahir: data.tanggalLahir ?? "",
        jenisKelamin: data.jenisKelamin ?? "",
        agama: data.agama ?? "",
        jabatan: data.jobTitle,
        pangkatGolongan: data.pangkatGolongan ?? "",
        pendidikanTerakhir: data.pendidikanTerakhir ?? "",
        noHp: data.phone,
        unitEselon1: data.unitEselon1 ?? "",
        instansiUnitKerja: data.organization,
        alamatKantor: data.alamatKantor ?? "",
        provinsi: data.provinsi ?? "",
        kabupatenKota: data.kabupatenKota ?? "",
        fotoUrl: data.fotoUrl ?? null,
      });
      await saveParticipantBiodataRpc(
        context.supabase as unknown as Parameters<typeof saveParticipantBiodataRpc>[0],
        biodata,
        "account_profile",
      );
    }

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

    // Display-only fields. Roles and biodata are never written here: user_metadata
    // is user-editable and travels inside every login token.
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

    await writeProfileAudit(context.userId, "user_profile_self_updated", before, {
      ...after,
      country: data.country ?? null,
      linkedin: data.linkedin ?? null,
      website: data.website ?? null,
      bio: data.bio ?? null,
      participant_biodata_saved: hasBioData,
    });
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
    if (avatarUrl) {
      // Only the profile linked to this account; an admin changing their own
      // photo must never overwrite the profiles they published for others.
      const { error: expertAvatarError } = await supabaseAdmin
        .from("experts")
        .update({ avatar_url: avatarUrl })
        .eq(EXPERT_OWNER_COLUMN, context.userId);
      if (expertAvatarError) console.error("[setAccountAvatar] expert avatar sync failed:", expertAvatarError.message);
    }
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
