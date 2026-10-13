import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Search as SearchIcon,
  ArrowRight,
  BookOpen,
  GraduationCap,
  Users,
  CalendarDays,
  Handshake,
  Sparkles,
  X,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { PageShell } from "@/components/baruna/page/PageShell";
import {
  DEMO_EXPERTS,
  DEMO_MODULES,
  DEMO_SHORT_COURSES,
  DEMO_EVENTS,
  DEMO_PARTNERS,
  DEMO_FELLOWSHIPS,
  DEMO_COMMUNITIES,
  DEMO_CATEGORIES,
} from "@/data/demo";
import { getKnowledgeHubOverview } from "@/lib/knowledge-hub/knowledge-hub.functions";
import { getPublishedModulesCatalog } from "@/lib/learning/learning.functions";
import { listPublicExperts } from "@/lib/experts/directory.functions";
import { useLanguage } from "@/lib/i18n";

function buildHref(pattern: string, params?: Record<string, string>) {
  if (!params) return pattern;
  let out = pattern;
  for (const [k, v] of Object.entries(params)) out = out.replace("$" + k, encodeURIComponent(v));
  return out;
}

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — BARUNA" },
      {
        name: "description",
        content:
          "Search across BARUNA Knowledge Hub publications, training modules, self-paced courses, verified experts, events, fellowships, partners, and communities.",
      },
    ],
  }),
  component: SearchPage,
});

type SearchCategory = "all" | "knowledge-hub" | "courses" | "experts" | "events" | "community";

type Hit = {
  id: string;
  category: SearchCategory;
  kind: string;
  label: string;
  summary?: string;
  to: string;
  params?: Record<string, string>;
  hint?: string;
  keywords?: string[];
  isLive?: boolean;
};

function SearchPage() {
  const [q, setQ] = useState("");
  const [activeCategory, setActiveCategory] = useState<SearchCategory>("all");
  const { t } = useLanguage();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const initialQ = params.get("q");
      const initialCat = params.get("category") as SearchCategory | null;
      if (initialQ) setQ(initialQ);
      if (
        initialCat &&
        ["all", "knowledge-hub", "courses", "experts", "events", "community"].includes(initialCat)
      ) {
        setActiveCategory(initialCat);
      }
    }
  }, []);

  const getKhOverviewFn = useServerFn(getKnowledgeHubOverview);
  const getModulesCatalogFn = useServerFn(getPublishedModulesCatalog);
  const listExpertsFn = useServerFn(listPublicExperts);

  const { data: khOverview, isLoading: khLoading } = useQuery({
    queryKey: ["global-search", "knowledge-hub"],
    queryFn: () => getKhOverviewFn(),
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const { data: publishedModules, isLoading: modulesLoading } = useQuery({
    queryKey: ["global-search", "published-modules"],
    queryFn: () => getModulesCatalogFn(),
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const { data: dbExperts, isLoading: expertsLoading } = useQuery({
    queryKey: ["global-search", "public-experts"],
    queryFn: () => listExpertsFn(),
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const isLoadingLive = khLoading || modulesLoading || expertsLoading;

  const allItems: Hit[] = useMemo(() => {
    const items: Hit[] = [];
    const seenCourseTitles = new Set<string>();
    const seenExpertSlugs = new Set<string>();
    const seenKhTitles = new Set<string>();

    // 1. Live Published Modules (Self-Paced Academy)
    for (const m of publishedModules ?? []) {
      const normTitle = m.title.trim().toLowerCase();
      seenCourseTitles.add(normTitle);
      items.push({
        id: `mod-${m.id}`,
        category: "courses",
        kind: t("sidebar.selfPacedCourse"),
        label: m.title,
        summary: m.summary,
        to: "/academy/self-paced/$code",
        params: { code: m.id },
        hint: `${m.authorName} • ${m.estimated_learning_hours || 2} Hours • ${m.language}`,
        keywords: [m.topic, m.competency, m.authorName, m.language].filter(Boolean),
        isLive: true,
      });
    }

    // 2. Live Knowledge Hub Resources (Publications, Policy Briefs, Infographics, Case Studies, Videos, Best Practices, Toolkits, Projected Modules)
    for (const r of khOverview?.resources ?? []) {
      const normTitle = r.title.trim().toLowerCase();
      if (r.type === "learning-modules" && seenCourseTitles.has(normTitle)) {
        continue;
      }
      if (seenKhTitles.has(normTitle)) continue;
      seenKhTitles.add(normTitle);

      const isCourseModule = r.type === "learning-modules";
      items.push({
        id: `kh-${r.id}`,
        category: isCourseModule ? "courses" : "knowledge-hub",
        kind: r.typeLabel || "Knowledge Hub",
        label: r.title,
        summary: r.summary,
        to:
          isCourseModule && r.moduleCode
            ? "/academy/self-paced/$code"
            : "/knowledge-hub/resource/$id",
        params:
          isCourseModule && r.moduleCode
            ? { code: r.moduleCode }
            : { id: r.id },
        hint: `${r.author} • ${r.organization} (${r.year})`,
        keywords: [...(r.keywords ?? []), r.category, r.author, r.organization, r.country].filter(
          Boolean,
        ),
        isLive: true,
      });
    }

    // 3. Live Verified Experts from Supabase
    for (const e of dbExperts ?? []) {
      const slug = e.slug || e.id;
      seenExpertSlugs.add(slug.toLowerCase());
      seenExpertSlugs.add(e.displayName.trim().toLowerCase());
      items.push({
        id: `exp-${e.id}`,
        category: "experts",
        kind: t("nav.experts"),
        label: e.displayName,
        summary: e.headline || undefined,
        to: "/experts/$slug",
        params: { slug },
        hint: [e.institution, e.country].filter(Boolean).join(" • "),
        keywords: [...(e.expertiseAreas ?? []), e.institution ?? "", e.country ?? ""].filter(
          Boolean,
        ),
        isLive: true,
      });
    }

    // 4. Static / Demo Catalog Fallbacks (deduplicated against live DB)
    for (const e of DEMO_EXPERTS) {
      if (
        seenExpertSlugs.has(e.slug.toLowerCase()) ||
        seenExpertSlugs.has(e.fullName.trim().toLowerCase())
      ) {
        continue;
      }
      items.push({
        id: `demo-exp-${e.slug}`,
        category: "experts",
        kind: t("nav.experts"),
        label: e.fullName,
        to: "/experts/$slug",
        params: { slug: e.slug },
        hint: `${e.organization} • ${e.country}`,
      });
    }

    for (const c of DEMO_SHORT_COURSES) {
      if (seenCourseTitles.has(c.title.trim().toLowerCase())) continue;
      seenCourseTitles.add(c.title.trim().toLowerCase());
      items.push({
        id: `demo-sc-${c.code}`,
        category: "courses",
        kind: t("sidebar.selfPacedCourse"),
        label: c.title,
        to: "/academy/self-paced/$code",
        params: { code: c.code },
        hint: `${c.code} • ${c.instructionalHours} IH`,
        keywords: [c.code, c.category],
      });
    }

    for (const m of DEMO_MODULES) {
      if (
        seenCourseTitles.has(m.title.trim().toLowerCase()) ||
        seenKhTitles.has(m.title.trim().toLowerCase())
      ) {
        continue;
      }
      items.push({
        id: `demo-mod-${m.code}`,
        category: "courses",
        kind: t("sidebar.learningModules"),
        label: m.title,
        to: "/academy/self-paced/$code",
        params: { code: m.code },
        hint: m.code,
        keywords: [m.code, m.category],
      });
    }

    for (const e of DEMO_EVENTS) {
      items.push({
        id: `demo-ev-${e.slug}`,
        category: "events",
        kind: t("nav.events"),
        label: e.title,
        to: "/events/$slug",
        params: { slug: e.slug },
        hint: `${e.date} • ${e.location}`,
      });
    }

    for (const f of DEMO_FELLOWSHIPS) {
      items.push({
        id: `demo-fel-${f.title}`,
        category: "events",
        kind: t("nav.fellowship"),
        label: f.title,
        to: "/fellowship",
        hint: f.duration,
      });
    }

    for (const p of DEMO_PARTNERS) {
      items.push({
        id: `demo-part-${p.name}`,
        category: "community",
        kind: t("nav.partnership"),
        label: p.name,
        to: "/partnership",
        hint: p.country,
      });
    }

    for (const c of DEMO_COMMUNITIES) {
      items.push({
        id: `demo-comm-${c.name}`,
        category: "community",
        kind: t("nav.community"),
        label: c.name,
        to: "/community",
        hint: `${c.members} members`,
      });
    }

    for (const c of DEMO_CATEGORIES) {
      items.push({
        id: `demo-cat-${c.slug}`,
        category: "community",
        kind: t("sidebar.byCategory"),
        label: c.name,
        to: "/academy/category/$slug",
        params: { slug: c.slug },
        hint: c.tagline,
      });
    }

    return items;
  }, [publishedModules, khOverview, dbExperts, t]);

  const queryMatchedItems = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return allItems;
    return allItems.filter((h) => {
      if (h.label.toLowerCase().includes(term)) return true;
      if (h.summary && h.summary.toLowerCase().includes(term)) return true;
      if (h.hint && h.hint.toLowerCase().includes(term)) return true;
      if (h.kind.toLowerCase().includes(term)) return true;
      if (h.keywords?.some((kw) => kw.toLowerCase().includes(term))) return true;
      return false;
    });
  }, [allItems, q]);

  const categoryCounts = useMemo(() => {
    const counts: Record<SearchCategory, number> = {
      all: queryMatchedItems.length,
      "knowledge-hub": 0,
      courses: 0,
      experts: 0,
      events: 0,
      community: 0,
    };
    for (const item of queryMatchedItems) {
      counts[item.category] += 1;
    }
    return counts;
  }, [queryMatchedItems]);

  const filteredHits = useMemo(() => {
    const list =
      activeCategory === "all"
        ? queryMatchedItems
        : queryMatchedItems.filter((h) => h.category === activeCategory);
    if (!q.trim() && activeCategory === "all") {
      return list.slice(0, 30);
    }
    return list;
  }, [queryMatchedItems, activeCategory, q]);

  const categoryTabs: { id: SearchCategory; label: string; icon: typeof SearchIcon }[] = [
    { id: "all", label: "All results", icon: SearchIcon },
    { id: "knowledge-hub", label: "Knowledge Hub", icon: BookOpen },
    { id: "courses", label: "Self-Paced Courses", icon: GraduationCap },
    { id: "experts", label: "Experts", icon: Users },
    { id: "events", label: "Events", icon: CalendarDays },
    { id: "community", label: "Partners", icon: Handshake },
  ];

  return (
    <PageShell
      sidebar={{
        icon: SearchIcon,
        title: "Global Search",
        subtitle: "Search across live BARUNA publications, modules, experts & programs.",
        sections: [
          {
            label: "Filters",
            items: categoryTabs.map((tab) => ({
              label: tab.label,
              icon: tab.icon,
              count: categoryCounts[tab.id],
              active: activeCategory === tab.id,
              onClick: () => setActiveCategory(tab.id),
            })),
          },
          {
            label: "Browse",
            items: [
              { label: "Knowledge Hub", to: "/knowledge-hub", icon: BookOpen },
              { label: "Self-Paced Courses", to: "/academy/self-paced", icon: GraduationCap },
              { label: "Expert Directory", to: "/experts/directory", icon: Users },
              { label: "All Events", to: "/events", icon: CalendarDays },
            ],
          },
        ],
      }}
      cta={{
        icon: SearchIcon,
        title: "Looking for something specific?",
        description: "Browse the BARUNA Academy or explore verified marine & fisheries resources.",
        button: "Browse Academy",
        href: "/academy",
      }}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">{t("search.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("search.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isLoadingLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                Syncing live catalog...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 border border-emerald-200/60">
                <Sparkles className="h-3.5 w-3.5" />
                {allItems.length} indexed items
              </span>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search.placeholder")}
            className="w-full rounded-xl border border-border bg-card py-3 pl-11 pr-10 text-sm outline-none transition-colors focus:border-marine"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {categoryTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? "bg-marine text-white shadow-sm"
                    : "border border-border bg-card text-foreground/75 hover:border-marine/40 hover:text-marine"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] ${
                    active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {categoryCounts[tab.id]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Results List */}
        <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
          <ul className="divide-y divide-border">
            {filteredHits.length === 0 && (
              <li className="p-8 text-center">
                <p className="text-sm font-semibold text-navy">{t("search.noResults")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try another keyword or switch the filter tab above.
                </p>
              </li>
            )}
            {filteredHits.map((h) => (
              <li key={h.id}>
                <Link
                  to={buildHref(h.to, h.params)}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-navy">{h.label}</p>
                      {h.isLive && (
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
                          Verified
                        </span>
                      )}
                    </div>
                    {h.summary && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">{h.summary}</p>
                    )}
                    {h.hint && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{h.hint}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <span className="rounded-full bg-marine/10 px-2.5 py-0.5 font-bold text-marine">
                      {h.kind}
                    </span>
                    <ArrowRight className="h-4 w-4 text-marine" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PageShell>
  );
}

