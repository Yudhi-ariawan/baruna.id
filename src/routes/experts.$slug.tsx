import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Globe2,
  Languages,
  MapPin,
} from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import defaultExpertAvatar from "@/assets/avatar-presets/marine-researcher.webp";
import { getPublicExpertBySlug } from "@/lib/experts/directory.functions";
import {
  TRAINER_LEVEL_LABEL,
  VERIFICATION_LABEL,
  type PublicExpert,
} from "@/lib/experts/directory.types";

export const Route = createFileRoute("/experts/$slug")({
  loader: async ({ params }) => {
    const expert = await getPublicExpertBySlug({ data: { slug: params.slug } });
    if (!expert) throw notFound();
    return { expert };
  },
  head: ({ loaderData }) => {
    const expert = loaderData?.expert;
    if (!expert) return {};
    const url = `/experts/${expert.slug}`;
    return {
      meta: [
        { title: `${expert.displayName} — BARUNA Experts` },
        {
          name: "description",
          content: (expert.bio ?? expert.headline ?? "BARUNA Expert").slice(0, 155),
        },
        { property: "og:title", content: `${expert.displayName} — BARUNA Experts` },
        {
          property: "og:description",
          content: (expert.bio ?? expert.headline ?? "BARUNA Expert").slice(0, 155),
        },
        { property: "og:image", content: expert.avatarUrl ?? defaultExpertAvatar },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: ExpertNotFound,
  component: ExpertProfile,
});

function ExpertNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-navy">Expert not found</h1>
        <Link
          to="/experts/directory"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground"
        >
          Back to Experts Directory <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function ExpertProfile() {
  const { expert } = Route.useLoaderData() as { expert: PublicExpert };
  const trainerLevel = expert.trainerLevel ? TRAINER_LEVEL_LABEL[expert.trainerLevel] : null;
  const location = [expert.city, expert.country].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6">
        <nav
          className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
          aria-label="Breadcrumb"
        >
          <Link
            to="/experts/directory"
            className="font-medium text-foreground/70 hover:text-marine"
          >
            Experts
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy">{expert.displayName}</span>
        </nav>
        <Link
          to="/experts/directory"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-marine hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Experts Directory
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              <div className="aspect-[3/4] w-full overflow-hidden bg-secondary/40">
                <img
                  src={expert.avatarUrl ?? defaultExpertAvatar}
                  alt={`Portrait of ${expert.displayName}`}
                  width={600}
                  height={800}
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-marine/10 px-2.5 py-1 text-[0.65rem] font-bold text-marine">
                    <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                    {VERIFICATION_LABEL[expert.verificationStatus]}
                  </span>
                  {expert.trainerStatus === "active" && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[0.65rem] font-bold text-amber-800">
                      BARUNA Trainer
                    </span>
                  )}
                </div>
                <h1 className="mt-3 font-display text-xl font-extrabold leading-tight text-navy">
                  {expert.displayName}
                </h1>
                <p className="mt-1 text-sm font-semibold text-marine">{expert.headline}</p>
                {expert.institution && (
                  <p className="mt-3 flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
                    <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {expert.institutionRole && `${expert.institutionRole} · `}
                      {expert.institution}
                    </span>
                  </p>
                )}
                {location && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {location}
                  </p>
                )}
                <Link
                  to="/experts/request"
                  search={{ type: expert.trainerStatus === "active" ? "trainer" : "technical", expert: expert.slug }}
                  className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-marine py-2 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                >
                  Request This Expert <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-marine/20 bg-marine/5 p-5">
              <p className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-marine">
                <Clock3 className="h-4 w-4" /> Public Availability
              </p>
              <p className="mt-1.5 text-sm font-semibold capitalize text-navy">
                {expert.availabilityStatus ?? "Contact BARUNA"}
              </p>
              {expert.availableModes.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {expert.availableModes.join(" · ")}
                </p>
              )}
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
                <BookOpen className="h-5 w-5 text-marine" /> Biography
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{expert.bio}</p>
            </section>
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold text-navy">Areas of Expertise</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {expert.expertiseAreas.map((area) => (
                  <span
                    key={area}
                    className="inline-flex rounded-full border border-marine/20 bg-marine/5 px-3 py-1.5 text-xs font-semibold text-marine"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </section>
            <section className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
                  <Languages className="h-5 w-5 text-marine" /> Languages
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  {expert.languages.length > 0 ? expert.languages.join(", ") : "Not specified"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
                  <Globe2 className="h-5 w-5 text-marine" /> Professional Affiliation
                </h2>
                <p className="mt-3 text-sm font-semibold text-navy">
                  {expert.institution ?? "Independent Expert"}
                </p>
                {expert.institutionRole && (
                  <p className="mt-1 text-xs text-muted-foreground">{expert.institutionRole}</p>
                )}
              </div>
            </section>
            {expert.trainerStatus === "active" && (
              <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
                  <Award className="h-5 w-5 text-marine" /> BARUNA Trainer Recognition
                </h2>
                <div className="mt-3 rounded-xl border border-border bg-secondary/30 p-4">
                  <p className="text-sm font-bold text-navy">
                    {trainerLevel ?? "Qualified Trainer"}
                  </p>
                  {expert.recognitionMinParticipants !== null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Recognition threshold: {expert.recognitionMinParticipants.toLocaleString()}{" "}
                      unique graduated participants
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
