// ============================================================================
// Data Master: topik Knowledge Hub (Slide 32/33: Taxonomy / Category dikelola
// Admin Console). Reads and writes go through RPCs that check the role (super
// admin, admin, approver) and write the audit trail; direct table writes are
// revoked (migration 20261102020000).
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type MasterKhTopic = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  displayOrder: number;
  /** Publications (not modules) and Knowledge Hub drafts that use this topic. */
  usage: number;
  updatedAt: string;
};

const ERRORS: Array<[RegExp, string]> = [
  [/forbidden/, "Hanya Approver, Admin, atau Super Admin yang dapat mengelola Data Master."],
  [/authentication_required/, "Sesi login berakhir. Silakan masuk kembali."],
  [/kh_topic_name_invalid/, "Nama topik wajib 2–120 karakter dan tanpa karakter khusus tak terlihat."],
  [/kh_topic_name_exists/, "Topik dengan nama itu sudah ada (huruf besar/kecil dan spasi tidak dibedakan)."],
  [/kh_topic_description_too_long/, "Deskripsi maksimal 500 karakter."],
  [/kh_topic_order_invalid/, "Urutan harus angka 0–100.000."],
  [/kh_topic_not_found/, "Topik tidak ditemukan. Muat ulang halaman."],
  [/kh_topic_in_use_rename_forbidden/, "Topik ini sudah dipakai publikasi atau pengajuan, jadi namanya tidak bisa diganti. Nonaktifkan, lalu buat topik baru."],
  [/kh_topic_last_active/, "Minimal satu topik harus tetap aktif agar formulir kontribusi Knowledge Hub bisa dipakai."],
  [/master_kh_topic|kh_topic_taxonomy|Could not find the function|schema cache/, "Topik Knowledge Hub membutuhkan migrasi database 20261102020000. Jalankan supabase/check_migrations.sql."],
];

async function rpc<T>(context: { supabase: unknown }, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (context.supabase as Db).rpc(fn, args ?? {});
  if (error) {
    const hit = ERRORS.find(([pattern]) => pattern.test(error.message));
    throw new Error(hit ? hit[1] : error.message);
  }
  return data as T;
}

export const getMasterKhTopics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => rpc<MasterKhTopic[]>(context, "master_kh_topics_overview"));

export const saveMasterKhTopic = createServerFn({ method: "POST" })
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
    rpc<{ id: string; name: string }>(context, "master_kh_topic_save", {
      _id: data.id,
      _name: data.name,
      _description: data.description,
      _display_order: data.displayOrder,
    }),
  );

export const setMasterKhTopicActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) =>
    rpc<{ id: string; active: boolean }>(context, "master_kh_topic_set_active", { _id: data.id, _active: data.active }),
  );
