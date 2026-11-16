// Data Master change requests (migration 20261116010000; CATATAN_PERBAIKAN 2az):
// Operators propose, another Approver/Admin approves or rejects, the proposer may
// withdraw. The database checks every rule; these only pass the call through.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MasterChangeKind } from "@/lib/governance/master-change.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type MasterChangeRequest = {
  id: string;
  kind: MasterChangeKind;
  summary: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestedBy: string | null;
  requestedByName: string | null;
  requestedAt: string;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
};

export type MasterChangeRequests = { canDecide: boolean; me: string; items: MasterChangeRequest[] };

const ERRORS: Array<[RegExp, string]> = [
  [/authentication_required/, "Sesi login berakhir. Silakan masuk kembali."],
  [/self_decision_forbidden/, "Usulan Anda sendiri harus diputuskan oleh Approver atau Admin lain."],
  [/master_request_reason_required/, "Tuliskan alasan penolakan (minimal 5 karakter) agar Operator tahu apa yang perlu diperbaiki."],
  [/master_request_already_decided/, "Usulan ini sudah diputuskan atau dibatalkan. Muat ulang halaman."],
  [/master_request_not_found/, "Usulan tidak ditemukan atau bukan milik Anda. Muat ulang halaman."],
  [/master_request_too_many/, "Anda sudah punya 20 usulan yang menunggu. Tunggu sebagian diputuskan dulu."],
  [/master_request_payload_invalid/, "Isi usulan tidak valid. Tolak usulan ini dan minta Operator mengusulkan ulang."],
  [/module_limits_stale/, "Kuota sudah diubah sejak usulan ini dibuat. Tolak usulan ini dan minta Operator mengusulkan ulang dari angka terbaru."],
  [/_unchanged/, "Usulan ini tidak mengubah apa pun dibanding data sekarang. Tolak saja."],
  [/_name_exists|_code_exists/, "Nama atau kode itu sudah ada di daftar. Tolak usulan ini."],
  [/_in_use_rename_forbidden/, "Data ini sudah dipakai, jadi namanya tidak bisa diganti. Tolak usulan ini."],
  [/_last_active/, "Minimal satu data harus tetap aktif. Tolak usulan ini."],
  [/_not_found/, "Data yang diubah sudah tidak ada. Tolak usulan ini."],
  [/(^|[^_a-z])forbidden([^_a-z]|$)/, "Hanya Approver, Admin, atau Super Admin yang dapat memutuskan usulan Data Master."],
];

function friendly(message: string): string {
  const hit = ERRORS.find(([pattern]) => pattern.test(message));
  return hit ? hit[1] : message;
}

/** Null before migration 20261116010000 (the page then shows no request list). */
export const listMasterChangeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MasterChangeRequests | null> => {
    const { data, error } = await (context.supabase as Db).rpc("master_change_requests_list");
    if (error) {
      if (/master_change_requests_list|PGRST202/.test(`${error.message} ${error.code ?? ""}`)) return null;
      throw new Error(friendly(error.message));
    }
    return data as MasterChangeRequests;
  });

export const decideMasterChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({ id: z.string().uuid(), decision: z.enum(["approve", "reject"]), note: z.string().trim().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase as Db).rpc("master_change_decide", {
      _id: data.id,
      _decision: data.decision,
      _note: data.note || null,
    });
    if (error) throw new Error(friendly(error.message));
    return res as { id: string; status: string };
  });

export const cancelMasterChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase as Db).rpc("master_change_cancel", { _id: data.id });
    if (error) throw new Error(friendly(error.message));
    return res as { id: string; status: string };
  });
