import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  ArrowRight,
  UserRound,
  GraduationCap,
  Target,
  CheckCircle2,
  Award,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { pathways, pathwayBySlug, type Pathway } from "@/data/pathways";

export const Route = createFileRoute("/academy/pathways/$slug")({
  loader: ({ params }) => {
    const pathway = pathwayBySlug[params.slug];
    if (!pathway) throw notFound();
    return { pathway };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.pathway;
    if (!p) return {};
    const url = `/academy/pathways/${p.slug}`;
    return {
      meta: [
        { title: `${p.title} — Academy — BARUNA` },
        { name: "description", content: p.description },
        { property: "og:title", content: `${p.title} — Academy — BARUNA` },
        { property: "og:description", content: p.description },
        { property: "og:image", content: p.illustration },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <AcademyShell active="pathways">
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">Pathway not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The learning pathway you're looking for doesn't exist.
        </p>
        <Link
          to="/academy/pathways"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground"
        >
          Browse pathways <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </AcademyShell>
  ),
  errorComponent: ({ error }) => (
    <AcademyShell active="pathways">
      <div role="alert" className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </AcademyShell>
  ),
  component: PathwayDetail,
});

const toneIcon: Record<string, string> = {
  beginner: "bg-marine/10 text-marine",
  intermediate: "bg-marine/10 text-marine",
  advanced: "bg-navy/10 text-navy",
  certification: "bg-accent/15 text-accent",
};

function ModuleRow({ index, module: m }: { index: number; module: Pathway["modules"][number] }) {
  return (
    <article className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-0 transition-colors hover:bg-muted/50">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-sm font-bold text-navy">
        {index}
      </span>
      <div className="hidden h-14 w-20 shrink-0 overflow-hidden rounded-lg sm:block">
        <img src={m.image} alt={m.title} loading="lazy" width={768} height={512} className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-sm font-bold leading-snug text-navy">{m.title}</h3>
        <p className="mt-0.5 text-xs font-medium text-marine">
          {m.format} <span className="text-muted-foreground">· {m.level}</span>
        </p>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{m.desc}</p>
      </div>
      <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
        <Clock className="h-3.5 w-3.5" /> {m.duration}
      </span>
      <button className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:border-marine hover:text-marine md:flex">
        View Course <ChevronRight className="h-3.5 w-3.5" />
      </button>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
    </article>
  );
}

function AboutItem({ icon: Icon, title, text }: { icon: typeof UserRound; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-marine/10 text-marine">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-navy">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function PathwayDetail() {
  const { pathway: p } = Route.useLoaderData() as { pathway: Pathway };
  const Icon = p.icon;
  const isCert = p.tone === "certification";
  const modulesLabel = isCert ? "Certification Programs in this Pathway" : "Courses in this Pathway";

  return (
    <AcademyShell
      active="pathways"
      activePathway={p.slug}
      aside={
        <>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="font-display text-base font-bold text-navy">About This Pathway</h3>
            <div className="mt-4 space-y-4">
              <AboutItem icon={UserRound} title="Who is it for?" text={p.about.whoFor} />
              <AboutItem icon={GraduationCap} title="What will you learn?" text={p.about.whatLearn} />
              <AboutItem icon={Target} title="What's next?" text={p.about.whatNext} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="font-display text-base font-bold text-navy">Pathway Progress</h3>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your Progress</span>
              <span className="font-bold text-marine">{p.progress.percent}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-marine transition-all"
                style={{ width: `${p.progress.percent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {p.progress.completed} of {p.progress.total} {isCert ? "certification programs" : "courses"} completed
            </p>
            <button className="mt-4 w-full rounded-xl bg-marine py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90">
              {p.progress.cta}
            </button>
          </div>

          <div className="rounded-2xl border border-marine/20 bg-marine/5 p-5">
            <p className="font-display text-sm font-bold text-navy">Need guidance?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Explore recommended programs or talk to our learning advisor.
            </p>
            <button className="mt-4 w-full rounded-xl border border-marine bg-card py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground">
              Contact Advisor
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <p className="font-display text-sm font-bold text-navy">{p.nextStep.label}</p>
            <div className="mt-3 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                <Award className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-navy">{p.nextStep.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.nextStep.desc}</p>
              </div>
            </div>
            {p.nextStep.slug ? (
              <Link
                to="/academy/pathways/$slug"
                params={{ slug: p.nextStep.slug }}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-marine bg-card py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
              >
                {p.nextStep.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button className="mt-4 w-full rounded-xl border border-marine bg-card py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground">
                {p.nextStep.cta}
              </button>
            )}
          </div>
        </>
      }
    >
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/academy/pathways" className="font-medium text-foreground/70 hover:text-marine">
            Learning Pathways
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy">{p.shortLabel}</span>
        </nav>

        {/* Hero header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl ${toneIcon[p.tone]}`}>
            <Icon className="h-8 w-8" />
          </span>
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent">
              {p.badge}
            </span>
            <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight text-navy">{p.title}</h1>
            <p className="mt-1 text-base font-semibold text-marine">{p.hero}</p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{p.description}</p>
          </div>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
          {p.stats.map((s) => {
            const StatIcon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-2.5 bg-card p-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-marine/10 text-marine">
                  <StatIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="font-display text-sm font-extrabold leading-tight text-navy">{s.value}</p>
                  <p className="text-[0.65rem] leading-tight text-muted-foreground">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pathway Overview */}
        <div className="grid items-center gap-5 rounded-2xl border border-border bg-card p-5 shadow-soft lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="font-display text-xl font-bold text-navy">Pathway Overview</h2>
            {p.overview.map((para) => (
              <p key={para} className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {para}
              </p>
            ))}
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-marine">
              Visual tone: <span className="font-medium normal-case text-muted-foreground">{p.visualTone}</span>
            </p>
          </div>
          <div className="overflow-hidden rounded-xl">
            <img
              src={p.illustration}
              alt={p.illustrationAlt}
              loading="lazy"
              width={1024}
              height={640}
              className="h-44 w-full object-cover sm:h-52"
            />
          </div>
        </div>

        {/* Recommended Learning Components */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="font-display text-base font-bold text-navy">
            {isCert ? "Certification Tracks" : "Recommended Learning Components"}
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {(isCert ? p.certificationTracks ?? [] : p.components).map((c) => {
              const CIcon = c.icon;
              return (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:border-marine/40 hover:text-marine"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-marine/10 text-marine">
                    <CIcon className="h-4 w-4" />
                  </span>
                  {c.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Certification Journey (professional only) */}
        {isCert && p.certificationJourney && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="font-display text-base font-bold text-navy">Certification Journey</h2>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {p.certificationJourney.map((step) => {
                const SIcon = step.icon;
                return (
                  <li
                    key={step.step}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/40 p-4 transition-colors hover:border-marine/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-marine/10 text-marine">
                        <SIcon className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-bold text-muted-foreground">Step {step.step}</span>
                    </div>
                    <p className="text-sm font-bold leading-snug text-navy">{step.title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Modules / Courses list */}
        <div className="rounded-2xl border border-border bg-card shadow-soft">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-bold text-navy">
              {modulesLabel} <span className="text-muted-foreground">({p.modules.length})</span>
            </h2>
            <button className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:border-marine/40">
              Expand All <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div>
            {p.modules.map((m, i) => (
              <ModuleRow key={m.title} index={i + 1} module={m} />
            ))}
          </div>
          <div className="border-t border-border p-4 text-center">
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground transition-all hover:-translate-y-0.5 hover:shadow-hover">
              {isCert ? `View All ${p.progress.total} Programs` : `View All ${p.progress.total} Courses`}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sibling pathways navigation */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="font-display text-base font-bold text-navy">Explore Other Pathways</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {pathways.map((other) => {
              const OIcon = other.icon;
              const isActive = other.slug === p.slug;
              return (
                <Link
                  key={other.slug}
                  to="/academy/pathways/$slug"
                  params={{ slug: other.slug }}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 ${
                    isActive
                      ? "border-marine bg-marine/5 ring-1 ring-marine"
                      : "border-border bg-card hover:border-marine/40"
                  }`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${toneIcon[other.tone]}`}>
                    <OIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-navy">{other.shortLabel}</span>
                    <span className="flex items-center gap-1 text-[0.7rem] font-medium text-marine">
                      {isActive ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" /> Current
                        </>
                      ) : (
                        "View pathway"
                      )}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </AcademyShell>
  );
}
