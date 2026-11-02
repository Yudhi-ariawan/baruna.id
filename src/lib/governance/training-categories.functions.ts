// ============================================================================
// Data Master: kategori pelatihan (Request a Training, Slide 12). Same rules
// as topik Knowledge Hub. Reads and writes go through RPCs that check the role (super
// admin, admin, approver) and write the audit trail; direct table writes are
// revoked (migration 20261102040000).
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type MasterTrainingCategory = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  displayOrder: number;
  /** Requests (submitted and drafts) whose proposed topics use this category. */
  usage: number;
  updatedAt: string;
};

const ERRORS: Array<[RegExp, string]> = [
  [/forbidden/, "Hanya Approver, Admin, atau Super Admin yang dapat mengelola Data Master."],
  [/authentication_required/, "Sesi login berakhir. Silakan masuk kembali."],
  [/training_category_name_invalid/, "Nama kategori wajib 2–120 karakter dan tanpa karakter khusus tak terlihat."],
  [/training_category_name_exists/, "Kategori dengan nama itu sudah ada (huruf besar/kecil dan spasi tidak dibedakan)."],
  [/training_category_description_too_long/, "Deskripsi maksimal 500 karakter."],
  [/training_category_order_invalid/, "Urutan harus angka 0–100.000."],
  [/training_category_not_found/, "Kategori tidak ditemukan. Muat ulang halaman."],
  [/training_category_in_use_rename_forbidden/, "Kategori ini sudah dipakai permintaan pelatihan, jadi namanya tidak bisa diganti. Nonaktifkan, lalu buat kategori baru."],
  [/training_category_last_active/, "Minimal satu kategori harus tetap aktif agar formulir Request a Training bisa dipakai."],
  [/master_training_categor|training_category_taxonomy|Could not find the function|schema cache/, "Kategori pelatihan membutuhkan migrasi database 20261102040000. Jalankan supabase/check_migrations.sql."],
];

async function rpc<T>(context: { supabase: unknown }, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (context.supabase as Db).rpc(fn, args ?? {});
  if (error) {
    const hit = ERRORS.find(([pattern]) => pattern.test(error.message));
    throw new Error(hit ? hit[1] : error.message);
  }
  return data as T;
}

export const getMasterTrainingCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => rpc<MasterTrainingCategory[]>(context, "master_training_categories_overview"));

export const saveMasterTrainingCategory = createServerFn({ method: "POST" })
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
    rpc<{ id: string; name: string }>(context, "master_training_category_save", {
      _id: data.id,
      _name: data.name,
      _description: data.description,
      _display_order: data.displayOrder,
    }),
  );

export const setMasterTrainingCategoryActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) =>
    rpc<{ id: string; active: boolean }>(context, "master_training_category_set_active", { _id: data.id, _active: data.active }),
  );
