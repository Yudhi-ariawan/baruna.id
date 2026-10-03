import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  Search,
  ArrowRight,
  Globe,
  BookMarked,
  Building2,
  RotateCcw,
  Megaphone,
  ClipboardCheck,
  UserCheck,
  GraduationCap,
  LifeBuoy,
  ChevronDown,
} from "lucide-react";

import { PageShell } from "@/components/baruna/page/PageShell";
import { Banner } from "@/components/baruna/page/Banner";
import { Panel, SectionHeader, Tag } from "@/components/baruna/page/primitives";
import { pageImages } from "@/data/pages";
import { instructorBySlug, type Instructor } from "@/data/instructors";
import { ExpertInstructorCard } from "@/components/baruna/InstructorDirectory";
import defaultExpertAvatar from "@/assets/avatar-presets/marine-researcher.webp";
import {
  getPublicExpertStats,
  listPublicExperts,
} from "@/lib/experts/directory.functions";

import { publicExpertsNav } from "@/data/expertsNav";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/experts/")({
  loader: async () => {
    const [dbExperts, stats] = await Promise.all([
      listPublicExperts().catch(() => []),
      getPublicExpertStats(),
    ]);
    return { dbExperts, stats };
  },
  staleTime: 60_000,
  head: () => ({
    meta: [
      { title: "Experts Directory — BARUNA" },
      {
        name: "description",
        content:
          "Explore our network of marine and fisheries experts, researchers, educators, and practitioners worldwide.",
      },
      { property: "og:title", content: "Experts Directory — BARUNA" },
      { property: "og:description", content: "Connect with leading experts in marine and fisheries." },
      { property: "og:image", content: pageImages.bannerUnderwater },
    ],
    links: [{ rel: "canonical", href: "/experts" }],
  }),
  component: ExpertsPage,
});

function ExpertsPage() {
  const { dbExperts, stats } = Route.useLoaderData();
  const { t } = useLanguage();

  const requests = [
    { label: t("experts.requestBtn"), icon: Megaphone, type: "speaker" as const },
    { label: t("experts.becomeTrainerBtn"), icon: GraduationCap, type: "trainer" as const },
    { label: t("header.expertVerification"), icon: ClipboardCheck, type: "reviewer" as const },
    { label: t("sidebar.mentorshipPrograms"), icon: UserCheck, type: "mentor" as const },
    { label: t("experts.serviceRequestsTitle"), icon: LifeBuoy, type: "technical" as const },
  ];

  const filters = [
    t("experts.filterCategory"),
    t("experts.filterCountry"),
    t("experts.institutionsRepresented"),
    t("header.language"),
  ];

  const combinedInstructors = useMemo(() => {
    const fromDb: Instructor[] = (dbExperts ?? []).map((exp) => ({
      slug: exp.slug,
      name: exp.displayName,
      position:
        exp.institutionRole ||
        (exp.trainerStatus === "active" ? "BARUNA Approved Trainer" : "Verified Marine Expert"),
      organization: exp.institution || "Marine & Fisheries Specialist",
      expertise: exp.expertiseAreas.length ? exp.expertiseAreas : ["Marine & Fisheries"],
      summary:
        exp.headline || exp.bio || "Verified marine & fisheries expert registered on the BARUNA platform.",
      biography: exp.bio || "",
      programRole: exp.trainerStatus === "active" ? "BARUNA Trainer" : "Expert",
      email: instructorBySlug[exp.slug]?.email,
      photo:
        instructorBySlug[exp.slug]?.photo ||
        (exp.avatarUrl && !exp.avatarUrl.toLowerCase().endsWith(".pdf")
          ? exp.avatarUrl
          : defaultExpertAvatar),
      group: instructorBySlug[exp.slug]?.group || "Lead Instructors",
      programs: instructorBySlug[exp.slug]?.programs || [],
    }));

    return fromDb;
  }, [dbExperts]);

  const expertiseAreas = useMemo(
    () =>
      Array.from(
        new Set(dbExperts.flatMap((expert) => expert.expertiseAreas).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [dbExperts],
  );

  const institutions = useMemo(
    () =>
      Array.from(
        new Set(
          dbExperts
            .map((expert) => expert.institution?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [dbExperts],
  );

  return (
    <PageShell
      sidebar={{
        icon: Users,
        title: "BARUNA Experts",
        subtitle: "Connect with marine and fisheries experts, researchers, educators, and practitioners worldwide.",
        sections: publicExpertsNav("/experts"),
        extra: (
          <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{t("common.filter")}</p>
            <div className="space-y-3">
              {filters.map((f) => (
                <div key={f}>
                  <label className="mb-1 block text-xs font-semibold text-navy">{f}</label>
                  <button type="button" className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm text-foreground/80">
                    {f} <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-marine py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground cursor-pointer">
              <RotateCcw className="h-4 w-4" /> {t("common.reset")}
            </button>
          </div>
        ),
      }}
      cta={{
        icon: Users,
        title: "Share Knowledge. Build Capacity. Create Impact.",
        description: "Join our community of experts and help shape a sustainable future for our ocean.",
        button: "Join as an Expert",
        href: "/experts/join",
      }}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">{t("experts.title")}</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {t("experts.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-soft">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder={t("experts.searchPlaceholder")}
              />
            </div>
            <Link
              to="/experts/directory"
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-navy shadow-soft hover:border-marine hover:text-marine"
            >
              {t("sidebar.expertDirectory")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <Banner
          image={pageImages.bannerUnderwater}
          alt="Sea turtle swimming over coral reef"
          title={t("experts.bannerTitle")}
          description={t("experts.bannerDesc")}
          stats={[
            { value: stats.verifiedExperts.toLocaleString(), label: t("welcome.verifiedExperts"), icon: Users },
            { value: stats.countries.toLocaleString(), label: t("footer.countries"), icon: Globe },
            { value: stats.topics.toLocaleString(), label: t("sidebar.topics"), icon: BookMarked },
            { value: stats.institutions.toLocaleString(), label: t("experts.institutionsRepresented"), icon: Building2 },
          ]}
          side={
            <div className="w-full rounded-2xl border border-navy-foreground/15 bg-navy/85 p-5 text-navy-foreground shadow-card backdrop-blur-md sm:w-72">
              <p className="font-display text-base font-bold">{t("experts.serviceRequestsTitle")}</p>
              <p className="mt-1 text-xs text-navy-foreground/80">{t("experts.serviceRequestsDesc")}</p>
              <ul className="mt-4 space-y-1.5">
                {requests.map(({ label, icon: Icon, type }) => (
                  <li key={label}>
                    <Link
                      to="/experts/request"
                      search={{ type }}
                      className="flex w-full items-center gap-2.5 rounded-lg bg-navy-foreground/10 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-navy-foreground/20"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{label}</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          }
        />

        {/* Training & Capacity Development Instructors (shared profiles) */}
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-navy sm:text-xl">
              {t("sidebar.instructors")}
            </h2>
            <Link
              to="/academy/training/$slug"
              params={{ slug: "international-training-fisheries-african-countries" }}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-marine transition-colors hover:text-navy"
            >
              {t("common.view")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {combinedInstructors.map((i) => (
              <ExpertInstructorCard key={i.slug} instructor={i} />
            ))}
          </div>
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Panel>
              <SectionHeader title={t("sidebar.topics")} action={null} />
              <div className="flex flex-wrap gap-2">
                {expertiseAreas.map((x) => (
                  <Tag key={x}>{x}</Tag>
                ))}
              </div>
              <Link to="/experts/directory" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-marine">
                {t("common.viewAll")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Panel>
          </div>
          <div>
            <Panel>
              <SectionHeader title={t("experts.institutionsRepresented")} action={null} />
              <ul className="space-y-3">
                {institutions.map((i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marine/10 text-marine">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-navy">{i}</span>
                  </li>
                ))}
              </ul>
              <Link to="/partnership" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-marine">
                {t("common.viewAll")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Panel>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
