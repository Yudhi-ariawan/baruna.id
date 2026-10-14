import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * expert_trainer_status is a VERSIONED HISTORY table: upsert_expert_trainer_status
 * appends a new row per change and trainer_portal_bootstrap reads the newest one
 * (version DESC, granted_at DESC). Never read it with `.maybeSingle()` — with two
 * or more versions that errors, the caller sees "no row" and inserts yet another
 * version on every request.
 */
export async function getLatestTrainerStatus(expertId: string) {
  const { data, error } = await supabaseAdmin
    .from("expert_trainer_status")
    .select("id, trainer_status, trainer_level, version")
    .eq("expert_id", expertId)
    .order("version", { ascending: false })
    .order("granted_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Gagal membaca status trainer: ${error.message}`);
  return data?.[0] ?? null;
}
