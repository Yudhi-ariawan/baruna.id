// "Output Kurikulum" tab on the temporary /kesiapanrilis page: every document in
// dokumen/output/bulan-N/ grouped per month, one shown at a time.
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { MONTH_TITLES, type CurriculumDoc } from "@/lib/release/curriculum-outputs";
import { ReleaseMarkdown } from "./ReleaseMarkdown";

export function CurriculumOutputsView({ docs }: { docs: CurriculumDoc[] }) {
  const [current, setCurrent] = useState(0);
  const months = useMemo(() => [...new Set(docs.map((d) => d.month))], [docs]);

  if (docs.length === 0) {
    return <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Belum ada dokumen di dokumen/output/.</p>;
  }
  const doc = docs[Math.min(current, docs.length - 1)];
  const go = (i: number) => {
    setCurrent(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
      {/* Phone/tablet: dropdown */}
      <label className="block lg:hidden">
        <span className="mb-1 block text-xs font-semibold text-navy">Pilih dokumen</span>
        <select value={current} onChange={(e) => go(Number(e.target.value))}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {months.map((m) => (
            <optgroup key={m} label={MONTH_TITLES[m] ?? `Bulan ${m}`}>
              {docs.map((d, i) => (d.month === m ? <option key={d.slug} value={i}>{i + 1}. {d.title}</option> : null))}
            </optgroup>
          ))}
        </select>
      </label>

      {/* Desktop: side list */}
      <nav className="hidden self-start rounded-2xl border border-border bg-card p-3 lg:sticky lg:top-4 lg:block">
        {months.map((m) => (
          <div key={m} className="mb-3 last:mb-0">
            <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {MONTH_TITLES[m] ?? `Bulan ${m}`}
            </p>
            <ul className="space-y-0.5">
              {docs.map((d, i) =>
                d.month === m ? (
                  <li key={d.slug}>
                    <button type="button" onClick={() => go(i)} aria-current={i === current ? "page" : undefined}
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${i === current ? "bg-marine text-white" : "text-navy hover:bg-muted"}`}>
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{d.title}</span>
                    </button>
                  </li>
                ) : null,
              )}
            </ul>
          </div>
        ))}
      </nav>

      <div className="min-w-0">
        <article className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-8">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {MONTH_TITLES[doc.month] ?? `Bulan ${doc.month}`} · {current + 1} dari {docs.length} · {doc.slug}.md
          </p>
          <ReleaseMarkdown key={doc.slug}>{doc.markdown}</ReleaseMarkdown>
        </article>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" disabled={current === 0} onClick={() => go(current - 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-navy disabled:opacity-40">
            <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
          </button>
          <button type="button" disabled={current >= docs.length - 1} onClick={() => go(current + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-navy disabled:opacity-40">
            Berikutnya <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
