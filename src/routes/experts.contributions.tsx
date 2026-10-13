import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ScrollText,
  BadgeCheck,
  Search,
  BookOpen,
  GraduationCap,
  Users,
  ArrowUpRight,
  Building2,
  Calendar,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { publicExpertsNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { getKnowledgeHubOverview } from "@/lib/knowledge-hub/knowledge-hub.functions";
import { getPublishedModulesCatalog } from "@/lib/learning/learning.functions";
import { listPublicExperts } from "@/lib/experts/directory.functions";

export const Route = createFileRoute("/experts/contributions")({
  head: () => ({
    meta: [
      { title: "Expert Contributions — BARUNA Experts" },
      {
        name: "description",
        content:
          "Verified contributions by BARUNA experts: modules developed, courses delivered, reviews completed, publications, policy briefs, and knowledge resources.",
      },
      { property: "og:title", content: "Expert Contributions — BARUNA Experts" },
      { property: "og:description", content: "Verified professional contributions to BARUNA." },
    ],
    links: [{ rel: "canonical", href: "/experts/contributions" }],
  }),
  component: ContributionsPage,
});

const KINDS = [
  "Modules developed",
  "Self-Paced Courses delivered",
  "Publications contributed",
  "Policy Briefs authored",
  "Case Studies documented",
  "Best Practices shared",
  "Infographics & Visuals",
  "Videos & Webinars delivered",
  "Toolkits developed",
  "Full Training Programs supported",
  "Reviews completed",
  "Curriculum development",
];

type ContributionCategory =
  | "all"
  | "modules"
  | "publications"
  | "policy-case"
  | "practices-toolkits"
  | "media"
  | "governance";

type VerifiedContribution = {
  id: string;
  expertName: string;
  expertSlug?: string | null;
  institution?: string | null;
  kind: string;
  category: ContributionCategory;
  title: string;
  detail: string;
  date: string;
  href?: string;
  isLive: boolean;
};

const HISTORICAL_RECORDS: VerifiedContribution[] = [
  {
    id: "hist-1",
    expertName: "Dr. Sri Astutik",
    institution: "BARUNA Academy",
    kind: "Self-Paced Course delivered",
    category: "modules",
    title: "Tilapia Cultivation Using Biofloc System",
    detail: "Delivered to 142 unique successful participants",
    date: "2025-04-18",
    href: "/academy/self-paced",
    isLive: false,
  },
  {
    id: "hist-2",
    expertName: "Dr. Sinta Mahardika",
    institution: "Academic Review Committee",
    kind: "Academic Review completed",
    category: "governance",
    title: "2026 Africa Cohort Module Quality Review",
    detail: "Reviewed 3 Self-Paced Course modules for the 2026 Africa cohort",
    date: "2025-03-30",
    isLive: false,
  },
  {
    id: "hist-3",
    expertName: "Prof. Dimas Cakrawala",
    institution: "BARUNA Curriculum Board",
    kind: "Full Training Program supported",
    category: "governance",
    title: "International Training on Fisheries for African Countries 2026",
    detail: "Curriculum lead — International Training on Fisheries for African Countries 2026",
    date: "2025-03-05",
    href: "/academy/programs",
    isLive: false,
  },
  {
    id: "hist-4",
    expertName: "Dr. A. Rita Tisiana",
    institution: "BARUNA Quality Assurance",
    kind: "Quality Assurance Review",
    category: "governance",
    title: "BARUNA Standards Compliance Audit",
    detail: "5 modules reviewed against BARUNA pedagogical and technical standards",
    date: "2025-02-14",
    isLive: false,
  },
];

function formatDateLabel(dateStr?: string): string {
  if (!dateStr) return "—";
  const parsed = Date.parse(dateStr);
  if (Number.isNaN(parsed)) return dateStr;
  return new Date(parsed).toISOString().split("T")[0];
}

function mapKhTypeToContribution(
  type: string,
  typeLabel: string,
): { kind: string; category: ContributionCategory } {
  switch (type) {
    case "learning-modules":
      return { kind: "Learning Module developed", category: "modules" };
    case "publications":
      return { kind: "Publication contributed", category: "publications" };
    case "policy-briefs":
      return { kind: "Policy Brief authored", category: "policy-case" };
    case "case-studies":
      return { kind: "Case Study documented", category: "policy-case" };
    case "best-practices":
      return { kind: "Best Practice shared", category: "practices-toolkits" };
    case "toolkits":
      return { kind: "Toolkit developed", category: "practices-toolkits" };
    case "videos":
      return { kind: "Video / Webinar delivered", category: "media" };
    case "infographics":
      return { kind: "Infographic contributed", category: "media" };
    default:
      return { kind: `${typeLabel || "Knowledge Resource"} submitted`, category: "publications" };
  }
}

function ContributionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ContributionCategory>("all");

  const getKhOverviewFn = useServerFn(getKnowledgeHubOverview);
  const getModulesCatalogFn = useServerFn(getPublishedModulesCatalog);
  const listExpertsFn = useServerFn(listPublicExperts);

  const { data: khOverview, isLoading: khLoading } = useQuery({
    queryKey: ["expert-contributions", "knowledge-hub"],
    queryFn: () => getKhOverviewFn(),
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const { data: publishedModules, isLoading: modulesLoading } = useQuery({
    queryKey: ["expert-contributions", "published-modules"],
    queryFn: () => getModulesCatalogFn(),
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const { data: publicExperts } = useQuery({
    queryKey: ["expert-contributions", "public-experts"],
    queryFn: () => listExpertsFn(),
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const isLoading = khLoading || modulesLoading;

  const contributions: VerifiedContribution[] = useMemo(() => {
    const items: VerifiedContribution[] = [];
    const seenModuleTitles = new Set<string>();

    const expertByName = new Map<string, { slug: string; institution: string | null }>();
    for (const exp of publicExperts ?? []) {
      expertByName.set(exp.displayName.trim().toLowerCase(), {
        slug: exp.slug || exp.id,
        institution: exp.institution,
      });
    }

    // 1. Live Published Modules from module_registry
    for (const mod of publishedModules ?? []) {
      const normTitle = mod.title.trim().toLowerCase();
      seenModuleTitles.add(normTitle);
      const matchedExp = expertByName.get(mod.authorName.trim().toLowerCase());
      items.push({
        id: `mod-${mod.id}`,
        expertName: mod.authorName || "BARUNA Trainer",
        expertSlug: mod.authorSlug || matchedExp?.slug || null,
        institution: matchedExp?.institution || "BARUNA Academy",
        kind: "Modules developed",
        category: "modules",
        title: mod.title,
        detail: `${mod.summary ? mod.summary : "Approved self-paced module"} (${mod.estimated_learning_hours || 2} Jam Belajar · ${mod.language})`,
        date: formatDateLabel(mod.created_at),
        href: `/academy/self-paced/${mod.id}`,
        isLive: true,
      });
    }

    // 2. Live Published Knowledge Hub Resources from knowledge_resources
    for (const res of khOverview?.resources ?? []) {
      const normTitle = res.title.trim().toLowerCase();
      if (res.type === "learning-modules" && seenModuleTitles.has(normTitle)) {
        continue;
      }
      const { kind, category } = mapKhTypeToContribution(res.type, res.typeLabel);
      const authorName = res.author || res.contributor || "BARUNA Contributor";
      const matchedExp = expertByName.get(authorName.trim().toLowerCase());
      const slug = res.relatedExpert?.slug || matchedExp?.slug || null;

      items.push({
        id: `kh-${res.id}`,
        expertName: authorName,
        expertSlug: slug,
        institution: res.organization || matchedExp?.institution || "BARUNA Network",
        kind,
        category,
        title: res.title,
        detail: res.summary || `${res.typeLabel} (${res.year})`,
        date: formatDateLabel(res.updatedAt || res.createdAt),
        href:
          res.type === "learning-modules" && res.moduleCode
            ? `/academy/self-paced/${res.moduleCode}`
            : `/knowledge-hub/resource/${res.id}`,
        isLive: true,
      });
    }

    // Sort live items newest first
    items.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

    // 3. Append non-duplicate historical records
    for (const hist of HISTORICAL_RECORDS) {
      if (!seenModuleTitles.has(hist.title.trim().toLowerCase())) {
        items.push(hist);
      }
    }

    return items;
  }, [publishedModules, khOverview, publicExperts]);

  const stats = useMemo(() => {
    const modulesCount = contributions.filter((c) => c.category === "modules").length;
    const khCount = contributions.filter(
      (c) =>
        c.category === "publications" ||
        c.category === "policy-case" ||
        c.category === "practices-toolkits" ||
        c.category === "media",
    ).length;
    const uniqueContributors = new Set(
      contributions.map((c) => c.expertName.trim().toLowerCase()),
    ).size;
    return {
      total: contributions.length,
      modulesCount,
      khCount,
      uniqueContributors,
    };
  }, [contributions]);

  const filteredContributions = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return contributions.filter((item) => {
      if (activeCategory !== "all" && item.category !== activeCategory) return false;
      if (!term) return true;
      return (
        item.expertName.toLowerCase().includes(term) ||
        item.title.toLowerCase().includes(term) ||
        item.detail.toLowerCase().includes(term) ||
        item.kind.toLowerCase().includes(term) ||
        (item.institution ?? "").toLowerCase().includes(term)
      );
    });
  }, [contributions, activeCategory, searchQuery]);

  const categoryTabs: { id: ContributionCategory; label: string }[] = [
    { id: "all", label: "All Verified" },
    { id: "modules", label: "Modules & Courses" },
    { id: "publications", label: "Publications" },
    { id: "policy-case", label: "Policy Briefs & Case Studies" },
    { id: "practices-toolkits", label: "Best Practices & Toolkits" },
    { id: "media", label: "Videos & Infographics" },
    { id: "governance", label: "Reviews & Curriculum" },
  ];

  return (
    <PageShell
      sidebar={{ ...EXPERTS_SIDEBAR_META, sections: publicExpertsNav("/experts/contributions") }}
      cta={{
        icon: ScrollText,
        title: "Want to contribute to BARUNA?",
        description:
          "Verified experts and trainers can submit learning modules and knowledge resources to build their official BARUNA portfolio.",
        button: "Submit a Resource",
        href: "/knowledge-hub/submit-resource",
      }}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">Expert Contributions</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Only verified contributions appear here. Every module, publication, and review listed
              below has passed BARUNA quality assurance and governance approval.
            </p>
          </div>
          <div>
            {isLoading ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Syncing verified records...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" />
                {stats.total} Verified Records
              </span>
            )}
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-marine">
              <GraduationCap className="h-4 w-4" /> Modules & Courses
            </div>
            <p className="mt-2 font-display text-3xl font-extrabold text-navy">
              {stats.modulesCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Approved self-paced modules & training courses
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-marine">
              <BookOpen className="h-4 w-4" /> Knowledge Resources
            </div>
            <p className="mt-2 font-display text-3xl font-extrabold text-navy">{stats.khCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Published briefs, case studies, reports & media
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-marine">
              <Users className="h-4 w-4" /> Active Contributors
            </div>
            <p className="mt-2 font-display text-3xl font-extrabold text-navy">
              {stats.uniqueContributors}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Verified trainers, experts & knowledge authors
            </p>
          </div>
        </div>

        {/* Recognized Contribution Types */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-base font-bold text-navy">
            Recognized Contribution Types
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <span
                key={k}
                className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-navy"
              >
                {k}
              </span>
            ))}
          </div>
        </section>

        {/* Live Verified Contributions Feed */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-navy">
                Verified Contributions Registry
              </h2>
              <p className="text-xs text-muted-foreground">
                Showing {filteredContributions.length} of {contributions.length} verified
                contributions
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search expert, title, or institution..."
                className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-8 text-xs outline-none transition-colors focus:border-marine"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-2 rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {categoryTabs.map((tab) => {
              const active = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? "bg-marine text-white"
                      : "bg-muted/70 text-foreground/75 hover:bg-muted hover:text-marine"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Contributions List */}
          <ul className="divide-y divide-border">
            {filteredContributions.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">
                No verified contributions match your current filter.
              </li>
            )}
            {filteredContributions.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {r.expertSlug ? (
                      <Link
                        to="/experts/$slug"
                        params={{ slug: r.expertSlug }}
                        className="text-sm font-bold text-navy hover:text-marine hover:underline"
                      >
                        {r.expertName}
                      </Link>
                    ) : (
                      <span className="text-sm font-bold text-navy">{r.expertName}</span>
                    )}
                    {r.institution && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3 shrink-0" />
                        {r.institution}
                      </span>
                    )}
                  </div>

                  {r.href ? (
                    <Link
                      to={r.href}
                      className="group inline-flex items-center gap-1 text-sm font-semibold text-marine hover:underline"
                    >
                      <span>{r.title}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-navy/90">{r.title}</p>
                  )}

                  <p className="line-clamp-2 text-xs text-foreground/70">{r.detail}</p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs sm:flex-col sm:items-end">
                  <span className="inline-flex items-center gap-1 rounded-full bg-eco-community/15 px-2.5 py-0.5 font-semibold text-eco-community">
                    <BadgeCheck className="h-3.5 w-3.5" /> {r.kind}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {r.date}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}

