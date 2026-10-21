import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Info, Save, Timer } from "lucide-react";
import { listSlaPolicies, updateSlaPolicy } from "@/lib/governance/workflow-sla.functions";
import { formatHoursId, type SlaPolicy } from "@/lib/training-requests/workflow";

// Slide 13: "setiap langkah dapat memiliki SLA". Targets live in
// workflow_sla_policies; only an administrator changes them (set_workflow_sla_policy).
export const Route = createFileRoute("/governance/sla")({
  head: () => ({ meta: [{ title: "SLA Alur Kerja — Konsol Kurasi BARUNA" }] }),
  component: SlaPage,
});

const KIND_LABEL: Record<string, string> = {
  training_need: "Permintaan Pelatihan",
  module: "Modul",
  expert: "Expert",
  knowledge_resource: "Publikasi",
};
const STEP_LABEL: Record<string, string> = {
  pending: "Cek kelengkapan & penugasan reviewer",
  under_review: "Review substansi",
  decision_pending: "Keputusan akhir",
};

function SlaPage() {
  const listFn = useServerFn(listSlaPolicies);
  const q = useQuery({ queryKey: ["governance", "sla-policies"], queryFn: () => listFn(), staleTime: 60_000 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-navy">
          <Timer className="h-6 w-6 text-marine" /> SLA Alur Kerja
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Batas waktu tiap langkah review. Langkah yang melewati batas ditandai di daftar pengajuan dan memicu
          notifikasi ke penanggung jawabnya.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Nilai awal bersifat sementara dan menunggu arahan mentor. Waktu dihitung dalam jam kalender (termasuk akhir
          pekan) sejak pengajuan masuk ke langkah tersebut. Langkah saat pemohon sedang merevisi tidak dihitung.
        </p>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : (q.data?.policies ?? []).length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground">
          Belum ada SLA. Jalankan migrasi 20261021110000 terlebih dahulu.
        </p>
      ) : (
        <ul className="space-y-3">
          {(q.data?.policies ?? []).map((p) => (
            <PolicyRow key={`${p.subject_kind}:${p.status}`} policy={p} canEdit={Boolean(q.data?.canEdit)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PolicyRow({ policy, canEdit }: { policy: SlaPolicy; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const updateFn = useServerFn(updateSlaPolicy);
  const [hours, setHours] = useState(String(policy.target_hours));
  const [label, setLabel] = useState(policy.responsible_label);
  const [active, setActive] = useState(policy.is_active);
  const parsed = Number(hours);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 8760 && label.trim().length > 0;
  const dirty = parsed !== policy.target_hours || label.trim() !== policy.responsible_label || active !== policy.is_active;

  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          // Values come from the policy row itself; the server validates them again.
          subjectKind: policy.subject_kind as "expert" | "module" | "knowledge_resource" | "training_need",
          status: policy.status as "pending" | "under_review" | "decision_pending",
          targetHours: parsed,
          responsibleLabel: label.trim(),
          isActive: active,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["governance", "sla-policies"] });
      void queryClient.invalidateQueries({ queryKey: ["governance", "training-needs"] });
    },
  });

  return (
    <li className="rounded-xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
            {KIND_LABEL[policy.subject_kind] ?? policy.subject_kind}
          </p>
          <p className="font-semibold text-navy">{STEP_LABEL[policy.status] ?? policy.status}</p>
          <p className="text-xs text-muted-foreground">
            Target {formatHoursId(policy.target_hours)} · {policy.responsible_label}
            {policy.is_active ? "" : " · nonaktif"}
          </p>
        </div>
      </div>

      {canEdit ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr_auto_auto] sm:items-end">
          <label className="text-xs font-semibold text-navy">
            Target (jam)
            <input
              type="number"
              min={1}
              max={8760}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-navy">
            Penanggung jawab
            <input
              value={label}
              maxLength={120}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-navy">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Aktif
          </label>
          <button
            type="button"
            disabled={!valid || !dirty || save.isPending}
            onClick={() => save.mutate()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-marine px-3 py-2 text-xs font-semibold text-white hover:bg-navy disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {save.isPending ? "Menyimpan…" : "Simpan"}
          </button>
          {save.isError ? (
            <p className="text-xs text-destructive sm:col-span-4">{(save.error as Error).message}</p>
          ) : save.isSuccess && !dirty ? (
            <p className="text-xs text-emerald-700 sm:col-span-4">Tersimpan dan tercatat di audit trail.</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
