// Decision on a submitted program draft (Slide 20-21: review, then approval).
// Only an approver/admin other than the author sees it; the database refuses
// self-decisions, stale screens and double decisions anyway.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { decideProgramDraft, type ProgramDraft } from "@/lib/academy/programs.functions";
import { PROGRAMS_QUERY_KEY } from "./programLabels";

export function DraftDecisionPanel({ draft, problemText }: { draft: ProgramDraft; problemText: string | null }) {
  const qc = useQueryClient();
  const fn = useServerFn(decideProgramDraft);
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: (decision: "approve" | "request_revision" | "reject") =>
      fn({ data: { id: draft.id, decision, note: note.trim() || null, expectedUpdatedAt: draft.updatedAt } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PROGRAMS_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ["governance", "program-draft", draft.id] });
    },
  });
  const noteOk = note.trim().length >= 5;

  return (
    <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
      <h2 className="font-display text-base font-bold text-navy">Keputusan</h2>
      <p className="text-xs text-muted-foreground">
        Disetujui: data tayang diganti dengan isi draf ini dan versinya naik. Minta revisi: draf kembali ke pembuatnya. Ditolak: draf
        selesai tanpa mengubah apa pun.
      </p>
      {problemText ? <p className="text-xs text-destructive">Draf ini tidak lolos pemeriksaan: {problemText}</p> : null}
      <label className="block text-xs font-semibold text-navy">
        Catatan (wajib untuk minta revisi dan tolak)
        <textarea value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)}
          className="mt-1 min-h-[70px] w-full rounded-lg border border-border px-2 py-1.5 text-sm" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={m.isPending || Boolean(problemText)} onClick={() => m.mutate("approve")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          <CheckCircle2 className="h-4 w-4" /> Setujui &amp; aktifkan
        </button>
        <button type="button" disabled={m.isPending || !noteOk} onClick={() => m.mutate("request_revision")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-50 disabled:opacity-50">
          <RotateCcw className="h-4 w-4" /> Minta revisi
        </button>
        <button type="button" disabled={m.isPending || !noteOk}
          onClick={() => { if (window.confirm("Tolak draf ini? Draf selesai tanpa mengubah data.")) m.mutate("reject"); }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
          <XCircle className="h-4 w-4" /> Tolak
        </button>
      </div>
      {m.isError ? <p className="text-xs text-destructive">{(m.error as Error).message}</p> : null}
    </section>
  );
}
