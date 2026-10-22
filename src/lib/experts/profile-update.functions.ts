// ============================================================================
// Expert: update one's own published profile (PB-EXP-01 versioning, Slide 36)
// ----------------------------------------------------------------------------
// Opening an update keeps the published profile, the expert role and the trainer
// status; the expert edits the new draft in /experts/join and sends it through the
// existing revision path (expert_revision_resubmit), so it goes through the same
// verification as an application (migration 20261022030000).
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toFriendlyExpertError } from "./application-validation";

function friendly(message: string): string {
  if (/Could not find the function|schema cache/.test(message)) {
    return "Fitur pembaruan profil membutuhkan migrasi database 20261022030000. Jalankan supabase/check_migrations.sql.";
  }
  return toFriendlyExpertError(message);
}

export const openExpertProfileUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({ subjectId: z.string().uuid(), note: z.string().trim().min(5).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: draftId, error } = await (context.supabase as any).rpc("expert_open_profile_update", {
      _subject_id: data.subjectId,
      _note: data.note,
    });
    if (error) throw new Error(friendly(error.message));
    if (!draftId) throw new Error("Draf pembaruan tidak terbentuk. Muat ulang halaman lalu coba lagi.");
    return { draftId: draftId as string };
  });

export const cancelExpertProfileUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ subjectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any).rpc("expert_cancel_profile_update", {
      _subject_id: data.subjectId,
    });
    if (error) throw new Error(friendly(error.message));
    return { ok: true };
  });
