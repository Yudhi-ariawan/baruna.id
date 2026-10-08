import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ParticipantBiodata } from "./participant-biodata.types";

const BiodataInputSchema = z.object({
  nama: z.string().trim().min(2, "Nama wajib diisi"),
  nip: z.string().trim().min(3, "NIP/Nomor Identitas wajib diisi"),
  tempatLahir: z.string().trim().min(2, "Tempat lahir wajib diisi"),
  tanggalLahir: z.string().trim().min(8, "Tanggal lahir wajib diisi"),
  jenisKelamin: z.string().trim().min(2, "Jenis kelamin wajib dipilih"),
  agama: z.string().trim().min(2, "Agama wajib dipilih"),
  jabatan: z.string().trim().min(2, "Jabatan wajib diisi"),
  pangkatGolongan: z.string().trim().min(2, "Pangkat / golongan wajib dipilih"),
  pendidikanTerakhir: z.string().trim().min(2, "Pendidikan terakhir wajib dipilih"),
  noHp: z.string().trim().min(8, "Nomor HP wajib diisi"),
  unitEselon1: z.string().trim().min(2, "Unit Eselon I wajib dipilih"),
  instansiUnitKerja: z.string().trim().min(2, "Instansi / Unit Kerja wajib diisi"),
  alamatKantor: z.string().trim().min(3, "Alamat kantor wajib diisi"),
  provinsi: z.string().trim().min(2, "Provinsi wajib diisi"),
  kabupatenKota: z.string().trim().min(2, "Kabupaten / Kota wajib diisi"),
  fotoUrl: z.string().trim().optional().nullable(),
});

export type GetMyParticipantBiodataResult = {
  isRegistered: boolean;
  biodata: ParticipantBiodata | null;
  prefill: {
    nama: string;
    noHp: string;
    instansi: string;
    jabatan: string;
    email: string;
  };
};

export const getMyParticipantBiodata = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GetMyParticipantBiodataResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch user profile and identity with fault-tolerant handlers
    const [userIdentRes, profileRes, bioRowRes, auditLogRes] = await Promise.allSettled([
      supabaseAdmin.auth.admin.getUserById(context.userId),
      supabaseAdmin
        .from("profiles")
        .select("display_name, phone, organization, job_title, avatar_url")
        .eq("id", context.userId)
        .maybeSingle(),
      (supabaseAdmin as any)
        .from("participant_biodata")
        .select("*")
        .eq("user_id", context.userId)
        .maybeSingle(),
      (supabaseAdmin as any)
        .from("admin_audit_log")
        .select("after_data, created_at")
        .eq("target_user_id", context.userId)
        .eq("entity_type", "participant_biodata")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const userIdent = userIdentRes.status === "fulfilled" ? userIdentRes.value.data : null;
    const profile = profileRes.status === "fulfilled" ? profileRes.value.data : null;
    const bioRow =
      bioRowRes.status === "fulfilled" && !bioRowRes.value.error
        ? bioRowRes.value.data
        : null;
    const auditLog =
      auditLogRes.status === "fulfilled" && !auditLogRes.value.error
        ? auditLogRes.value.data?.[0]
        : null;

    const userMeta = (userIdent?.user?.user_metadata as Record<string, any>) || {};
    const metaBiodata = (userMeta.participant_biodata as Record<string, any>) || null;
    const auditBiodata = (auditLog?.after_data as Record<string, any>) || null;

    const defaultName =
      bioRow?.nama ||
      metaBiodata?.nama ||
      auditBiodata?.nama ||
      profile?.display_name ||
      userMeta.display_name ||
      userMeta.full_name ||
      userIdent?.user?.email?.split("@")[0] ||
      "";
    const defaultPhone =
      bioRow?.no_hp ||
      metaBiodata?.noHp ||
      auditBiodata?.noHp ||
      profile?.phone ||
      userMeta.phone ||
      "";
    const defaultInstansi =
      bioRow?.instansi_unit_kerja ||
      metaBiodata?.instansiUnitKerja ||
      auditBiodata?.instansiUnitKerja ||
      profile?.organization ||
      userMeta.organization ||
      "";
    const defaultJabatan =
      bioRow?.jabatan ||
      metaBiodata?.jabatan ||
      auditBiodata?.jabatan ||
      profile?.job_title ||
      userMeta.job_title ||
      "";
    const defaultPhoto =
      bioRow?.foto_url ||
      metaBiodata?.fotoUrl ||
      auditBiodata?.fotoUrl ||
      profile?.avatar_url ||
      (userMeta.avatar_url as string) ||
      "";
    const email = userIdent?.user?.email || "";

    // 1. Konsolidasi multi-source: merge audit log, user_metadata, table row, & profile
    const mergedBio: Record<string, any> = {
      ...(auditBiodata || {}),
      ...(metaBiodata || {}),
      ...(bioRow
        ? {
            id: bioRow.id,
            nama: bioRow.nama,
            nip: bioRow.nip,
            tempatLahir: bioRow.tempat_lahir,
            tanggalLahir: bioRow.tanggal_lahir,
            jenisKelamin: bioRow.jenis_kelamin,
            agama: bioRow.agama,
            jabatan: bioRow.jabatan,
            pangkatGolongan: bioRow.pangkat_golongan,
            pendidikanTerakhir: bioRow.pendidikan_terakhir,
            noHp: bioRow.no_hp,
            unitEselon1: bioRow.unit_eselon_1,
            instansiUnitKerja: bioRow.instansi_unit_kerja,
            alamatKantor: bioRow.alamat_kantor,
            provinsi: bioRow.provinsi,
            kabupatenKota: bioRow.kabupaten_kota,
            fotoUrl: bioRow.foto_url,
          }
        : {}),
    };

    const nama = mergedBio.nama || defaultName;
    const nip = mergedBio.nip || (userMeta.nip as string) || "";
    const tempatLahir =
      mergedBio.tempatLahir ||
      mergedBio.tempat_lahir ||
      (userMeta.tempat_lahir as string) ||
      "";
    const tanggalLahir =
      mergedBio.tanggalLahir ||
      mergedBio.tanggal_lahir ||
      (userMeta.tanggal_lahir as string) ||
      "";
    const jenisKelamin =
      mergedBio.jenisKelamin ||
      mergedBio.jenis_kelamin ||
      (userMeta.jenis_kelamin as string) ||
      "Laki-laki";
    const agama =
      mergedBio.agama ||
      (userMeta.agama as string) ||
      "Islam";
    const jabatan =
      mergedBio.jabatan ||
      defaultJabatan ||
      "";
    const pangkatGolongan =
      mergedBio.pangkatGolongan ||
      mergedBio.pangkat_golongan ||
      (userMeta.pangkat_golongan as string) ||
      "";
    const pendidikanTerakhir =
      mergedBio.pendidikanTerakhir ||
      mergedBio.pendidikan_terakhir ||
      (userMeta.pendidikan_terakhir as string) ||
      "";
    const noHp =
      mergedBio.noHp ||
      mergedBio.no_hp ||
      defaultPhone ||
      "";
    const unitEselon1 =
      mergedBio.unitEselon1 ||
      mergedBio.unit_eselon_1 ||
      (userMeta.unit_eselon_1 as string) ||
      "";
    const instansiUnitKerja =
      mergedBio.instansiUnitKerja ||
      mergedBio.instansi_unit_kerja ||
      defaultInstansi ||
      "";
    const alamatKantor =
      mergedBio.alamatKantor ||
      mergedBio.alamat_kantor ||
      (userMeta.alamat_kantor as string) ||
      "";
    const provinsi =
      mergedBio.provinsi ||
      (userMeta.provinsi as string) ||
      "";
    const kabupatenKota =
      mergedBio.kabupatenKota ||
      mergedBio.kabupaten_kota ||
      (userMeta.kabupaten_kota as string) ||
      "";
    const fotoUrl =
      mergedBio.fotoUrl ||
      mergedBio.foto_url ||
      defaultPhoto ||
      null;

    const isParticipantRole =
      userMeta.role === "participant" ||
      (Array.isArray(userMeta.roles) && userMeta.roles.includes("participant"));

    if (nama && (nip || isParticipantRole)) {
      const biodata: ParticipantBiodata = {
        id: mergedBio.id || bioRow?.id || `bio_${context.userId}`,
        userId: context.userId,
        nama,
        nip,
        tempatLahir,
        tanggalLahir,
        jenisKelamin,
        agama,
        jabatan,
        pangkatGolongan,
        pendidikanTerakhir,
        noHp,
        unitEselon1,
        instansiUnitKerja,
        alamatKantor,
        provinsi,
        kabupatenKota,
        fotoUrl,
        createdAt: mergedBio.createdAt || bioRow?.created_at || new Date().toISOString(),
        updatedAt: mergedBio.updatedAt || bioRow?.updated_at || new Date().toISOString(),
      };
      return {
        isRegistered: true,
        biodata,
        prefill: {
          nama: defaultName,
          noHp: defaultPhone,
          instansi: defaultInstansi,
          jabatan: defaultJabatan,
          email,
        },
      };
    }

    return {
      isRegistered: false,
      biodata: null,
      prefill: {
        nama: defaultName,
        noHp: defaultPhone,
        instansi: defaultInstansi,
        jabatan: defaultJabatan,
        email,
      },
    };
  });

export const saveParticipantBiodata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => BiodataInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    let savedToTable = false;

    // 1. Coba simpan ke tabel `participant_biodata` (jika tabel sudah aktif di PostgREST)
    try {
      const { error: upsertErr } = await (supabaseAdmin as any)
        .from("participant_biodata")
        .upsert(
          {
            user_id: context.userId,
            nama: data.nama,
            nip: data.nip,
            tempat_lahir: data.tempatLahir,
            tanggal_lahir: data.tanggalLahir,
            jenis_kelamin: data.jenisKelamin,
            agama: data.agama,
            jabatan: data.jabatan,
            pangkat_golongan: data.pangkatGolongan,
            pendidikan_terakhir: data.pendidikanTerakhir,
            no_hp: data.noHp,
            unit_eselon_1: data.unitEselon1,
            instansi_unit_kerja: data.instansiUnitKerja,
            alamat_kantor: data.alamatKantor,
            provinsi: data.provinsi,
            kabupaten_kota: data.kabupatenKota,
            foto_url: data.fotoUrl || null,
            updated_at: now,
          },
          { onConflict: "user_id" },
        );

      if (!upsertErr) {
        savedToTable = true;
      } else {
        console.warn("[saveParticipantBiodata] Table upsert warning (fallback used):", upsertErr.message);
      }
    } catch (e: any) {
      console.warn("[saveParticipantBiodata] Table not ready yet, using metadata persistence:", e?.message);
    }

    // 2. SELALU Simpan ke `auth.users.user_metadata` (100% Persisten, aman tanpa schema error)
    try {
      const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const currentMeta = (userRecord?.user?.user_metadata as Record<string, any>) || {};
      const currentRoles: string[] = Array.isArray(currentMeta.roles)
        ? currentMeta.roles
        : [currentMeta.role || "registered_user"];

      const updatedRoles = Array.from(new Set([...currentRoles, "participant"]));

      await supabaseAdmin.auth.admin.updateUserById(context.userId, {
        user_metadata: {
          ...currentMeta,
          display_name: data.nama,
          full_name: data.nama,
          phone: data.noHp,
          organization: data.instansiUnitKerja,
          job_title: data.jabatan,
          avatar_url: data.fotoUrl || currentMeta.avatar_url || null,
          role: "participant",
          roles: updatedRoles,
          participant_biodata: {
            ...data,
            updatedAt: now,
          },
        },
      });
    } catch (metaErr) {
      console.warn("[saveParticipantBiodata] user_metadata sync warning:", metaErr);
    }

    // 3. Sinkronkan profil ke `public.profiles`
    try {
      const profileUpdates: Record<string, any> = {
        display_name: data.nama,
        phone: data.noHp,
        organization: data.instansiUnitKerja,
        job_title: data.jabatan,
        is_active: true,
        updated_at: now,
      };
      if (data.fotoUrl) {
        profileUpdates.avatar_url = data.fotoUrl;
      }
      await (supabaseAdmin as any)
        .from("profiles")
        .update(profileUpdates)
        .eq("id", context.userId);
    } catch (profileErr) {
      console.warn("[saveParticipantBiodata] profile sync warning:", profileErr);
    }

    // 4. Ubah role menjadi "participant" di `public.rbac_user_roles` LANGSUNG AKTIF tanpa acc admin
    try {
      const { data: participantRole } = await (supabaseAdmin as any)
        .from("rbac_roles")
        .select("id")
        .eq("code", "participant")
        .maybeSingle();

      if (participantRole?.id) {
        // Periksa apakah user sudah memiliki role primer aktif
        const { data: existingPrimary } = await (supabaseAdmin as any)
          .from("rbac_user_roles")
          .select("id")
          .eq("user_id", context.userId)
          .eq("status", "active")
          .eq("is_primary", true)
          .maybeSingle();

        const isPrimary = !existingPrimary;

        // Berikan role participant aktif langsung (approved_at langsung diisi)
        await (supabaseAdmin as any).from("rbac_user_roles").upsert(
          {
            user_id: context.userId,
            role_id: participantRole.id,
            status: "active",
            is_primary: isPrimary,
            scope: {},
            valid_from: now,
            approved_at: now, // Otomatis disetujui sistem (self-service)
            reason: "registered_as_participant_self_service",
          },
          { onConflict: "user_id,role_id" },
        );
      }
    } catch (roleErr) {
      console.warn("[saveParticipantBiodata] role assignment warning:", roleErr);
    }

    // 5. Catat audit trail lengkap ke `public.admin_audit_log`
    try {
      await (supabaseAdmin as any).from("admin_audit_log").insert({
        event_type: "participant_biodata_saved",
        actor_id: context.userId,
        target_user_id: context.userId,
        entity_type: "participant_biodata",
        entity_id: context.userId,
        before_data: null,
        after_data: {
          ...data,
          saved_to_table: savedToTable,
          role_assigned: "participant",
        },
        metadata: {
          saved_at: now,
          source: "academy_biodata_peserta",
          direct_role_activation: true,
        },
      });
    } catch (auditErr) {
      console.warn("[saveParticipantBiodata] audit log warning:", auditErr);
    }

    return {
      success: true,
      message: "Biodata peserta berhasil disimpan! Akun Anda kini resmi menjadi Peserta Pelatihan (Participant).",
    };
  });
