// Version history of a module, Knowledge Hub publication or expert profile
// (Slide 20/36/38 versioning, migration 20261022040000). Metadata only: version,
// publication date, approver and decision note; content snapshots stay private.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ContentVersion = {
  version: number;
  publishedAt: string;
  approvedBy: string | null;
  note: string | null;
  /** approval: approved decision; resync: re-published by an admin without a new decision;
   *  initial: version 1, taken from the first approval. */
  source: "approval" | "resync" | "initial";
};

export type ContentVersionHistory = {
  kind: string;
  supported: boolean;
  currentVersion?: number | null;
  published?: boolean;
  versions: ContentVersion[];
};

export const getContentVersionHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ subjectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ContentVersionHistory> => {
    // Access is checked in the database (owner, assigned reviewer, admin/approver).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (context.supabase as any).rpc("content_version_history", {
      _subject_id: data.subjectId,
    });
    if (error) {
      if (/Could not find the function|schema cache/.test(error.message)) {
        throw new Error("Riwayat versi membutuhkan migrasi database 20261022040000. Jalankan supabase/check_migrations.sql.");
      }
      if (/subject_not_found/.test(error.message)) throw new Error("Riwayat versi tidak tersedia untuk akun ini.");
      throw new Error(error.message);
    }
    return result as ContentVersionHistory;
  });
