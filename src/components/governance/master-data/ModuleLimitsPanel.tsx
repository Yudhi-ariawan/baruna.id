// Data Master: maximum active modules per trainer level (read by module_draft_create).
// The save carries the values this screen loaded, so a change made meanwhile on
// another device is never overwritten silently.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Info, Save } from "lucide-react";
import {
  MODULE_LIMITS_STALE,
  TRAINER_LEVEL_ORDER,
  getModuleLimits,
  saveModuleLimits,
  type ModuleLimitMap,
  type ModuleLimitsData,
  type TrainerLevelCode,
} from "@/lib/governance/master-data.functions";

const LABEL: Record<TrainerLevelCode, string> = {
  certified: "Certified",
  advanced: "Advanced",
  senior: "Senior",
  master: "Master",
};
const QUERY_KEY = ["governance", "master-data", "module-limits"];
const fmt = (iso: string) => new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
const summary = (m: Partial<ModuleLimitMap>) => TRAINER_LEVEL_ORDER.map((l) => `${LABEL[l]} ${m[l] ?? "–"}`).join(" · ");

export function ModuleLimitsPanel() {
  const fn = useServerFn(getModuleLimits);
  const q = useQuery({ queryKey: QUERY_KEY, queryFn: () => fn(), staleTime: 30_000 });
  // Kept here: the form remounts with the reloaded values after a save or a conflict.
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-white p-5">
      <div>
        <h2 className="font-display text-lg font-bold text-navy">Kuota Modul per Level Trainer</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Jumlah maksimal modul aktif (tayang + menunggu keputusan) yang boleh dimiliki trainer di tiap level. Dipakai
          saat trainer membuat modul baru di Portal Trainer.
        </p>
      </div>
      {notice ? <p className={`text-xs ${notice.ok ? "text-emerald-700" : "text-destructive"}`}>{notice.text}</p> : null}
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : q.data ? (
        <ModuleLimitsForm key={q.data.limits.map((l) => l.updatedAt).join()} data={q.data} onNotice={setNotice} />
      ) : null}
    </section>
  );
}

function ModuleLimitsForm({
  data,
  onNotice,
}: {
  data: ModuleLimitsData;
  onNotice: (n: { ok: boolean; text: string } | null) => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveModuleLimits);
  const loaded = Object.fromEntries(data.limits.map((l) => [l.level, l.limit])) as Partial<ModuleLimitMap>;
  const complete = TRAINER_LEVEL_ORDER.every((l) => typeof loaded[l] === "number");
  const [values, setValues] = useState(
    () => Object.fromEntries(TRAINER_LEVEL_ORDER.map((l) => [l, String(loaded[l] ?? "")])) as Record<TrainerLevelCode, string>,
  );
  const [note, setNote] = useState("");
  const nums = TRAINER_LEVEL_ORDER.map((l) => Number(values[l]));
  const intsOk = TRAINER_LEVEL_ORDER.every((l) => /^\d{1,4}$/.test(values[l]) && Number(values[l]) >= 1);
  const ordered = nums.every((n, i) => i === 0 || n >= nums[i - 1]);
  const changed = TRAINER_LEVEL_ORDER.some((l) => Number(values[l]) !== loaded[l]);
  const valid = complete && intsOk && ordered && changed && note.trim().length >= 5;
  const lowered = TRAINER_LEVEL_ORDER.filter((l) => intsOk && Number(values[l]) < (loaded[l] ?? 0));

  const m = useMutation({
    mutationFn: () =>
      save({
        data: {
          limits: Object.fromEntries(TRAINER_LEVEL_ORDER.map((l) => [l, Number(values[l])])) as ModuleLimitMap,
          expected: loaded as ModuleLimitMap,
          note: note.trim(),
        },
      }),
    onMutate: () => onNotice(null),
    onSuccess: () => {
      onNotice({ ok: true, text: "Kuota tersimpan dan tercatat di audit trail." });
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => {
      if (!(e as Error).message.startsWith(MODULE_LIMITS_STALE)) return;
      onNotice({ ok: false, text: (e as Error).message });
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return (
    <>
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Trainer yang belum punya level tidak bisa membuat modul tambahan (kuota 0, tidak diubah di sini). Menurunkan
          kuota tidak menarik modul yang sudah ada; trainer yang sudah melewati kuota hanya tidak bisa membuat modul
          baru.
        </p>
      </div>
      {!complete ? (
        <p className="text-xs text-destructive">Kuota di database belum lengkap untuk keempat level. Isi semuanya lalu simpan.</p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-4">
        {TRAINER_LEVEL_ORDER.map((level) => (
          <label key={level} className="text-xs font-semibold text-navy">
            {LABEL[level]}
            <input value={values[level]} inputMode="numeric" maxLength={4}
              onChange={(e) => setValues((v) => ({ ...v, [level]: e.target.value.trim() }))}
              className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm" />
            <span className="mt-0.5 block font-normal text-muted-foreground">
              {data.trainers[level] ?? 0} trainer aktif
            </span>
          </label>
        ))}
      </div>
      {!intsOk ? <p className="text-xs text-destructive">Kuota harus bilangan bulat 1–9.999.</p> : null}
      {intsOk && !ordered ? (
        <p className="text-xs text-destructive">Level lebih tinggi tidak boleh lebih kecil: Certified ≤ Advanced ≤ Senior ≤ Master.</p>
      ) : null}
      {lowered.length ? (
        <p className="text-xs text-amber-800">
          Kuota {lowered.map((l) => LABEL[l]).join(", ")} diturunkan. Trainer di level itu yang sudah mencapai kuota baru tidak
          bisa membuat modul lagi.
        </p>
      ) : null}
      <label className="block text-xs font-semibold text-navy">
        Alasan perubahan (wajib)
        <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)}
          placeholder="mis. Disesuaikan dengan kapasitas review kurikulum 2026"
          className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm" />
      </label>
      <button type="button" disabled={!valid || m.isPending} onClick={() => m.mutate()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-3 py-2 text-xs font-semibold text-white hover:bg-navy disabled:opacity-50">
        <Save className="h-3.5 w-3.5" /> {m.isPending ? "Menyimpan…" : "Simpan kuota"}
      </button>
      {m.isError && !(m.error as Error).message.startsWith(MODULE_LIMITS_STALE) ? (
        <p className="text-xs text-destructive">{(m.error as Error).message}</p>
      ) : null}

      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold text-navy">Riwayat perubahan</p>
        {data.history.length ? (
          <ul className="mt-1 space-y-1.5 text-xs text-muted-foreground">
            {data.history.map((h) => (
              <li key={h.at}>
                <span className="font-medium text-navy">{fmt(h.at)}</span>
                {h.by ? ` · ${h.by}` : ""}: {summary(h.before)} → {summary(h.after)}
                {h.note ? <span className="block italic">“{h.note}”</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Belum pernah diubah lewat Data Master.</p>
        )}
      </div>
    </>
  );
}
