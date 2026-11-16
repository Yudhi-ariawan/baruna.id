// ============================================================================
// Data Master: bahasa (Slide 32 metadata bahasa, Slide 39 Language &
// Communication). Reads and writes go through RPCs that check the role (super
// admin, admin, approver) and write the audit trail; direct table writes are
// revoked (migration 20261102030000).
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MASTER_FORBIDDEN, masterRowName, submitMasterChange } from "@/lib/governance/master-change.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type MasterLanguage = {
  id: string;
  code: string;
  name: string;
  nativeName: string | null;
  active: boolean;
  displayOrder: number;
  /** Expert profiles and Knowledge Hub publications/drafts that use this language. */
  usage: number;
  updatedAt: string;
};

const ERRORS: Array<[RegExp, string]> = [
  // Exactly "forbidden" (not *_rename_forbidden, which has its own message below).
  [/(^|[^_a-z])forbidden([^_a-z]|$)/, MASTER_FORBIDDEN],
  [/authentication_required/, "Sesi login berakhir. Silakan masuk kembali."],
  [/language_code_invalid/, "Kode bahasa harus kode ISO 639: 2–3 huruf kecil, boleh dengan varian (mis. sw, fil, pt-br)."],
  [/language_code_exists/, "Kode bahasa itu sudah dipakai bahasa lain."],
  [/language_name_invalid/, "Nama bahasa wajib 2–80 karakter dan tanpa karakter khusus tak terlihat."],
  [/language_native_invalid/, "Nama asli maksimal 80 karakter."],
  [/language_name_exists/, "Bahasa dengan nama itu sudah ada (huruf besar/kecil dan spasi tidak dibedakan)."],
  [/language_order_invalid/, "Urutan harus angka 0–100.000."],
  [/language_not_found/, "Bahasa tidak ditemukan. Muat ulang halaman."],
  [/language_in_use_rename_forbidden/, "Bahasa ini sudah dipakai profil expert atau publikasi, jadi namanya tidak bisa diganti. Nama asli dan urutan tetap bisa diubah."],
  [/language_last_active/, "Minimal satu bahasa harus tetap aktif agar formulir bisa dipakai."],
  [/master_language|Could not find the function|schema cache/, "Bahasa membutuhkan migrasi database 20261102030000. Jalankan supabase/check_migrations.sql."],
];

async function rpc<T>(context: { supabase: unknown }, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (context.supabase as Db).rpc(fn, args ?? {});
  if (error) throw new Error(friendly(error.message));
  return data as T;
}

function friendly(message: string): string {
  const hit = ERRORS.find(([pattern]) => pattern.test(message));
  return hit ? hit[1] : message;
}

export const getMasterLanguages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => rpc<MasterLanguage[]>(context, "master_languages_overview"));

export const saveMasterLanguage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        id: z.string().uuid().nullable(),
        code: z.string().trim().max(12),
        name: z.string().trim().min(2).max(80),
        nativeName: z.string().trim().max(80).nullable(),
        displayOrder: z.number().int().min(0).max(100000).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    submitMasterChange<{ id: string; code: string }>(
      context,
      { kind: "language_save", payload: data, summary: `${data.id ? "Ubah" : "Tambah"} bahasa: ${data.name} (${data.code})` },
      { fn: "master_language_save", args: { _id: data.id, _code: data.code, _name: data.name, _native_name: data.nativeName, _display_order: data.displayOrder } },
      friendly,
    ),
  );

export const setMasterLanguageActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) =>
    submitMasterChange<{ id: string; active: boolean }>(
      context,
      { kind: "language_set_active", payload: data, summary: `${data.active ? "Aktifkan" : "Nonaktifkan"} bahasa: ${await masterRowName("languages_taxonomy", data.id)}` },
      { fn: "master_language_set_active", args: { _id: data.id, _active: data.active } },
      friendly,
    ),
  );
