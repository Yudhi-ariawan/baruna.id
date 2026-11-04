import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Library } from "lucide-react";
import { getProgramOverview } from "@/lib/academy/programs.functions";
import {
  CourseList,
  DraftList,
  NewProgramButtons,
  OfferingList,
} from "@/components/governance/programs/ProgramLists";
import { PROGRAMS_QUERY_KEY } from "@/components/governance/programs/programLabels";

// PB-ACA-01/02 (Slide 20-21): Master Course, Master Module and Course Offering are
// prepared as drafts and become live only after a different approver approves.
export const Route = createFileRoute("/governance/programs/")({
  head: () => ({ meta: [{ title: "Program Academy — Konsol Kurasi BARUNA" }] }),
  component: ProgramsPage,
});

const TABS = [
  { key: "drafts", label: "Draf & persetujuan" },
  { key: "courses", label: "Master Course" },
  { key: "offerings", label: "Course Offering" },
] as const;

function ProgramsPage() {
  const fn = useServerFn(getProgramOverview);
  const q = useQuery({ queryKey: PROGRAMS_QUERY_KEY, queryFn: () => fn(), staleTime: 30_000 });
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("drafts");
  const waiting = q.data?.drafts.filter((d) => d.status === "submitted").length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-navy">
            <Library className="h-6 w-6 text-marine" /> Program Academy
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Master Course adalah rancangan program beserta modulnya; Course Offering adalah penyelenggaraannya (jadwal, delivery mode,
            aturan pendaftaran, biaya). Setiap perubahan dibuat sebagai draf dan baru tayang setelah disetujui Approver/Admin lain.
          </p>
        </div>
        <NewProgramButtons />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.key ? "border-marine text-navy" : "border-transparent text-muted-foreground hover:text-navy"}`}>
            {t.label}
            {t.key === "drafts" && waiting ? <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[11px] text-amber-800">{waiting}</span> : null}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : q.data ? (
        tab === "drafts" ? <DraftList drafts={q.data.drafts} /> : tab === "courses" ? <CourseList data={q.data} /> : <OfferingList data={q.data} />
      ) : null}

      <p className="text-xs text-muted-foreground">
        Offering yang disetujui bisa dibuka di alamatnya sendiri (tombol Buka). Katalog publik <em>All Programs</em> belum membaca
        data ini; masih berisi data contoh.
      </p>
    </div>
  );
}
