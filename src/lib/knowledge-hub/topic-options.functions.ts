// Topics offered on the Knowledge Hub contribution form, from Data Master
// (kh_topic_taxonomy; public read). Only active topics are offered; the database
// accepts on submit any topic in the list, so a publication that already uses a
// deactivated one can still be updated (migration 20261102020000).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// kh_topic_taxonomy is newer than the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type KhTopicOption = { name: string; active: boolean };

export const getKhTopicOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KhTopicOption[]> => {
    const { data, error } = await (context.supabase as Db)
      .from("kh_topic_taxonomy")
      .select("name, active, display_order")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(500);
    if (error) {
      if (/kh_topic_taxonomy|schema cache/.test(error.message)) {
        throw new Error("Daftar topik membutuhkan migrasi database 20261102020000. Hubungi admin.");
      }
      throw new Error(`Gagal memuat daftar topik: ${error.message}`);
    }
    return ((data ?? []) as Array<{ name: string; active: boolean }>).map((row) => ({ name: row.name, active: row.active }));
  });
