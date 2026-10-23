// ============================================================================
// Data Master: bidang keahlian expert and trainer level rules (Slide 16: Approver
// and Admin have full access to the Experts and Academy domains).
// ----------------------------------------------------------------------------
// Every read and write goes through RPCs that check the role (super_admin, admin,
// approver) and write the audit trail; direct table writes are revoked
// (migration 20261023010000).
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type MasterExpertise = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  displayOrder: number;
  /** Profiles, expert drafts and link rows that use this bidang. */
  usage: number;
  updatedAt: string;
};

export const TRAINER_LEVEL_ORDER = ["certified", "advanced", "senior", "master"] as const;
export type TrainerLevelCode = (typeof TRAINER_LEVEL_ORDER)[number];

export type MasterTrainerLevel = {
  level: TrainerLevelCode;
  minParticipants: number;
  evidence: string | null;
  version: number;
  effectiveFrom: string;
};

export type MasterData = {
  expertise: MasterExpertise[];
  trainerLevels: MasterTrainerLevel[];
  trainerLevelVersions: Array<{ version: number; effectiveFrom: string; effectiveUntil: string | null; createdBy: string | null }>;
};

const ERRORS: Array<[RegExp, string]> = [
  [/forbidden/, "Hanya Approver, Admin, atau Super Admin yang dapat mengelola Data Master."],
  [/authentication_required/, "Sesi login berakhir. Silakan masuk kembali."],
  [/expertise_name_invalid/, "Nama bidang wajib 2–120 karakter dan tanpa karakter khusus tak terlihat."],
  [/expertise_name_exists/, "Bidang dengan nama itu sudah ada (huruf besar/kecil dan spasi tidak dibedakan)."],
  [/expertise_description_too_long/, "Deskripsi maksimal 500 karakter."],
  [/expertise_order_invalid/, "Urutan harus angka 0–100.000."],
  [/expertise_not_found/, "Bidang tidak ditemukan. Muat ulang halaman."],
  [/expertise_in_use_rename_forbidden/, "Bidang ini sudah dipakai profil atau pengajuan expert, jadi namanya tidak bisa diganti. Nonaktifkan, lalu buat bidang baru."],
  [/expertise_last_active/, "Minimal satu bidang harus tetap aktif agar formulir Become an Expert bisa dipakai."],
  [/trainer_levels_note_required/, "Tuliskan alasan perubahan (5–500 karakter)."],
  [/trainer_levels_invalid/, "Keempat level (Certified, Advanced, Senior, Master) wajib diisi tepat satu kali."],
  [/trainer_levels_min_invalid/, "Jumlah lulusan harus bilangan bulat 1–1.000.000."],
  [/trainer_levels_not_increasing/, "Jumlah lulusan harus naik berurutan: Certified < Advanced < Senior < Master."],
  [/trainer_levels_evidence_too_long/, "Syarat bukti maksimal 500 karakter per level."],
  [/trainer_levels_unchanged/, "Tidak ada perubahan dibanding aturan yang berlaku."],
  [/Could not find the function|schema cache/, "Data Master membutuhkan migrasi database 20261023010000. Jalankan supabase/check_migrations.sql."],
];

function friendly(message: string): string {
  for (const [pattern, text] of ERRORS) if (pattern.test(message)) return text;
  return message;
}

async function rpc<T>(context: { supabase: unknown }, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (context.supabase as Db).rpc(fn, args ?? {});
  if (error) throw new Error(friendly(error.message));
  return data as T;
}

export const getMasterData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => rpc<MasterData>(context, "master_data_overview"));

export const saveMasterExpertise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        id: z.string().uuid().nullable(),
        name: z.string().trim().min(2).max(120),
        description: z.string().trim().max(500).nullable(),
        displayOrder: z.number().int().min(0).max(100000).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    rpc<{ id: string; name: string }>(context, "master_expertise_save", {
      _id: data.id,
      _name: data.name,
      _description: data.description,
      _display_order: data.displayOrder,
    }),
  );

export const setMasterExpertiseActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) =>
    rpc<{ id: string; active: boolean }>(context, "master_expertise_set_active", { _id: data.id, _active: data.active }),
  );

export const saveTrainerLevels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        rules: z
          .array(
            z.object({
              level: z.enum(TRAINER_LEVEL_ORDER),
              minParticipants: z.number().int().min(1).max(1000000),
              evidence: z.string().trim().max(500).nullable(),
            }),
          )
          .length(4),
        note: z.string().trim().min(5).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    rpc<{ version: number }>(context, "master_trainer_levels_set", { _rules: data.rules, _note: data.note }),
  );
