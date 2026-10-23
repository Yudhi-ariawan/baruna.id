// Data Master: trainer level rules (minimum unique graduates per level). Saved as a
// new version; the previous version is closed and kept in the history.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Info, Save } from "lucide-react";
import {
  TRAINER_LEVEL_ORDER,
  saveTrainerLevels,
  type MasterData,
  type TrainerLevelCode,
} from "@/lib/governance/master-data.functions";

const LABEL: Record<TrainerLevelCode, string> = {
  certified: "Certified",
  advanced: "Advanced",
  senior: "Senior",
  master: "Master",
};
const fmt = (iso: string) => new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

export function TrainerLevelsPanel({ data }: { data: MasterData }) {
  const qc = useQueryClient();
  const fn = useServerFn(saveTrainerLevels);
  const current = Object.fromEntries(data.trainerLevels.map((r) => [r.level, r]));
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      TRAINER_LEVEL_ORDER.map((l) => [l, { min: String(current[l]?.minParticipants ?? ""), evidence: current[l]?.evidence ?? "" }]),
    ) as Record<TrainerLevelCode, { min: string; evidence: string }>,
  );
  const [note, setNote] = useState("");
  const mins = TRAINER_LEVEL_ORDER.map((l) => Number(values[l].min));
  const intsOk = TRAINER_LEVEL_ORDER.every((l) => /^\d{1,7}$/.test(values[l].min) && Number(values[l].min) >= 1 && Number(values[l].min) <= 1000000);
  const increasing = mins.every((m, i) => i === 0 || m > mins[i - 1]);
  const valid = intsOk && increasing && note.trim().length >= 5;

  const m = useMutation({
    mutationFn: () =>
      fn({
        data: {
          rules: TRAINER_LEVEL_ORDER.map((level) => ({
            level,
            minParticipants: Number(values[level].min),
            evidence: values[level].evidence.trim() || null,
          })),
          note: note.trim(),
        },
      }),
    onSuccess: () => {
      setNote("");
      void qc.invalidateQueries({ queryKey: ["governance", "master-data"] });
    },
  });

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-white p-5">
      <div>
        <h2 className="font-display text-lg font-bold text-navy">Aturan Level Trainer</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Minimal jumlah lulusan unik per level, ditampilkan di Portal Trainer dan direktori expert.
        </p>
      </div>
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Menyimpan membuat versi aturan baru; versi lama tetap tercatat. Level trainer yang sudah diberikan tidak berubah
          otomatis. Level diputuskan admin lewat Kualifikasi Trainer.
        </p>
      </div>
      <div className="grid gap-2">
        {TRAINER_LEVEL_ORDER.map((level) => (
          <div key={level} className="grid gap-2 sm:grid-cols-[8rem_8rem_1fr] sm:items-end">
            <p className="text-sm font-semibold text-navy">{LABEL[level]}</p>
            <label className="text-xs font-semibold text-navy">
              Min. lulusan
              <input value={values[level].min} inputMode="numeric"
                onChange={(e) => setValues((v) => ({ ...v, [level]: { ...v[level], min: e.target.value } }))}
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-semibold text-navy">
              Syarat bukti
              <input value={values[level].evidence} maxLength={500}
                onChange={(e) => setValues((v) => ({ ...v, [level]: { ...v[level], evidence: e.target.value } }))}
                className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm" />
            </label>
          </div>
        ))}
      </div>
      {!intsOk ? <p className="text-xs text-destructive">Jumlah lulusan harus bilangan bulat 1–1.000.000.</p> : null}
      {intsOk && !increasing ? (
        <p className="text-xs text-destructive">Harus naik berurutan: Certified &lt; Advanced &lt; Senior &lt; Master.</p>
      ) : null}
      <label className="block text-xs font-semibold text-navy">
        Alasan perubahan (wajib)
        <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)}
          placeholder="mis. Disesuaikan dengan kebijakan sertifikasi 2026"
          className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm" />
      </label>
      <button type="button" disabled={!valid || m.isPending} onClick={() => m.mutate()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-3 py-2 text-xs font-semibold text-white hover:bg-navy disabled:opacity-50">
        <Save className="h-3.5 w-3.5" /> {m.isPending ? "Menyimpan…" : "Simpan sebagai versi baru"}
      </button>
      {m.isError ? <p className="text-xs text-destructive">{(m.error as Error).message}</p> : null}
      {m.isSuccess ? <p className="text-xs text-emerald-700">Tersimpan sebagai versi {m.data.version} dan tercatat di audit trail.</p> : null}

      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold text-navy">Riwayat versi</p>
        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
          {data.trainerLevelVersions.map((v) => (
            <li key={v.version}>
              v{v.version} · berlaku {fmt(v.effectiveFrom)}
              {v.effectiveUntil ? ` s.d. ${fmt(v.effectiveUntil)}` : " (berlaku sekarang)"}
              {v.createdBy ? ` · oleh ${v.createdBy}` : ""}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
