import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Archive, CheckCircle2, MapPin, CalendarDays, Users, Globe } from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { EDITION_2024 } from "@/data/edition2024";
import trainingBali from "@/assets/academy/training-bali.jpg";

export const Route = createFileRoute("/academy/archive")({
  head: () => ({
    meta: [
      { title: "Training Archive — Completed Programs — BARUNA Academy" },
      {
        name: "description",
        content:
          "Browse completed BARUNA training programs, their alumni, and their outcomes. A living archive of Indonesia's marine and fisheries knowledge exchange.",
      },
      { property: "og:title", content: "Training Archive — BARUNA Academy" },
      {
        property: "og:description",
        content: "Historical record of completed BARUNA training programs.",
      },
    ],
    links: [{ rel: "canonical", href: "/academy/archive" }],
  }),
  component: ArchivePage,
});

const ARCHIVED = [
  {
    year: EDITION_2024.year,
    title: EDITION_2024.title,
    series: EDITION_2024.series,
    location: EDITION_2024.location,
    period: EDITION_2024.trainingPeriod,
    participants: EDITION_2024.participantsCount,
    countries: EDITION_2024.countriesCount,
    modules: EDITION_2024.modulesCount,
    completion: EDITION_2024.completion,
    to: "/academy/edition-2024",
    hero: trainingBali,
  },
];

function ArchivePage() {
  return (
    <AcademyShell active="archive">
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-marine/10 text-marine">
              <Archive className="h-5 w-5" />
            </span>
            <span className="rounded-md bg-success/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-success">
              Completed Programs
            </span>
          </div>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-navy">Training Archive</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A permanent record of BARUNA's completed training programs — their alumni, agendas, outcomes, and
            documentation. Every archived program preserves the same modules, instructors, and materials used
            during delivery.
          </p>
        </div>

        {/* Archive cards */}
        <div className="space-y-4">
          {ARCHIVED.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-colors hover:border-marine/40 sm:flex-row"
            >
              <div className="relative h-40 sm:h-auto sm:w-64">
                <img src={a.hero} alt={a.title} className="h-full w-full object-cover" width={640} height={360} />
                <span className="absolute left-3 top-3 rounded-md bg-navy/90 px-2 py-1 font-display text-xs font-bold text-navy-foreground">
                  {a.year}
                </span>
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-success/90 px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wide text-success-foreground">
                  <CheckCircle2 className="h-3 w-3" /> Completed
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-marine">{a.series}</p>
                <h2 className="mt-1 font-display text-lg font-extrabold text-navy group-hover:text-marine">
                  {a.title}
                </h2>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {a.location}</span>
                  <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {a.period}</span>
                  <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {a.participants} participants</span>
                  <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> {a.countries} countries</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-marine/10 px-2.5 py-1 text-[0.65rem] font-semibold text-marine">
                    {a.modules} Modules
                  </span>
                  <span className="rounded-full bg-success/15 px-2.5 py-1 text-[0.65rem] font-semibold text-success">
                    {a.completion} Completion
                  </span>
                </div>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-marine">
                  View Archive <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            More archived programs will be added as future editions are completed.
          </p>
        </div>
      </div>
    </AcademyShell>
  );
}
