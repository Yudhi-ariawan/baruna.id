// Stage, SLA and status history in the curation console (Slide 13).
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Clock } from "lucide-react";
import { getSubjectStatusHistory } from "@/lib/governance/workflow-sla.functions";
import { STAGE_LABEL_ID, formatHoursId, type WorkflowStage } from "@/lib/training-requests/workflow";

const STATUS_ID: Record<string, string> = {
  pending: "Diajukan / menunggu",
  under_review: "Sedang direview",
  decision_pending: "Menunggu keputusan",
  approved: "Disetujui",
  rejected: "Ditolak",
  withdrawn: "Ditarik",
  archived: "Diarsipkan",
};

const fmt = (iso: string) => new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

/** One line: stage, since when, and the SLA state of the step. */
export function StageSlaLine({ stage }: { stage: WorkflowStage }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span className="font-semibold text-navy">{STAGE_LABEL_ID[stage.key]}</span>
      <span>sejak {fmt(stage.since)}</span>
      {stage.sla ? (
        stage.sla.overdue ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 font-semibold text-red-700">
            <AlertTriangle className="h-3 w-3" /> Melewati SLA {formatHoursId(stage.sla.targetHours)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
            <Clock className="h-3 w-3" /> Batas {fmt(stage.sla.dueAt)}
          </span>
        )
      ) : null}
    </span>
  );
}

export function StatusHistoryPanel({ subjectId }: { subjectId: string }) {
  const fn = useServerFn(getSubjectStatusHistory);
  const q = useQuery({
    queryKey: ["governance", "status-history", subjectId],
    queryFn: () => fn({ data: { subjectId } }),
    staleTime: 15_000,
  });
  if (q.isLoading) return <p className="text-xs text-muted-foreground">Memuat riwayat…</p>;
  if (q.isError) return <p className="text-xs text-destructive">{(q.error as Error).message}</p>;
  const rows = q.data ?? [];
  if (!rows.length) return <p className="text-xs text-muted-foreground">Belum ada riwayat status.</p>;
  return (
    <ol className="space-y-1 text-xs">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-x-2 rounded bg-muted/40 p-2">
          <span className="text-muted-foreground">{fmt(r.changed_at)}</span>
          <span>
            {r.from_status ? `${STATUS_ID[r.from_status] ?? r.from_status} → ` : ""}
            <strong>{STATUS_ID[r.to_status] ?? r.to_status}</strong>
          </span>
          {r.is_backfill ? (
            <span className="text-[0.65rem] italic text-muted-foreground">(perkiraan dari data lama)</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
