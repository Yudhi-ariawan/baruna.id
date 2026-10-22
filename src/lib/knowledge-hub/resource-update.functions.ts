// ============================================================================
// Contributor: update one's own live Knowledge Hub publication
// ----------------------------------------------------------------------------
// Opening an update keeps the live version in the catalog; the contributor edits
// the new draft in /knowledge-hub/submit-resource and sends it through the normal
// kr_draft_submit path (all file and type rules apply). Approval replaces the
// catalog entry and raises its version; rejection keeps the live version
// (migration 20261022020000).
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UPDATE_ERRORS: Array<[RegExp, string]> = [
  [/update_note_required/, "Tuliskan ringkasan perubahan (minimal 5 karakter) agar kurator tahu apa yang diperbarui."],
  [/update_note_too_long/, "Ringkasan perubahan terlalu panjang (maksimal 2.000 karakter)."],
  [/resource_subject_not_found/, "Publikasi tidak ditemukan atau bukan milik Anda."],
  [/published_resource_not_found/, "Publikasi ini tidak sedang tayang, jadi belum ada versi yang bisa diperbarui."],
  [/resource_archived/, "Publikasi ini diarsipkan. Hubungi admin bila ingin menayangkannya kembali."],
  [/resource_update_already_open/, "Pembaruan untuk publikasi ini sudah terbuka. Lanjutkan draf pembaruan yang ada."],
  [/resource_review_in_progress/, "Publikasi ini sedang ditinjau kurator. Tunggu keputusannya sebelum membuka pembaruan baru."],
  [/no_resource_update_open/, "Tidak ada pembaruan yang bisa dibatalkan. Pembaruan yang sudah dikirim atau diminta kurator tidak bisa dibatalkan."],
  [/authentication_required/, "Sesi login berakhir. Silakan masuk kembali."],
  [/Could not find the function|schema cache/, "Fitur pembaruan publikasi membutuhkan migrasi database 20261022020000. Jalankan supabase/check_migrations.sql."],
];

function friendly(message: string): string {
  for (const [pattern, text] of UPDATE_ERRORS) if (pattern.test(message)) return text;
  return message;
}

export const openKnowledgeResourceUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({ subjectId: z.string().uuid(), note: z.string().trim().min(5).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: draftId, error } = await (context.supabase as any).rpc("contributor_open_resource_update", {
      _subject_id: data.subjectId,
      _note: data.note,
    });
    if (error) throw new Error(friendly(error.message));
    if (!draftId) throw new Error("Draf pembaruan tidak terbentuk. Muat ulang halaman lalu coba lagi.");
    return { draftId: draftId as string };
  });

export const cancelKnowledgeResourceUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ subjectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any).rpc("contributor_cancel_resource_update", {
      _subject_id: data.subjectId,
    });
    if (error) throw new Error(friendly(error.message));
    return { ok: true };
  });
