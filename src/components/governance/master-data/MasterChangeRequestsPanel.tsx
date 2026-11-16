// Usulan Perubahan Data Master (CATATAN_PERBAIKAN 2az): an Operator's changes wait
// here until another Approver/Admin approves or rejects them; the proposer can
// withdraw. Shown at the top of the Data Master page.
import { useEffect, useRef, useState } from "react";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock, Inbox, Loader2, Undo2, X } from "lucide-react";
import {
  cancelMasterChangeRequest,
  decideMasterChangeRequest,
  listMasterChangeRequests,
  type MasterChangeRequest,
} from "@/lib/governance/master-change.functions";
import { barunaToast } from "@/lib/downloads";

const KEY = ["governance", "master-data", "requests"];
const STATUS: Record<MasterChangeRequest["status"], { label: string; cls: string }> = {
  pending: { label: "Menunggu", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "Disetujui", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Ditolak", cls: "bg-red-100 text-red-800" },
  cancelled: { label: "Dibatalkan", cls: "bg-muted text-muted-foreground" },
};
const when = (d: string | null) => (d ? new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "");

export function MasterChangeRequestsPanel() {
  const listFn = useServerFn(listMasterChangeRequests);
  const q = useQuery({ queryKey: KEY, queryFn: () => listFn(), staleTime: 15_000 });

  // Any save on this page may have created a proposal: refresh once saving ends.
  const mutating = useIsMutating();
  const wasMutating = useRef(false);
  useEffect(() => {
    if (mutating > 0) wasMutating.current = true;
    else if (wasMutating.current) { wasMutating.current = false; void q.refetch(); }
  }, [mutating, q]);

  // Tell the Operator when a new proposal of theirs appears.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!q.data) return;
    const mine = q.data.items.filter((r) => r.status === "pending" && r.requestedBy === q.data!.me).map((r) => r.id);
    if (seen.current && mine.some((id) => !seen.current!.has(id))) {
      barunaToast("Usulan terkirim. Perubahan berlaku setelah disetujui Approver atau Admin.");
    }
    seen.current = new Set(mine);
  }, [q.data]);

  if (q.isLoading || !q.data) return q.isError ? <p className="text-sm text-destructive">{(q.error as Error).message}</p> : null;
  const { canDecide, me, items } = q.data;
  const pending = items.filter((r) => r.status === "pending");
  const done = items.filter((r) => r.status !== "pending");

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-white p-5">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy"><Inbox className="h-5 w-5 text-marine" /> Usulan Perubahan</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {canDecide
            ? "Perubahan yang diusulkan Operator. Setujui untuk menerapkannya (aturan yang sama dengan simpan langsung tetap diperiksa), atau tolak dengan alasan. Usulan Anda sendiri diputuskan orang lain."
            : "Anda masuk sebagai Operator: setiap perubahan yang Anda simpan di halaman ini dikirim sebagai usulan dan baru berlaku setelah disetujui Approver atau Admin."}
        </p>
      </div>
      {pending.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">Tidak ada usulan yang menunggu.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {pending.map((r) => <PendingRow key={r.id} r={r} canDecide={canDecide && r.requestedBy !== me} mine={r.requestedBy === me} />)}
        </ul>
      )}
      {done.length > 0 ? (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-navy">Riwayat 30 hari ({done.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {done.map((r) => (
              <li key={r.id} className="rounded-lg border border-border px-2 py-1.5">
                <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                {r.summary}
                <span className="block text-muted-foreground">
                  Diusulkan {r.requestedByName ?? "—"} · {when(r.requestedAt)}
                  {r.decidedByName ? ` · diputuskan ${r.decidedByName} ${when(r.decidedAt)}` : ""}
                  {r.decisionNote ? ` · "${r.decisionNote}"` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function PendingRow({ r, canDecide, mine }: { r: MasterChangeRequest; canDecide: boolean; mine: boolean }) {
  const qc = useQueryClient();
  const decideFn = useServerFn(decideMasterChangeRequest);
  const cancelFn = useServerFn(cancelMasterChangeRequest);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const done = () => { void qc.invalidateQueries({ queryKey: ["governance"] }); void qc.invalidateQueries({ queryKey: ["master"] }); };
  const decide = useMutation({ mutationFn: (d: "approve" | "reject") => decideFn({ data: { id: r.id, decision: d, note: note.trim() || undefined } }), onSuccess: done });
  const cancel = useMutation({ mutationFn: () => cancelFn({ data: { id: r.id } }), onSuccess: done });
  const busy = decide.isPending || cancel.isPending;
  const error = (decide.error ?? cancel.error) as Error | null;

  return (
    <li className="space-y-1.5 px-3 py-2.5 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-navy"><Clock className="mr-1 inline h-3.5 w-3.5 text-amber-600" />{r.summary}</p>
          <p className="text-muted-foreground">Diusulkan {mine ? "oleh Anda" : r.requestedByName ?? "—"} · {when(r.requestedAt)}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {canDecide && !rejecting ? (
            <>
              <button type="button" disabled={busy} onClick={() => decide.mutate("approve")}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {decide.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Setujui
              </button>
              <button type="button" disabled={busy} onClick={() => setRejecting(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                <X className="h-3.5 w-3.5" /> Tolak
              </button>
            </>
          ) : null}
          {mine ? (
            <button type="button" disabled={busy} onClick={() => cancel.mutate()}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 font-semibold text-navy hover:bg-muted disabled:opacity-50">
              <Undo2 className="h-3.5 w-3.5" /> Batalkan
            </button>
          ) : null}
        </div>
      </div>
      {rejecting ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Alasan penolakan (wajib)"
            className="min-w-0 flex-1 rounded-lg border border-border px-2 py-1" />
          <button type="button" disabled={busy || note.trim().length < 5} onClick={() => decide.mutate("reject")}
            className="rounded-lg bg-red-600 px-2.5 py-1 font-semibold text-white disabled:opacity-50">Tolak usulan</button>
          <button type="button" onClick={() => setRejecting(false)} className="rounded-lg px-2 py-1 text-muted-foreground">Batal</button>
        </div>
      ) : null}
      {error ? <p className="text-destructive">{error.message}</p> : null}
    </li>
  );
}
