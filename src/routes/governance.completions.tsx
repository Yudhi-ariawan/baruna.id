// Persetujuan Kelulusan (PB-ACA-05, Slide 24): participants who met the requirements
// wait here; a decider approves (the certificate is issued) or asks for remedial.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, CheckCircle2, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Pager } from "@/components/governance/Pager";
import { usePagedList } from "@/lib/governance/usePagedList";
import {
  approveCompletionsMany,
  decideCompletion,
  getCompletionOverview,
  type CompletionItem,
  type CompletionStatus,
} from "@/lib/academy/completions.functions";

export const Route = createFileRoute("/governance/completions")({
  head: () => ({ meta: [{ title: "Persetujuan Kelulusan — Konsol Kurasi" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: CompletionsPage,
});

const TABS: Array<{ key: CompletionStatus; label: string }> = [
  { key: "pending_review", label: "Menunggu persetujuan" },
  { key: "remedial", label: "Perlu tindak lanjut" },
  { key: "approved", label: "Disetujui" },
];
const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmt = (d: string | null) => (d ? dateFmt.format(new Date(d)) : "-");

function CompletionsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<CompletionStatus>("pending_review");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [remedialFor, setRemedialFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const loadFn = useServerFn(getCompletionOverview);
  const decideFn = useServerFn(decideCompletion);
  const manyFn = useServerFn(approveCompletionsMany);

  const q = useQuery({ queryKey: ["governance", "completions", tab], queryFn: () => loadFn({ data: { status: tab } }), staleTime: 15_000 });
  const items = q.data?.items ?? [];
  const paged = usePagedList(items, tab);
  const canDecide = Boolean(q.data?.canDecide);
  const selectable = (i: CompletionItem) => canDecide && !i.mine && i.status !== "approved" && i.enrolmentStatus !== "withdrawn";

  const refresh = () => {
    setSelected(new Set());
    setRemedialFor(null);
    setNote("");
    void qc.invalidateQueries({ queryKey: ["governance", "completions"] });
  };
  const decideM = useMutation({
    mutationFn: (v: { item: CompletionItem; decision: "approve" | "remedial"; note: string | null }) =>
      decideFn({ data: { id: v.item.id, decision: v.decision, note: v.note, expectedUpdatedAt: v.item.updatedAt } }),
    onSuccess: (_r, v) => { toast.success(v.decision === "approve" ? "Kelulusan disetujui." : "Remedial dicatat dan peserta diberi tahu."); refresh(); },
    onError: (e) => { toast.error(e instanceof Error ? e.message : String(e)); void qc.invalidateQueries({ queryKey: ["governance", "completions"] }); },
  });
  const manyM = useMutation({
    mutationFn: (ids: string[]) => manyFn({ data: { ids } }),
    onSuccess: (r) => {
      toast.success(`${r.approved} kelulusan disetujui.`);
      if (r.skipped.length) toast.warning(`${r.skipped.length} dilewati: ${r.skipped[0].reason}`);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  const busy = decideM.isPending || manyM.isPending;
  const pageSelectable = paged.pageItems.filter(selectable);
  const allOnPage = pageSelectable.length > 0 && pageSelectable.every((i) => selected.has(i.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s);
    for (const i of pageSelectable) { if (allOnPage) n.delete(i.id); else n.add(i.id); }
    return n;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-navy"><Award className="h-6 w-6 text-marine" /> Persetujuan Kelulusan</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Peserta yang sudah memenuhi syarat course masuk ke sini otomatis. Setelah disetujui, peserta dinyatakan lulus dan sertifikatnya terbit (PB-ACA-05).
          </p>
        </div>
        <button type="button" onClick={() => void q.refetch()} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted">
          <RefreshCw className="h-3.5 w-3.5" /> Segarkan
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => { setTab(t.key); setSelected(new Set()); setRemedialFor(null); }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.key ? "border-marine text-marine" : "border-transparent text-muted-foreground hover:text-navy"}`}>
            {t.label} ({q.data?.counts?.[t.key] ?? 0})
          </button>
        ))}
      </div>

      {q.isError ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{q.error instanceof Error ? q.error.message : String(q.error)}</p> : null}
      {q.isLoading ? <p className="text-sm text-muted-foreground">Memuat…</p> : null}
      {!q.isLoading && !q.isError && items.length === 0 ? <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Tidak ada data pada tab ini.</p> : null}

      {canDecide && tab !== "approved" && pageSelectable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={allOnPage} onChange={toggleAll} /> Pilih semua di halaman ini</label>
          <button type="button" disabled={busy || selected.size === 0} onClick={() => manyM.mutate([...selected])}
            className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            {manyM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Setujui terpilih ({selected.size})
          </button>
        </div>
      ) : null}

      <ul className="space-y-3">
        {paged.pageItems.map((i) => (
          <li key={i.id} className="rounded-2xl border border-border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {selectable(i) ? <input type="checkbox" className="mt-1" aria-label={`Pilih ${i.participantName}`} checked={selected.has(i.id)} onChange={() => toggle(i.id)} /> : null}
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{i.participantName}{i.mine ? " (Anda)" : ""}</p>
                  <p className="text-sm text-foreground/80">{i.courseTitle} · <span className="text-marine">{i.offeringTitle}</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Modul {i.modulesCompleted}/{i.modulesRequired} · Evaluasi akhir: {i.evaluationRequired ? (i.evaluationSubmitted ? "terkirim" : "belum") : "tidak diwajibkan"} · Masuk {fmt(i.createdAt)}
                  </p>
                  {i.enrolmentStatus === "withdrawn" ? <p className="mt-1 text-xs font-semibold text-amber-800">Peserta sudah menarik pendaftarannya.</p> : null}
                  {i.decisionNote ? <p className="mt-1 text-xs text-foreground/80"><span className="font-semibold">Catatan:</span> {i.decisionNote}</p> : null}
                  {i.decidedAt && i.decidedBy ? <p className="mt-0.5 text-xs text-muted-foreground">Diputuskan {i.decidedBy} · {fmt(i.decidedAt)}</p> : null}
                  {i.certificateNumber ? <p className="mt-1 font-mono text-xs text-navy">{i.certificateNumber}</p> : null}
                  {i.certificateHeldReason ? <p className="mt-1 text-xs text-amber-800">Lulus; sertifikat ditahan karena course berbayar dan pembayaran belum tersedia.</p> : null}
                </div>
              </div>
              {selectable(i) ? (
                <div className="flex shrink-0 gap-2">
                  <button type="button" disabled={busy} onClick={() => decideM.mutate({ item: i, decision: "approve", note: null })}
                    className="inline-flex items-center gap-1 rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Setujui
                  </button>
                  <button type="button" disabled={busy} onClick={() => { setRemedialFor(remedialFor === i.id ? null : i.id); setNote(""); }}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-50">
                    <RotateCcw className="h-3.5 w-3.5" /> Minta remedial
                  </button>
                </div>
              ) : i.mine && i.status !== "approved" ? <p className="text-xs text-muted-foreground">Menunggu keputusan Approver/Admin lain</p> : null}
            </div>
            {remedialFor === i.id ? (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <label className="block text-xs font-semibold text-navy">
                  Alasan dan tindak lanjut untuk peserta (minimal 5 karakter)
                  <textarea className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm font-normal" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                <button type="button" disabled={busy || note.trim().length < 5} onClick={() => decideM.mutate({ item: i, decision: "remedial", note: note.trim() })}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Kirim permintaan remedial</button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <Pager {...paged} />
    </div>
  );
}
