// ============================================================================
// Trainer: update one's own live module (PB-ACA-01 versioning, Slide 20/38)
// ----------------------------------------------------------------------------
// Opening an update keeps the live version on air; the trainer edits the new
// draft in /experts/portal/submit-module and resubmits it through the normal
// trainer_module_save path, so the update goes through the same review and
// approval as a new module (migration 20261021120000).
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UPDATE_ERRORS: Array<[RegExp, string]> = [
  [/active_trainer_required|forbidden/, "Hanya trainer aktif yang dapat memperbarui modul."],
  [/update_note_required/, "Tuliskan ringkasan perubahan (minimal 5 karakter) agar verifikator tahu apa yang diperbarui."],
  [/update_note_too_long/, "Ringkasan perubahan terlalu panjang (maksimal 2.000 karakter)."],
  [/module_subject_not_found/, "Modul tidak ditemukan atau bukan milik Anda."],
  [/published_module_not_found/, "Modul ini tidak sedang tayang, jadi belum ada versi yang bisa diperbarui."],
  [/module_archived/, "Modul ini diarsipkan. Hubungi admin bila ingin menayangkannya kembali."],
  [/module_update_already_open|published_revision_already_open/, "Pembaruan untuk modul ini sudah terbuka. Lanjutkan draf pembaruan yang ada."],
  [/module_review_in_progress/, "Modul ini sedang diverifikasi. Tunggu keputusannya sebelum membuka pembaruan baru."],
  [/no_module_update_open/, "Tidak ada pembaruan yang bisa dibatalkan pada modul ini."],
  [/module_update_has_decision/, "Verifikator sudah memberi catatan pada pembaruan ini, jadi tidak bisa dibatalkan. Lanjutkan revisinya."],
  [/authentication_required/, "Sesi login berakhir. Silakan masuk kembali."],
];

function friendly(message: string): string {
  for (const [pattern, text] of UPDATE_ERRORS) if (pattern.test(message)) return text;
  return message;
}

export const openModuleUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({ subjectId: z.string().uuid(), note: z.string().trim().min(5).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: draftId, error } = await (context.supabase as any).rpc("trainer_open_module_update", {
      _subject_id: data.subjectId,
      _note: data.note,
    });
    if (error) throw new Error(friendly(error.message));
    if (!draftId) throw new Error("Draf pembaruan tidak terbentuk. Muat ulang halaman lalu coba lagi.");
    return { draftId: draftId as string };
  });

export const cancelModuleUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ subjectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any).rpc("trainer_cancel_module_update", {
      _subject_id: data.subjectId,
    });
    if (error) throw new Error(friendly(error.message));
    return { ok: true };
  });
