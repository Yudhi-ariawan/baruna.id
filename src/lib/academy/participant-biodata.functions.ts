import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ParticipantBiodata } from "./participant-biodata.types";

// Same limits as public._participant_biodata_problem (migration 20261020040000);
// the database repeats every check, so a direct call cannot skip them.
const BiodataInputSchema = z.object({
  nama: z.string().trim().min(2, "Nama wajib diisi").max(160),
  nip: z
    .string()
    .trim()
    .min(3, "NIP/Nomor Identitas wajib diisi")
    .max(40)
    .regex(/^[0-9A-Za-z./ -]+$/, "NIP hanya boleh berisi angka, huruf, titik, garis miring, atau tanda hubung"),
  tempatLahir: z.string().trim().min(2, "Tempat lahir wajib diisi").max(100),
  tanggalLahir: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal lahir wajib diisi (format YYYY-MM-DD)"),
  jenisKelamin: z.enum(["Laki-laki", "Perempuan"], { message: "Jenis kelamin wajib dipilih" }),
  agama: z.string().trim().min(2, "Agama wajib dipilih").max(60),
  jabatan: z.string().trim().min(2, "Jabatan wajib diisi").max(160),
  pangkatGolongan: z.string().trim().min(2, "Pangkat / golongan wajib dipilih").max(60),
  pendidikanTerakhir: z.string().trim().min(2, "Pendidikan terakhir wajib dipilih").max(80),
  noHp: z.string().trim().regex(/^\+?[0-9 ()-]{8,20}$/, "Nomor HP tidak valid"),
  unitEselon1: z.string().trim().min(2, "Unit Eselon I wajib dipilih").max(120),
  instansiUnitKerja: z.string().trim().min(2, "Instansi / Unit Kerja wajib diisi").max(200),
  alamatKantor: z.string().trim().min(3, "Alamat kantor wajib diisi").max(500),
  provinsi: z.string().trim().min(2, "Provinsi wajib diisi").max(80),
  kabupatenKota: z.string().trim().min(2, "Kabupaten / Kota wajib diisi").max(120),
  // Only an uploaded avatar URL; never an inline base64 image.
  fotoUrl: z.string().trim().max(600).regex(/^https:\/\//, "Pas foto harus diunggah ulang").optional().nullable().or(z.literal("")),
});

export type ParticipantBiodataInput = z.infer<typeof BiodataInputSchema>;

const BIODATA_FIELD_LABEL: Record<string, string> = {
  nama: "Nama", nip: "NIP/Nomor Identitas", tempatLahir: "Tempat lahir", tanggalLahir: "Tanggal lahir",
  jenisKelamin: "Jenis kelamin", agama: "Agama", jabatan: "Jabatan", pangkatGolongan: "Pangkat/golongan",
  pendidikanTerakhir: "Pendidikan terakhir", noHp: "Nomor HP", unitEselon1: "Unit Eselon I",
  instansiUnitKerja: "Instansi/Unit Kerja", alamatKantor: "Alamat kantor", provinsi: "Provinsi",
  kabupatenKota: "Kabupaten/Kota", fotoUrl: "Pas foto",
};

function toFriendlyBiodataError(message: string): string {
  if (message.includes("Could not find the function") || message.includes("schema cache")) {
    return "Penyimpanan biodata membutuhkan migrasi database 20261020040000. Hubungi pengelola sistem.";
  }
  if (message.includes("account_inactive")) {
    return "Akun Anda sedang dinonaktifkan administrator, sehingga biodata tidak dapat disimpan.";
  }
  const field = /biodata_field_invalid:(\w+)/.exec(message)?.[1];
  if (field) return `${BIODATA_FIELD_LABEL[field] ?? field} tidak valid. Periksa kembali isian tersebut.`;
  if (message.includes("participant_role_missing")) {
    return "Peran 'participant' belum terdaftar di sistem. Hubungi pengelola sistem.";
  }
  return `Gagal menyimpan biodata: ${message}`;
}

type BiodataRpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/**
 * Saves biodata, profile fields and the participant role in ONE transaction
 * (public.participant_biodata_save). Never reactivates an account or a role an
 * administrator disabled; never writes biodata into user_metadata (login token).
 */
export async function saveParticipantBiodataRpc(
  client: BiodataRpcClient,
  biodata: ParticipantBiodataInput,
  source: "academy_biodata_peserta" | "account_profile",
): Promise<{ roleState: "granted" | "already_active" | "blocked_by_admin" }> {
  const { data, error } = await client.rpc("participant_biodata_save", {
    _biodata: { ...biodata, fotoUrl: biodata.fotoUrl || null },
    _source: source,
  });
  if (error) throw new Error(toFriendlyBiodataError(error.message));
  const roleState = ((data ?? {}) as { roleState?: string }).roleState;
  return {
    roleState: roleState === "granted" || roleState === "blocked_by_admin" ? roleState : "already_active",
  };
}

export function validateParticipantBiodata(input: unknown): ParticipantBiodataInput {
  const parsed = BiodataInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path?.[0] ?? "");
    throw new Error(`${BIODATA_FIELD_LABEL[field] ?? field}: ${issue?.message ?? "tidak valid"}`);
  }
  return parsed.data;
}

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

    // The table row is the official record; legacy biodata (saved to user_metadata
    // before the table existed) only pre-fills the form. A role written into
    // user_metadata is user-editable and is no evidence of registration.
    if (bioRow || (nama && nip)) {
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
  .validator((input) => validateParticipantBiodata(input))
  .handler(async ({ data, context }) => {
    const { roleState } = await saveParticipantBiodataRpc(
      context.supabase as unknown as BiodataRpcClient,
      data,
      "academy_biodata_peserta",
    );
    return {
      success: true,
      roleState,
      message:
        roleState === "blocked_by_admin"
          ? "Biodata tersimpan. Peran Peserta pada akun Anda sedang dinonaktifkan administrator; hubungi admin untuk mengaktifkannya kembali."
          : "Biodata peserta berhasil disimpan! Akun Anda kini resmi menjadi Peserta Pelatihan (Participant).",
    };
  });