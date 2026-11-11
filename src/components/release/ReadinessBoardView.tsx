// Trello-style board for /kesiapanrilis: four columns built from KESIAPAN_RILIS.md
// (see src/lib/release/readiness-board.ts for which section goes where).
import { useState } from "react";
import { Bug, CheckCircle2, ChevronDown, ChevronUp, CircleDashed, MonitorCheck } from "lucide-react";
import type { BoardCard, BoardColumn, BoardColumnKey, ReadinessBoard } from "@/lib/release/readiness-board";
import { ReleaseMarkdown } from "./ReleaseMarkdown";

const STYLE: Record<BoardColumnKey, { column: string; badge: string; icon: typeof Bug }> = {
  todo: { column: "bg-amber-100 border-amber-200", badge: "bg-amber-200 text-amber-900", icon: CircleDashed },
  done: { column: "bg-emerald-100 border-emerald-200", badge: "bg-emerald-200 text-emerald-900", icon: CheckCircle2 },
  manual: { column: "bg-slate-100 border-slate-200", badge: "bg-slate-200 text-slate-800", icon: MonitorCheck },
  bug: { column: "bg-rose-100 border-rose-200", badge: "bg-rose-200 text-rose-900", icon: Bug },
};

function Card({ card }: { card: BoardCard }) {
  const [open, setOpen] = useState(false);
  const long = card.body.length > 220;
  return (
    <li className="rounded-xl border border-black/5 bg-white p-3 shadow-sm">
      <p className="text-sm font-bold leading-snug text-navy">{card.title}</p>
      {card.meta ? <p className="mt-1 inline-block rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{card.meta}</p> : null}
      {card.body ? (
        <div className={`relative mt-2 text-foreground ${long && !open ? "max-h-28 overflow-hidden" : ""}`}>
          <ReleaseMarkdown>{card.body}</ReleaseMarkdown>
          {long && !open ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white" /> : null}
        </div>
      ) : null}
      {long ? (
        <button type="button" onClick={() => setOpen((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-marine hover:underline">
          {open ? <><ChevronUp className="h-3.5 w-3.5" /> Tutup</> : <><ChevronDown className="h-3.5 w-3.5" /> Lihat detail</>}
        </button>
      ) : null}
    </li>
  );
}

function Column({ column }: { column: BoardColumn }) {
  const s = STYLE[column.key];
  const Icon = s.icon;
  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border p-3 ${s.column}`}>
      <header className="mb-1 flex items-center justify-between gap-2 px-1">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-navy">
          <Icon className="h-4 w-4" /> {column.label}
        </h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.badge}`}>{column.cards.length}</span>
      </header>
      <p className="mb-3 px-1 text-[11px] text-navy/70">{column.hint}</p>
      {column.cards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/10 p-3 text-center text-xs text-navy/60">Belum ada butir.</p>
      ) : (
        <ul className="space-y-2.5">{column.cards.map((c) => <Card key={c.id} card={c} />)}</ul>
      )}
    </section>
  );
}

export function ReadinessBoardView({ board }: { board: ReadinessBoard }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <h1 className="font-display text-xl font-extrabold text-navy sm:text-2xl">{board.title}</h1>
        <div className="mt-3"><ReleaseMarkdown>{board.summary}</ReleaseMarkdown></div>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        {board.columns.map((c) => <Column key={c.key} column={c} />)}
      </div>

      {board.details.length > 0 ? (
        <div className="space-y-3">
          {board.details.map((d) => (
            <details key={d.heading} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <summary className="cursor-pointer font-display text-base font-bold text-navy">{d.heading}</summary>
              <div className="mt-3"><ReleaseMarkdown>{d.markdown}</ReleaseMarkdown></div>
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}
