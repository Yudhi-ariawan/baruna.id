// Penayangan (Publisher, Slide 16; migration 20261116020000; CATATAN_PERBAIKAN 2ba):
// take live content off the air temporarily and put it back. The database checks
// the role (publisher, admin, super_admin) and every rule.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const PUBLICATION_KINDS = ["course_offering", "knowledge_resource", "module", "expert"] as const;
export type PublicationKind = (typeof PUBLICATION_KINDS)[number];

export type PublicationItem = {
  kind: PublicationKind;
  id: string;
  title: string;
  ref: string | null;
  live: boolean;
  heldAt: string | null;
  heldReason: string | null;
  heldByName: string | null;
  updatedAt: string;
};

const ERRORS: Array<[RegExp, string]> = [
  [/authentication_required/, "Sesi login berakhir. Silakan masuk kembali."],
  [/publication_reason_required/, "Tuliskan alasan menurunkan (5–500 karakter); alasan ini tercatat di audit."],
  [/publication_already_held/, "Konten ini sudah diturunkan. Muat ulang halaman."],
  [/publication_not_held/, "Konten ini tidak sedang diturunkan. Muat ulang halaman."],
  [/publication_not_live/, "Hanya konten yang sedang tayang yang bisa diturunkan."],
  [/publication_not_found/, "Konten tidak ditemukan. Muat ulang halaman."],
  [/publication_kind_invalid/, "Jenis konten tidak dikenal."],
  [/(^|[^_a-z])forbidden([^_a-z]|$)/, "Hanya Publisher, Admin, atau Super Admin yang dapat mengatur penayangan."],
  [/publication_list|publication_hold|publication_release|PGRST202/, "Penayangan membutuhkan migrasi database 20261116020000. Jalankan supabase/check_migrations.sql."],
];
const friendly = (m: string) => ERRORS.find(([p]) => p.test(m))?.[1] ?? m;

export const listPublications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PublicationItem[]> => {
    const { data, error } = await (context.supabase as Db).rpc("publication_list");
    if (error) throw new Error(friendly(`${error.message} ${error.code ?? ""}`));
    return (data ?? []) as PublicationItem[];
  });

const target = z.object({ kind: z.enum(PUBLICATION_KINDS), id: z.string().uuid() });

export const holdPublication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => target.extend({ reason: z.string().trim().min(5).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase as Db).rpc("publication_hold", { _kind: data.kind, _id: data.id, _reason: data.reason });
    if (error) throw new Error(friendly(error.message));
    return res as { held: boolean };
  });

export const releasePublication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => target.extend({ note: z.string().trim().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase as Db).rpc("publication_release", { _kind: data.kind, _id: data.id, _note: data.note || null });
    if (error) throw new Error(friendly(error.message));
    return res as { status: string; live: boolean };
  });
