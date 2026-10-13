import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Globe2,
  GraduationCap,
  Languages,
  MapPin,
  ScrollText,
} from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import defaultExpertAvatar from "@/assets/avatar-presets/marine-researcher.webp";
import { getPublicExpertBySlug } from "@/lib/experts/directory.functions";
import { getPublishedModulesCatalog } from "@/lib/learning/learning.functions";
import { getKnowledgeHubOverview } from "@/lib/knowledge-hub/knowledge-hub.functions";
import {
  TRAINER_LEVEL_LABEL,
  VERIFICATION_LABEL,
  type PublicExpert,
} from "@/lib/experts/directory.types";

export const Route = createFileRoute("/experts/$slug")({
  loader: async ({ params }) => {
    const expert = await getPublicExpertBySlug({ data: { slug: params.slug } }).catch(() => null);
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

  const getModulesCatalogFn = useServerFn(getPublishedModulesCatalog);
  const getKhOverviewFn = useServerFn(getKnowledgeHubOverview);

  const { data: publishedModules } = useQuery({
    queryKey: ["expert-profile", "modules", expert.id],
    queryFn: () => getModulesCatalogFn(),
    staleTime: 30_000,
  });

  const { data: khOverview } = useQuery({
    queryKey: ["expert-profile", "kh", expert.id],
    queryFn: () => getKhOverviewFn(),
    staleTime: 30_000,
  });

  const expertContributions = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      kind: string;
      summary: string;
      href: string;
      isModule: boolean;
    }> = [];
    const seenTitles = new Set<string>();
    const normExpertName = (expert.displayName ?? "").trim().toLowerCase();

    for (const mod of publishedModules ?? []) {
      const matchesExpert =
        mod.author_expert_id === expert.id ||
        (mod.authorSlug && mod.authorSlug === expert.slug) ||
        (normExpertName && mod.authorName.trim().toLowerCase() === normExpertName);
      if (!matchesExpert) continue;
      seenTitles.add(mod.title.trim().toLowerCase());
      items.push({
        id: `mod-${mod.id}`,
        title: mod.title,
        kind: `Self-Paced Module · ${mod.estimated_learning_hours || 2}h`,
        summary: mod.summary || "Approved self-paced module in BARUNA Academy.",
        href: `/academy/self-paced/${mod.id}`,
        isModule: true,
      });
    }

    for (const res of khOverview?.resources ?? []) {
      const normTitle = res.title.trim().toLowerCase();
      if (res.type === "learning-modules" && seenTitles.has(normTitle)) continue;
      const matchesExpert =
        res.expertId === expert.id ||
        (res.relatedExpert?.slug && res.relatedExpert.slug === expert.slug) ||
        (normExpertName &&
          (res.author?.trim().toLowerCase() === normExpertName ||
            res.contributor?.trim().toLowerCase() === normExpertName));
      if (!matchesExpert) continue;
      items.push({
        id: `kh-${res.id}`,
        title: res.title,
        kind: `${res.typeLabel} · ${res.year}`,
        summary: res.summary || res.abstract || "Published Knowledge Hub resource.",
        href:
          res.type === "learning-modules" && res.moduleCode
            ? `/academy/self-paced/${res.moduleCode}`
            : `/knowledge-hub/resource/${res.id}`,
        isModule: res.type === "learning-modules",
      });
    }

    return items;
  }, [publishedModules, khOverview, expert.id, expert.slug, expert.displayName]);

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
                  onError={(e) => {
                    if (e.currentTarget.src !== defaultExpertAvatar) {
                      e.currentTarget.src = defaultExpertAvatar;
                    }
                  }}
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
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {expert.bio || "Verified expert and contributor in the BARUNA Marine & Fisheries Network."}
              </p>
            </section>
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold text-navy">Areas of Expertise</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {expert.expertiseAreas.length > 0 ? (
                  expert.expertiseAreas.map((area) => (
                    <span
                      key={area}
                      className="inline-flex rounded-full border border-marine/20 bg-marine/5 px-3 py-1.5 text-xs font-semibold text-marine"
                    >
                      {area}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Marine & Fisheries Capacity Building</span>
                )}
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

            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
                  <ScrollText className="h-5 w-5 text-marine" /> Published Contributions &amp; Learning Modules
                </h2>
                <span className="rounded-full bg-marine/10 px-2.5 py-0.5 text-xs font-bold text-marine">
                  {expertContributions.length} {expertContributions.length === 1 ? "item" : "items"}
                </span>
              </div>
              {expertContributions.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {expertContributions.map((item) => (
                    <a
                      key={item.id}
                      href={item.href}
                      className="group flex flex-col justify-between rounded-xl border border-border bg-secondary/15 p-4 transition-all hover:border-marine/40 hover:bg-secondary/30"
                    >
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-marine/10 px-2 py-0.5 text-[0.65rem] font-bold text-marine">
                          {item.isModule ? (
                            <GraduationCap className="h-3 w-3" />
                          ) : (
                            <BookOpen className="h-3 w-3" />
                          )}
                          {item.kind}
                        </span>
                        <h3 className="mt-2 font-display text-sm font-bold text-navy group-hover:text-marine">
                          {item.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {item.summary}
                        </p>
                      </div>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-marine">
                        {item.isModule ? "Open Module" : "Open Resource"}{" "}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No public modules or Knowledge Hub publications linked yet.
                </p>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
