import { createFileRoute, Link } from "@tanstack/react-router";
import {
  GraduationCap,
  BookOpen,
  Users,
  Building2,
  Globe,
  ArrowRight,
  Clock,
  BarChart3,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { Banner } from "@/components/baruna/page/Banner";
import { Panel, SectionHeader, Tag } from "@/components/baruna/page/primitives";
import { StatusBadge, Rating } from "@/components/baruna/academy/ui";
import { academyImages } from "@/data/academy";
import { programs } from "@/data/programs";
import { pathways as learningPathways } from "@/data/pathways";
import { categories as browseCategories, accentFor } from "@/data/categories";

import { getPublishedModulesCatalog } from "@/lib/learning/learning.functions";
import defaultCover from "@/assets/self-paced/m01.jpg";
import { useLanguage } from "@/lib/i18n";
import { shortCourseProgress, useShortCourses } from "@/lib/shortCourses";
import { useHomeExperience } from "@/components/baruna/home-experience";

export const Route = createFileRoute("/academy/")({
  loader: async () => {
    try {
      const dbModules = await getPublishedModulesCatalog();
      return { dbModules: dbModules ?? [] };
    } catch (err) {
      console.warn("Could not load published modules:", err);
      return { dbModules: [] };
    }
  },
  head: () => ({
    meta: [
      { title: "Academy — BARUNA" },
      {
        name: "description",
        content:
          "Build your capacity for a sustainable ocean. Explore training, webinars, workshops, certifications, and self-paced courses in marine and fisheries.",
      },
      { property: "og:title", content: "Academy — BARUNA" },
      { property: "og:description", content: "Training, webinars, workshops, certifications, and self-paced courses." },
      { property: "og:image", content: academyImages.seaTurtle },
      { property: "og:url", content: "/academy" },
    ],
    links: [{ rel: "canonical", href: "/academy" }],
  }),
  component: AcademyOverview,
});

type Program = {
  badge: string;
  title: string;
  meta: string;
  level: string;
  rating: number;
  reviews: number;
  mode: string;
  image: string;
  href?: string;
};

const featured: Program[] = [
  { badge: "TRAINING", title: "Sustainable Fisheries Management", meta: "3 Weeks", level: "Intermediate", rating: 4.7, reviews: 98, mode: "In-person", image: academyImages.seaTurtle, href: "/academy/training" },
  { badge: "WEBINAR", title: "Climate Change and Oceans", meta: "24 Jul 2026 · 1.5 Hours", level: "Beginner", rating: 4.6, reviews: 76, mode: "Online", image: academyImages.fishingSunset, href: "/academy/webinar" },
  { badge: "WORKSHOP", title: "Marine Spatial Planning", meta: "6–31 Aug 2026", level: "Advanced", rating: 4.9, reviews: 54, mode: "Blended", image: academyImages.marineSpatial, href: "/academy/workshop" },
  { badge: "CERTIFICATION", title: "Fish Processing and Value Addition", meta: "7–28 Aug 2026", level: "Intermediate", rating: 4.6, reviews: 37, mode: "In-person", image: academyImages.fishProcessing, href: "/academy/certification" },
  { badge: "TRAINING", title: "Blue Economy Fundamentals", meta: "14 Jul – 18 Aug 2026", level: "Beginner", rating: 4.8, reviews: 120, mode: "Online", image: academyImages.offshoreWind, href: "/academy/training" },
  { badge: "WEBINAR", title: "Mangrove Ecosystem Conservation", meta: "30 Jul 2026 · 1.5 Hours", level: "Beginner", rating: 4.5, reviews: 65, mode: "Online", image: academyImages.mangrove, href: "/academy/webinar" },
];

const upcoming = [
  { month: "JUL", day: "20", year: "2026", title: "International Conference on Blue Economy and Ocean Sustainability", location: "Bali, Indonesia", type: "Blended" },
  { month: "AUG", day: "10", year: "2026", title: "Webinar: Innovative Approaches in Marine Conservation", location: "Online", type: "Online" },
  { month: "AUG", day: "25", year: "2026", title: "Regional Workshop on Sustainable Fisheries Management", location: "Jakarta, Indonesia", type: "In-person" },
];

const popularTopics = [
  "Sustainable Fisheries", "Ocean Governance", "Marine Biodiversity", "Climate Adaptation",
  "Blue Economy", "Aquaculture Best Practices", "Marine Spatial Planning", "Community-Based Management",
];

function CircularProgress({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-20 w-20 place-items-center">
      <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-navy-foreground/15" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round"
          className="text-marine-foreground"
          strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <span className="absolute font-display text-lg font-extrabold text-navy-foreground">{value}%</span>
    </div>
  );
}

function ProgramCard({ p }: { p: Program }) {
  const cardBody = (
    <article className="flex w-[260px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-hover">
      <div className="relative h-32 overflow-hidden">
        <img
          src={p.image}
          alt={p.title}
          loading="lazy"
          width={768}
          height={512}
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
          onError={(e) => {
            if (e.currentTarget.src !== defaultCover) {
              e.currentTarget.src = defaultCover;
            }
          }}
        />
        <span className="absolute left-2 top-2">
          <StatusBadge label={p.badge} />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="line-clamp-2 min-h-[2.5rem] font-display text-sm font-bold text-navy">{p.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.meta}</span>
          <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />{p.level}</span>
        </div>
        <div className="mt-auto flex items-center justify-between pt-3">
          <Rating value={p.rating} reviews={p.reviews} />
          <span className="rounded-md bg-secondary px-2 py-0.5 text-[0.65rem] font-semibold text-marine">{p.mode}</span>
        </div>
      </div>
    </article>
  );

  if (p.href) {
    return (
      <Link to={p.href} className="block shrink-0">
        {cardBody}
      </Link>
    );
  }

  return cardBody;
}

function AcademyOverview() {
  const { dbModules } = Route.useLoaderData();
  const { t } = useLanguage();
  const { authState } = useHomeExperience();
  const { enrollments } = useShortCourses();

  const dynamicFeatured: Program[] = (dbModules ?? []).map((m) => ({
    badge: "SELF-PACED",
    title: m.title,
    meta: `${m.estimated_learning_hours || 2} ${t("common.hours")}`,
    level: t("common.intermediate"),
    rating: 5.0,
    reviews: 1,
    mode: t("common.online"),
    image: m.coverUrl || defaultCover,
    href: `/academy/self-paced/${m.id}`,
  }));

  const allFeatured = [...dynamicFeatured, ...featured];
  const totalActivities = enrollments.length * 4;
  const completedActivities = enrollments.reduce(
    (total, enrollment) => total + Math.round(shortCourseProgress(enrollment) / 25),
    0,
  );
  const journeyProgress = totalActivities
    ? Math.round((completedActivities / totalActivities) * 100)
    : 0;
  const isAuthenticated = authState === "authenticated";
  const hasJourney = isAuthenticated && enrollments.length > 0;

  const catalogProgramCount = programs.length + dbModules.length;
  const catalogLearnerCount = programs.reduce(
    (total, program) => total + Math.max(0, program.participants),
    0,
  );
  const instructorCount = new Set([
    ...programs.map((program) => program.instructor.trim()).filter(Boolean),
    ...dbModules.map((module) => module.authorName.trim()).filter(Boolean),
  ]).size;
  const countryCount = new Set(
    programs.map((program) => program.country.trim()).filter(Boolean),
  ).size;

  return (
    <AcademyShell active="overview">
      <div className="space-y-6">
        <Banner
          image={academyImages.seaTurtle}
          alt="Sea turtle swimming over coral reef"
          title={t("academy.bannerTitle")}
          description={t("academy.bannerDesc")}
          stats={[
            { value: String(catalogProgramCount), label: t("footer.programs"), icon: BookOpen },
            { value: catalogLearnerCount.toLocaleString(), label: t("footer.learners"), icon: Users },
            { value: String(instructorCount), label: t("sidebar.instructors"), icon: Building2 },
            { value: String(countryCount), label: t("footer.countries"), icon: Globe },
          ]}
          side={
            <div className="w-full rounded-2xl border border-navy-foreground/15 bg-navy/85 p-5 text-navy-foreground shadow-card backdrop-blur-md sm:w-72">
              <p className="font-display text-base font-bold">{t("sidebar.myJourney")}</p>
              <div className="mt-4 flex items-center gap-4">
                <CircularProgress value={hasJourney ? journeyProgress : 0} />
                <div className="text-xs text-navy-foreground/85">
                  <p className="font-semibold text-navy-foreground">
                    {hasJourney ? "Keep going!" : "Start your learning journey"}
                  </p>
                  <p className="mt-1">
                    {hasJourney
                      ? `You've completed ${completedActivities} of ${totalActivities} learning activities.`
                      : isAuthenticated
                        ? "Explore the catalog and enroll in your first module."
                        : "Sign in to track your enrolled modules and progress."}
                  </p>
                </div>
              </div>
              <Link
                to="/academy/learn"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-navy-foreground/10 py-2.5 text-sm font-semibold transition-colors hover:bg-navy-foreground/20"
              >
                {t("sidebar.myLearning")} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          }
        />

        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-navy sm:text-xl">{t("academy.featuredPrograms")}</h2>
            <Link to="/academy/programs" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-marine transition-colors hover:text-navy">
              {t("sidebar.allPrograms")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-3 flex gap-4 overflow-x-auto pb-2">
            {allFeatured.map((p) => (
              <ProgramCard key={p.title + p.badge} p={p} />
            ))}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <Panel>
            <SectionHeader title={t("sidebar.byCategory")} action={null} />
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {browseCategories.map(({ slug, shortLabel, icon: Icon }) => {
                const accent = accentFor(slug);
                return (
                  <Link
                    key={slug}
                    to="/academy/category/$slug"
                    params={{ slug }}
                    className={`group flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center transition-all duration-300 hover:-translate-y-1 ${accent.ring} data-[status=active]:border-marine data-[status=active]:bg-marine/10`}
                  >
                    <span className={`grid h-9 w-9 place-items-center rounded-full ${accent.chip} ${accent.icon} transition-transform duration-300 group-hover:scale-110`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[0.65rem] font-medium leading-tight text-navy">{shortLabel}</span>
                  </Link>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-navy sm:text-xl">{t("sidebar.learningPathways")}</h2>
              <Link to="/academy/pathways" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-marine transition-colors hover:text-navy">
                {t("common.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <ul className="space-y-2">
              {learningPathways.map((p) => {
                const Icon = p.icon;
                return (
                  <li key={p.slug}>
                    <Link
                      to="/academy/pathways/$slug"
                      params={{ slug: p.slug }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-left transition-all hover:-translate-y-0.5 hover:border-marine/40 hover:bg-muted"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marine/10 text-marine">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-navy">{p.shortLabel}</span>
                        <span className="block truncate text-xs text-muted-foreground">{p.hero}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel>
            <SectionHeader title={t("academy.upcomingSessions")} action={null} />
            <ul className="space-y-3">
              {upcoming.map((e) => (
                <li key={e.title} className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary text-center leading-none">
                    <span className="text-[0.6rem] font-bold uppercase text-marine">{e.month}</span>
                    <span className="text-base font-extrabold text-navy">{e.day}</span>
                    <span className="text-[0.55rem] text-muted-foreground">{e.year}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-navy">{e.title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{e.location}</p>
                  </div>
                  <span className="h-fit shrink-0 rounded-md bg-secondary px-2 py-0.5 text-[0.6rem] font-bold text-marine">{e.type}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <SectionHeader title={t("academy.popularTopics")} action={null} />
            <div className="flex flex-wrap gap-2">
              {popularTopics.map((item) => (
                <Tag key={item}>{item}</Tag>
              ))}
            </div>
          </Panel>
        </div>

        <Link
          to="/academy/programs"
          className="flex items-center justify-between gap-4 rounded-2xl bg-navy p-6 text-navy-foreground shadow-card transition-all hover:-translate-y-0.5 hover:shadow-hover"
        >
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-navy-foreground/10">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display text-lg font-bold">{t("academy.bannerTitle")}</p>
              <p className="text-sm text-navy-foreground/80">{t("academy.bannerDesc")}</p>
            </div>
          </div>
          <span className="hidden shrink-0 items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground sm:flex">
            {t("sidebar.allPrograms")} <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </AcademyShell>
  );
}
