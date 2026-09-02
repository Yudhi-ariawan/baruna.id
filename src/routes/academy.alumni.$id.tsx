import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ChevronRight,
  CheckCircle2,
  Flag,
  Building2,
  BookOpen,
  Award,
  CalendarDays,
  ArrowRight,
  Target,
  TrendingUp,
  ArrowLeft,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import {
  alumnusById,
  biographyFor,
  relatedAlumni,
  initials,
  ALUMNUS_ACTION_PLAN_PLACEHOLDER,
  ALUMNUS_IMPACT_PLACEHOLDER,
  type Alumnus,
} from "@/data/edition2024";
import { trainingBySlug } from "@/data/training";

const TRAINING_SLUG = "international-training-fisheries-african-countries";

export const Route = createFileRoute("/academy/alumni/$id")({
  loader: ({ params }) => {
    const alumnus = alumnusById[params.id];
    if (!alumnus) throw notFound();
    return { alumnus };
  },
  head: ({ loaderData }) => {
    const a = loaderData?.alumnus;
    if (!a) return {};
    return {
      meta: [
        { title: `${a.name} — Alumni (2024) — BARUNA Academy` },
        { name: "description", content: `${a.name} from ${a.country}, ${a.organization} — alumnus of the 2024 International Training on Fisheries for African Countries.` },
        { property: "og:title", content: `${a.name} — Alumni (2024)` },
        { property: "og:description", content: `${a.country} · ${a.organization}` },
        { property: "og:url", content: `/academy/alumni/${a.id}` },
      ],
      links: [{ rel: "canonical", href: `/academy/alumni/${a.id}` }],
    };
  },
  notFoundComponent: () => (
    <AcademyShell active="training">
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">Alumnus not found</h1>
        <Link to="/academy/alumni" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground">
          Back to Alumni <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </AcademyShell>
  ),
  errorComponent: ({ error }) => (
    <AcademyShell active="training">
      <div role="alert" className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </AcademyShell>
  ),
  component: AlumnusProfile,
});

function Avatar({ name, size = "lg" }: { name: string; size?: "lg" | "sm" }) {
  const cls = size === "lg" ? "h-20 w-20 text-xl" : "h-11 w-11 text-sm";
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-marine to-ocean font-bold text-marine-foreground ${cls}`}>
      {initials(name)}
    </span>
  );
}

function AlumnusProfile() {
  const { alumnus: a } = Route.useLoaderData() as { alumnus: Alumnus };
  const modules = trainingBySlug[TRAINING_SLUG]?.curriculum ?? [];
  const related = relatedAlumni(a, 3);

  const facts = [
    { icon: Flag, label: "Country", value: a.country },
    { icon: Building2, label: "Organization", value: a.organization },
    { icon: BookOpen, label: "Department", value: a.department },
    { icon: CalendarDays, label: "Training Year", value: "2024" },
    { icon: CheckCircle2, label: "Completed Modules", value: `${modules.length} of ${modules.length}` },
    { icon: Award, label: "Certificate Status", value: "Issued" },
  ];

  return (
    <AcademyShell
      active="training"
      aside={
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h3 className="font-display text-base font-bold text-navy">Related Alumni</h3>
          <ul className="mt-3 space-y-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  to="/academy/alumni/$id"
                  params={{ id: r.id }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-2.5 transition-colors hover:border-marine/40"
                >
                  <Avatar name={r.name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-navy">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.country}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/academy/alumni" className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-marine hover:text-navy">
            View all alumni <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy/edition-2024" className="font-medium text-foreground/70 hover:text-marine">2024 Edition</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/academy/alumni" className="font-medium text-foreground/70 hover:text-marine">Alumni</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy">{a.name}</span>
        </nav>

        {/* Header */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Avatar name={a.name} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold text-navy">{a.name}</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-success">
                  <CheckCircle2 className="h-3 w-3" /> Completed
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Flag className="h-3.5 w-3.5" /> {a.country}</span>
                <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {a.organization}</span>
              </p>
            </div>
          </div>

          {/* Facts */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="flex items-start gap-2.5 rounded-xl border border-border bg-background p-3">
                <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-marine" />
                <div className="min-w-0">
                  <p className="text-[0.7rem] text-muted-foreground">{f.label}</p>
                  <p className="text-sm font-semibold text-navy">{f.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Biography */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-navy">Professional Biography</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{biographyFor(a)}</p>
        </div>

        {/* Completed Modules */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-navy">Completed Modules</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {modules.map((m) => (
              <div key={m.no} className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                <span className="text-xs font-medium text-navy">{m.no}. {m.module}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Plan + Current Impact (placeholders) */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-dashed border-marine/40 bg-marine/5 p-5">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-marine" />
              <h2 className="font-display text-base font-bold text-navy">Action Plan</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ALUMNUS_ACTION_PLAN_PLACEHOLDER}</p>
            <span className="mt-3 inline-block rounded-full bg-muted px-2.5 py-1 text-[0.65rem] font-bold uppercase text-muted-foreground">Placeholder</span>
          </div>
          <div className="rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              <h2 className="font-display text-base font-bold text-navy">Current Impact</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ALUMNUS_IMPACT_PLACEHOLDER}</p>
            <span className="mt-3 inline-block rounded-full bg-muted px-2.5 py-1 text-[0.65rem] font-bold uppercase text-muted-foreground">Placeholder</span>
          </div>
        </div>

        <Link to="/academy/alumni" className="inline-flex items-center gap-1.5 text-sm font-semibold text-marine hover:text-navy">
          <ArrowLeft className="h-4 w-4" /> Back to Alumni Directory
        </Link>
      </div>
    </AcademyShell>
  );
}
