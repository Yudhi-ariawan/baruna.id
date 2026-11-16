// Program Academy: link an old Full Training program to the Course Offering that
// replaces it (CATATAN_PERBAIKAN 2bb). Shown only to Approver/Admin.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { listFullTrainingReplacements, setFullTrainingReplacement } from "@/lib/academy/full-training-replacement.functions";

const KEY = ["governance", "full-training-replacements"];

export function FullTrainingReplacementPanel() {
  const fn = useServerFn(listFullTrainingReplacements);
  const q = useQuery({ queryKey: KEY, queryFn: () => fn(), staleTime: 30_000 });
  if (!q.data || q.data.programs.length === 0) return null;
  return (
    <section className="space-y-2 rounded-2xl border border-border bg-white p-4">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-navy"><ArrowRightLeft className="h-4 w-4 text-marine" /> Full Training lama → Course Offering</h2>
      <p className="text-xs text-muted-foreground">
        Buat ulang program Full Training sebagai Course Offering ("Wajib disetujui admin" dengan dokumen persyaratannya), lalu tautkan di
        sini. Pendaftar baru diarahkan ke offering itu; pengajuan yang sudah berjalan tetap selesai di program lama.
      </p>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {q.data.programs.map((p) => <Row key={p.courseId} program={p} offerings={q.data!.offerings} />)}
      </ul>
    </section>
  );
}

function Row({ program, offerings }: { program: { courseId: string; title: string; replacedBy: string | null }; offerings: Array<{ code: string; title: string }> }) {
  const qc = useQueryClient();
  const setFn = useServerFn(setFullTrainingReplacement);
  const [code, setCode] = useState(program.replacedBy ?? "");
  const m = useMutation({
    mutationFn: () => setFn({ data: { courseId: program.courseId, offeringCode: code || null } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
      <span className="min-w-[14rem] flex-1">
        <span className="block font-semibold text-navy">{program.title}</span>
        <span className="text-muted-foreground">
          {program.replacedBy ? <>Dialihkan ke <b>{program.replacedBy}</b></> : "Belum dialihkan: pendaftaran masih lewat formulir Full Training lama"}
        </span>
      </span>
      <select value={code} onChange={(e) => setCode(e.target.value)} className="max-w-xs rounded-lg border border-border bg-white px-2 py-1.5">
        <option value="">— Tidak dialihkan —</option>
        {offerings.map((o) => <option key={o.code} value={o.code}>{o.title} ({o.code})</option>)}
      </select>
      <button type="button" disabled={m.isPending || code === (program.replacedBy ?? "")} onClick={() => m.mutate()}
        className="inline-flex items-center gap-1 rounded-lg bg-marine px-3 py-1.5 font-semibold text-white disabled:opacity-50">
        {m.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Simpan
      </button>
      {m.isError ? <span className="w-full text-destructive">{(m.error as Error).message}</span> : null}
    </li>
  );
}
