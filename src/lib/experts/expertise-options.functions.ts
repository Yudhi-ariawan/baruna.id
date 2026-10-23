// Bidang keahlian offered on the Become an Expert form, from Data Master
// (expertise_taxonomy; public read). Only active bidang are offered; the database
// accepts on submit any bidang in the list, so a profile that already uses a
// deactivated one can still be updated (migration 20261023010000).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ExpertiseOption = { name: string; active: boolean };

export const getExpertiseOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExpertiseOption[]> => {
    const { data, error } = await context.supabase
      .from("expertise_taxonomy")
      .select("name, active, display_order")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(500);
    if (error) throw new Error(`Gagal memuat daftar bidang keahlian: ${error.message}`);
    return (data ?? []).map((row) => ({ name: row.name, active: row.active }));
  });
