// ============================================================================
// Persetujuan Kelulusan (PB-ACA-05, Slide 24): Review Completion, Approval
// Completion, Remedial. Every read and write goes through RPCs (migration
// 20261109010000) that check the role and the state and write the audit trail.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type CompletionStatus = "pending_review" | "remedial" | "approved";
export type CompletionItem = {
  id: string;
  status: CompletionStatus;
  updatedAt: string;
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  decidedBy: string | null;
  mine: boolean;
  participantName: string;
  offeringCode: string;
  offeringTitle: string;
  courseTitle: string;
  modulesCompleted: number;
  modulesRequired: number;
  evaluationRequired: boolean;
  evaluationSubmitted: boolean;
  enrolmentStatus: string;
  certificateNumber: string | null;
  certificateHeldReason: string | null;
};
export type CompletionOverview = {
  canDecide: boolean;
  counts: Record<CompletionStatus, number>;
  items: CompletionItem[];
};

const ERRORS: Record<string, string> = {
  forbidden: "Akun Anda tidak berwenang untuk tindakan ini.",
  authentication_required: "Sesi login berakhir. Silakan masuk kembali.",
  completion_not_found: "Data kelulusan tidak ditemukan. Muat ulang halaman.",
  completion_self_decision_forbidden: "Kelulusan Anda sendiri harus diputuskan Approver/Admin lain.",
  completion_already_decided: "Kelulusan ini sudah disetujui.",
  completion_stale: "Data baru saja berubah di perangkat atau oleh orang lain. Muat ulang lalu ulangi.",
  completion_note_required: "Tuliskan alasan remedial (minimal 5 karakter).",
  completion_note_too_long: "Catatan maksimal 2.000 karakter.",
  completion_decision_invalid: "Keputusan tidak dikenal.",
  completion_status_invalid: "Status tidak dikenal.",
  completion_selection_empty: "Pilih minimal satu peserta.",
  completion_selection_too_many: "Maksimal 200 peserta sekali proses.",
  completion_requirements_not_met: "Syarat kelulusan peserta ini tidak lagi terpenuhi. Muat ulang halaman.",
  enrolment_not_active: "Peserta ini sudah menarik pendaftarannya.",
};

export function completionErrorText(code: string): string {
  // Longest matching key wins: "completion_self_decision_forbidden" must not read as "forbidden".
  const key = Object.keys(ERRORS)
    .filter((k) => code.includes(k))
    .sort((a, b) => b.length - a.length)[0];
  if (key) return ERRORS[key];
  if (/Could not find the function|schema cache/.test(code)) {
    return "Persetujuan Kelulusan membutuhkan migrasi database 20261109010000. Jalankan supabase/check_migrations.sql.";
  }
  return code;
}

async function rpc<T>(context: { supabase: unknown }, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (context.supabase as Db).rpc(fn, args);
  if (error) throw new Error(completionErrorText(error.message));
  return data as T;
}

export const getCompletionOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ status: z.enum(["pending_review", "remedial", "approved"]) }).parse(d))
  .handler(async ({ data, context }) => rpc<CompletionOverview>(context, "completion_overview", { _status: data.status }));

export const decideCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approve", "remedial"]),
        note: z.string().trim().max(2000).nullable(),
        expectedUpdatedAt: z.string().min(10),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    rpc<{ id: string; status: string }>(context, "completion_decide", {
      _id: data.id,
      _decision: data.decision,
      _note: data.note,
      _expected_updated_at: data.expectedUpdatedAt,
    }),
  );

export const approveCompletionsMany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const res = await rpc<{ approved: number; skipped: Array<{ id: string; reason: string }> }>(context, "completion_decide_many", {
      _ids: data.ids,
      _note: null,
    });
    return { approved: res.approved, skipped: res.skipped.map((s) => ({ id: s.id, reason: completionErrorText(s.reason) })) };
  });
