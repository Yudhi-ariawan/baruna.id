import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, AlertTriangle, CheckCircle2, LineChart, RefreshCw, Search } from "lucide-react";
import {
  FOLLOW_UP_RULES,
  listLearningProgress,
  type LearnerFlag,
  type LearnerProgressRow,
} from "@/lib/admin/learning-progress.functions";

export const Route = createFileRoute("/governance/learning-progress")({
  head: () => ({
    meta: [
      { title: "Pemantauan Progres Peserta — BARUNA" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LearningProgressPage,
});

const FLAG_LABEL: Record<LearnerFlag, string> = {
  not_started: `Belum mulai > ${FOLLOW_UP_RULES.notStartedDays} hari`,
  inactive: `Tidak aktif > ${FOLLOW_UP_RULES.inactiveDays} hari`,
  repeated_failure: `Kuis ${FOLLOW_UP_RULES.failedAttempts}x belum lulus`,
  awaiting_official_quiz: "Kuis resmi belum ada",
};

const FILTERS = [
  { id: "all", label: "Semua" },
  { id: "in_progress", label: "Belum lulus" },
  { id: "passed", label: "Lulus" },
  { id: "attention", label: "Perlu tindak lanjut" },
] as const;

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-");

function LearningProgressPage() {
  const [courseId, setCourseId] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const listFn = useServerFn(listLearningProgress);
  const query = useQuery({
    queryKey: ["governance", "learning-progress", courseId, filter, search, page],
    queryFn: () => listFn({ data: { courseId, filter, search, page, pageSize: 50 } }),
    staleTime: 30_000,
  });
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-navy">
            <LineChart className="h-6 w-6 text-marine" /> Pemantauan Progres Peserta
          </h1>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            PB-ACA-04: pantau progres peserta yang pendaftarannya disetujui dan tindak lanjuti yang bermasalah. Kelulusan hanya dari kuis resmi
            yang dinilai server; langkah video/PDF/presentasi ditandai peserta sendiri.
          </p>
        </div>
        <button onClick={() => query.refetch()} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-navy hover:bg-muted">
          <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} /> Muat ulang
        </button>
      </header>

      {query.isError && (
        <p className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {query.error instanceof Error ? query.error.message : "Data gagal dimuat."}
        </p>
      )}

      {data && (
        <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-muted/40 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Kursus / Modul</th>
                <th className="px-3 py-3 text-right">Menunggu</th>
                <th className="px-3 py-3 text-right">Disetujui</th>
                <th className="px-3 py-3 text-right">Mulai</th>
                <th className="px-3 py-3 text-right">Lulus</th>
                <th className="px-3 py-3 text-right">Rata-rata nilai terbaik</th>
                <th className="px-3 py-3 text-right">Perlu tindak lanjut</th>
              </tr>
            </thead>
            <tbody>
              {data.courses.map((c) => (
                <tr key={c.courseId} className={`cursor-pointer border-t border-border hover:bg-muted/30 ${courseId === c.courseId ? "bg-marine/5" : ""}`}
                  onClick={() => { setCourseId(courseId === c.courseId ? "" : c.courseId); setPage(1); }}>
                  <td className="px-4 py-2.5 font-semibold text-navy">
                    {c.courseTitle}
                    {c.hasOfficialQuiz === false && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-bold text-amber-800">kuis resmi belum ada</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">{c.pending}</td>
                  <td className="px-3 py-2.5 text-right">{c.approved}</td>
                  <td className="px-3 py-2.5 text-right">{c.started}</td>
                  <td className="px-3 py-2.5 text-right">{c.passed}{c.approved ? ` (${Math.round((c.passed / c.approved) * 100)}%)` : ""}</td>
                  <td className="px-3 py-2.5 text-right">{c.averageBestScore === null ? "-" : `${c.averageBestScore}%`}</td>
                  <td className="px-3 py-2.5 text-right">{c.needsAttention}</td>
                </tr>
              ))}
              {data.courses.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Belum ada pendaftaran kursus.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => { setFilter(f.id); setPage(1); }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === f.id ? "bg-navy text-white" : "border border-border bg-card text-navy hover:bg-muted"}`}>
            {f.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Cari nama, email, instansi, kursus"
            className="w-56 bg-transparent text-xs outline-none" maxLength={120} />
        </label>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="bg-muted/40 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Peserta</th>
              <th className="px-3 py-3">Kursus</th>
              <th className="px-3 py-3">Progres</th>
              <th className="px-3 py-3">Kuis</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Aktivitas terakhir</th>
              <th className="px-3 py-3">Tindak lanjut</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Memuat…</td></tr>}
            {data?.rows.map((r) => <LearnerRow key={`${r.userId}-${r.courseId}`} row={r} />)}
            {data && data.rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Tidak ada peserta yang sesuai filter.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {data && data.total > 50 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40">Sebelumnya</button>
          <span>Halaman {page} dari {pages} ({data.total} peserta)</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40">Berikutnya</button>
        </div>
      )}
    </div>
  );
}

function LearnerRow({ row: r }: { row: LearnerProgressRow }) {
  return (
    <tr className="border-t border-border align-top">
      <td className="px-4 py-2.5">
        <p className="font-semibold text-navy">{r.name}</p>
        <p className="text-[11px] text-muted-foreground">{r.email}{r.organization ? ` · ${r.organization}` : ""}</p>
      </td>
      <td className="px-3 py-2.5">
        <p className="text-navy">{r.courseTitle}</p>
        <p className="text-[11px] text-muted-foreground">Disetujui {fmtDate(r.approvedAt)}</p>
      </td>
      <td className="px-3 py-2.5">
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full bg-marine" style={{ width: `${r.progress}%` }} /></div>
        <p className="mt-1 text-[11px] text-muted-foreground">{r.progress}% · {["video", "pdf", "ppt"].filter((k) => r.steps[k as keyof typeof r.steps]).join(", ") || "belum ada materi ditandai"}</p>
      </td>
      <td className="px-3 py-2.5">{r.attempts ? `${r.attempts}x · terbaik ${r.bestScore}%` : "-"}</td>
      <td className="px-3 py-2.5">
        {r.passed ? (
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Lulus {fmtDate(r.completedAt)}</span>
        ) : r.started ? "Belajar" : "Belum mulai"}
        {r.legacyCompletion && <p className="text-[10px] text-amber-700">status selesai lama belum terverifikasi</p>}
      </td>
      <td className="px-3 py-2.5">{fmtDate(r.lastActivityAt)}</td>
      <td className="px-3 py-2.5">
        {r.flags.length === 0 ? <span className="text-muted-foreground">-</span> : (
          <ul className="space-y-1">
            {r.flags.map((f) => (
              <li key={f} className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                <AlertTriangle className="h-3 w-3" /> {FLAG_LABEL[f]}
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}
