import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, Info, UserCheck } from "lucide-react";
import { listReviewSubjects } from "@/lib/governance/governance-ops.functions";
import { listMyReviewQueue } from "@/lib/governance/governance.functions";
import { listTrainingNeedStages } from "@/lib/governance/workflow-sla.functions";
import { useConsoleAccess } from "@/components/baruna/console/useConsoleAccess";
import { StageSlaLine } from "@/components/governance/WorkflowStatus";

// Request a Training (Slide 12): the only submission kind that still uses the
// generic review flow — admin/approver assign a reviewer, the reviewer gives a
// recommendation, admin/approver decide. Expert, module and Knowledge Hub
// submissions have their own verification menus.
export const Route = createFileRoute("/governance/training-needs")({
  head: () => ({ meta: [{ title: "Permintaan Pelatihan — Konsol Kurasi BARUNA" }] }),
  component: TrainingNeedsPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu penugasan",
  under_review: "Sedang ditinjau",
  decision_pending: "Menunggu keputusan",
  approved: "Disetujui",
  rejected: "Ditolak",
  withdrawn: "Ditarik",
  archived: "Diarsipkan",
};

function TrainingNeedsPage() {
  const access = useConsoleAccess();
  const canDecide = Boolean(access.data?.menus.trainingNeeds.decide);
  const listFn = useServerFn(listReviewSubjects);
  const queueFn = useServerFn(listMyReviewQueue);

  const allQ = useQuery({
    queryKey: ["governance", "training-needs", "all"],
    queryFn: () => listFn({ data: { kind: "training_need" } }),
    enabled: canDecide,
  });
  const mineQ = useQuery({
    queryKey: ["governance", "training-needs", "assigned"],
    queryFn: () => queueFn(),
    enabled: Boolean(access.data?.menus.trainingNeeds.read),
  });
  const assigned = (mineQ.data ?? []).filter((row) => {
    const subject = Array.isArray(row.review_subjects) ? row.review_subjects[0] : row.review_subjects;
    return subject?.kind === "training_need";
  });
  // Stage and SLA per request (RLS: approver/admin see all, a reviewer only theirs).
  const stagesFn = useServerFn(listTrainingNeedStages);
  const stagesQ = useQuery({
    queryKey: ["governance", "training-needs", "stages"],
    queryFn: () => stagesFn(),
    enabled: Boolean(access.data?.menus.trainingNeeds.read),
    staleTime: 30_000,
  });
  const stages = stagesQ.data ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Permintaan Pelatihan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kebutuhan pelatihan dari individu, instansi, atau mitra (Request a Training). Reviewer memberi rekomendasi;
          keputusan akhir oleh Approver atau Administrator.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Langkah lanjutan pada panduan (analisis TNA, rekomendasi program, konversi/penjadwalan ke program pelatihan)
          belum tersedia di aplikasi dan menunggu arahan.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-navy">
          <UserCheck className="h-4 w-4 text-marine" /> Ditugaskan kepada saya
        </h2>
        {mineQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : mineQ.isError ? (
          <p className="text-sm text-destructive">{(mineQ.error as Error).message}</p>
        ) : assigned.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground">
            Tidak ada permintaan pelatihan yang ditugaskan kepada Anda.
          </p>
        ) : (
          <ul className="space-y-2">
            {assigned.map((row) => {
              const subject = Array.isArray(row.review_subjects) ? row.review_subjects[0] : row.review_subjects;
              return (
                <li key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy">{subject?.title ?? "(tanpa judul)"}</p>
                    <p className="text-xs text-muted-foreground">
                      {stages[row.subject_id] ? (
                        <StageSlaLine stage={stages[row.subject_id]} />
                      ) : (
                        (STATUS_LABEL[subject?.current_status ?? ""] ?? subject?.current_status)
                      )}
                      {row.due_at ? ` · batas review ${new Date(row.due_at).toLocaleString("id-ID")}` : ""}
                      {row.conflict_of_interest_declared ? " · konflik kepentingan dinyatakan" : ""}
                    </p>
                  </div>
                  <Link
                    to="/governance/subject/$id"
                    params={{ id: row.subject_id }}
                    className="shrink-0 rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy"
                  >
                    Beri Rekomendasi
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canDecide ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-navy">
            <ClipboardList className="h-4 w-4 text-marine" /> Semua permintaan pelatihan
          </h2>
          {allQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : allQ.isError ? (
            <p className="text-sm text-destructive">{(allQ.error as Error).message}</p>
          ) : (allQ.data ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground">
              Belum ada permintaan pelatihan yang diajukan.
            </p>
          ) : (
            <ul className="space-y-2">
              {(allQ.data ?? []).map((subject) => (
                <li key={subject.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy">{subject.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {stages[subject.id] ? (
                        <StageSlaLine stage={stages[subject.id]} />
                      ) : (
                        <>
                          {STATUS_LABEL[subject.current_status] ?? subject.current_status} · diperbarui{" "}
                          {new Date(subject.updated_at).toLocaleString("id-ID")}
                        </>
                      )}
                    </p>
                  </div>
                  <Link
                    to="/governance/subjects/$id"
                    params={{ id: subject.id }}
                    className="shrink-0 rounded-lg border border-marine px-3 py-1.5 text-xs font-semibold text-marine hover:bg-marine hover:text-white"
                  >
                    Tugaskan / Putuskan
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
