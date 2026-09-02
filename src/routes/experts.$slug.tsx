import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import {
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Building2,
  Mail,
  Award,
  BookOpen,
  GraduationCap,
  CheckCircle2,
} from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import { instructorBySlug, type Instructor } from "@/data/instructors";
import { trainingBySlug } from "@/data/training";

export const Route = createFileRoute("/experts/$slug")({
  loader: ({ params }) => {
    const instructor = instructorBySlug[params.slug];
    if (!instructor) throw notFound();
    return { instructor };
  },
  head: ({ loaderData }) => {
    const i = loaderData?.instructor;
    if (!i) return {};
    const url = `/experts/${i.slug}`;
    return {
      meta: [
        { title: `${i.name} — ${i.position} — BARUNA Experts` },
        { name: "description", content: i.summary.slice(0, 155) },
        { property: "og:title", content: `${i.name} — BARUNA Experts` },
        { property: "og:description", content: i.summary.slice(0, 155) },
        { property: "og:image", content: i.photo },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-navy">Instructor not found</h1>
        <Link
          to="/experts"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground"
        >
          Back to Experts Directory <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div role="alert" className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-navy">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  component: InstructorProfile,
});

function InstructorProfile() {
  const { instructor: i } = Route.useLoaderData() as { instructor: Instructor };
  const programs = i.programs
    .map((slug) => trainingBySlug[slug])
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/experts" className="font-medium text-foreground/70 hover:text-marine">Experts</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy">{i.name}</span>
        </nav>

        <Link
          to="/experts"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-marine hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Experts Directory
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Profile card */}
          <aside className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              <div className="aspect-[3/4] w-full overflow-hidden bg-secondary/40">
                <img
                  src={i.photo}
                  alt={`Portrait of ${i.name}`}
                  width={600}
                  height={800}
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <div className="p-5">
                <h1 className="font-display text-xl font-extrabold leading-tight text-navy">{i.name}</h1>
                <p className="mt-1 text-sm font-semibold text-marine">{i.position}</p>
                <p className="mt-2 flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
                  <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {i.organization}
                </p>
                {i.email && (
                  <a
                    href={`mailto:${i.email}`}
                    className="mt-3 flex items-center gap-2 rounded-lg border border-marine py-2 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                  >
                    <Mail className="h-4 w-4" /> Contact
                  </a>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-marine/20 bg-marine/5 p-5">
              <p className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-marine">
                <Award className="h-4 w-4" /> Program Section
              </p>
              <p className="mt-1.5 text-sm font-semibold text-navy">{i.group}</p>
            </div>
          </aside>

          {/* Detail */}
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
                <BookOpen className="h-5 w-5 text-marine" /> Biography
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{i.biography}</p>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold text-navy">Areas of Expertise</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {i.expertise.map((x) => (
                  <span
                    key={x}
                    className="inline-flex rounded-full border border-marine/20 bg-marine/5 px-3 py-1.5 text-xs font-semibold text-marine"
                  >
                    {x}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
                <GraduationCap className="h-5 w-5 text-marine" /> Role in This Program
              </h2>
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-border bg-secondary/30 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-marine" />
                <p className="text-sm font-semibold text-navy">{i.programRole}</p>
              </div>
            </section>

            {programs.length > 0 && (
              <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <h2 className="font-display text-lg font-bold text-navy">Program Assignments</h2>
                <div className="mt-3 space-y-3">
                  {programs.map((p) => (
                    <Link
                      key={p.slug}
                      to="/academy/training/$slug"
                      params={{ slug: p.slug }}
                      className="flex items-center gap-4 rounded-xl border border-border bg-secondary/30 p-4 transition-colors hover:border-marine/40"
                    >
                      <img
                        src={p.hero}
                        alt={p.title}
                        loading="lazy"
                        width={120}
                        height={80}
                        className="h-16 w-24 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-navy">{p.title}</p>
                        <p className="mt-0.5 text-xs text-marine">{p.type} · {p.location}</p>
                      </div>
                      <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-marine" />
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
