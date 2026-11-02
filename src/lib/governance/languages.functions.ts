// ============================================================================
// Data Master: bahasa (Slide 32 metadata bahasa, Slide 39 Language &
// Communication). Reads and writes go through RPCs that check the role (super
// admin, admin, approver) and write the audit trail; direct table writes are
// revoked (migration 20261102030000).
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  [/forbidden/, "Hanya Approver, Admin, atau Super Admin yang dapat mengelola Data Master."],
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
  if (error) {
    const hit = ERRORS.find(([pattern]) => pattern.test(error.message));
    throw new Error(hit ? hit[1] : error.message);
  }
  return data as T;
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
    rpc<{ id: string; code: string }>(context, "master_language_save", {
      _id: data.id,
      _code: data.code,
      _name: data.name,
      _native_name: data.nativeName,
      _display_order: data.displayOrder,
    }),
  );

export const setMasterLanguageActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) =>
    rpc<{ id: string; active: boolean }>(context, "master_language_set_active", { _id: data.id, _active: data.active }),
  );
