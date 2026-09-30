import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Search, X, LayoutGrid, List, AlignJustify, BookOpen, Upload, Filter, Compass } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { Panel } from "@/components/baruna/page/primitives";
import { KH_ALL, KH_TYPES, labelForType, resourcesByType, type KhResource, type KhResourceType, type KhAccessLevel } from "@/data/demo/knowledgeHub";
import { DEMO_CATEGORIES } from "@/data/demo";
import { KH_SIDEBAR_META, knowledgeHubSidebarSections } from "@/data/khNav";
import { ResourceCard, DemoDataBadge } from "@/components/baruna/knowledge/ResourceCard";

import { supabase } from "@/integrations/supabase/client";

const VALID: string[] = [...KH_TYPES.map((t) => t.slug), "library"];

export const Route = createFileRoute("/knowledge-hub_/$type")({
  loader: async ({ params }) => {
    if (!VALID.includes(params.type)) throw notFound();

    let dbResources: KhResource[] = [];
    if (params.type === "learning-modules" || params.type === "library") {
      const { data: dbMods } = await supabase
        .from("module_registry")
        .select("id, title, summary, language, estimated_learning_hours, created_at, author_expert_id")
        .eq("current_status", "published")
        .order("created_at", { ascending: false });

      if (dbMods && dbMods.length > 0) {
        const expertIds = Array.from(new Set(dbMods.map((m) => m.author_expert_id).filter(Boolean))) as string[];
        let expertMap: Record<string, string> = {};
        if (expertIds.length > 0) {
          const { data: expList } = await supabase.from("experts_directory_v").select("id, display_name").in("id", expertIds);
          if (expList && expList.length > 0) {
            expertMap = Object.fromEntries(expList.map((e) => [e.id, e.display_name]));
          } else {
            const { data: profList } = await supabase.from("profiles").select("id, display_name").in("id", expertIds);
            if (profList) {
              for (const p of profList) if (p.display_name) expertMap[p.id] = p.display_name;
            }
          }
        }

        dbResources = dbMods.map((m, idx) => ({
          id: m.id,
          type: "learning-modules" as const,
          typeLabel: "Learning Module",
          title: m.title,
          category: "fisheries-management" as const,
          summary: m.summary || "Approved BARUNA learning module connected to Self-Paced Courses.",
          abstract: m.summary || "Approved BARUNA learning module.",
          author: (m.author_expert_id && expertMap[m.author_expert_id]) || "Barry",
          contributor: "BARUNA Academy",
          organization: "BARUNA Network",
          year: new Date(m.created_at).getFullYear(),
          language: m.language || "English",
          country: "Indonesia",
          keywords: ["Learning Module", "Self-Paced", m.title.toLowerCase()],
          access: "Completion Required" as const,
          status: "Published" as const,
          fileType: "Module Package",
          pages: (m.estimated_learning_hours || 2) * 12,
          version: "1.0",
          moduleCode: `BARUNA-MOD-${String(idx + 1).padStart(2, "0")}`,
          shortCourseCode: m.id,
          expertId: m.author_expert_id || "",
          metrics: { views: 42, uniqueViewers: 18, downloads: 12, saves: 4, shares: 2 },
          citation: `${(m.author_expert_id && expertMap[m.author_expert_id]) || "Barry"} (${new Date(m.created_at).getFullYear()}). ${m.title}. BARUNA Knowledge Hub.`,
          createdAt: m.created_at,
          updatedAt: m.created_at,
        }));
      }
    }

    return { type: params.type as KhResourceType | "library", dbResources };
  },
  head: ({ params }) => {
    const label = params.type === "library" ? "Resource Library" : labelForType(params.type as KhResourceType);
    return {
      meta: [
        { title: `${label} — Knowledge Hub — BARUNA` },
        { name: "description", content: `Browse ${label.toLowerCase()} in the BARUNA Knowledge Hub — connected to experts, training, events, communities, and analytics.` },
        { property: "og:title", content: `${label} — BARUNA Knowledge Hub` },
        { property: "og:description", content: `Realistic BARUNA demo ${label.toLowerCase()} catalogue.` },
      ],
      links: [{ rel: "canonical", href: `/knowledge-hub/${params.type}` }],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-10 text-center">
      <h1 className="font-display text-2xl font-bold text-navy">Unknown resource type</h1>
      <p className="mt-2 text-sm text-muted-foreground">This Knowledge Hub category does not exist.</p>
      <Link to="/knowledge-hub" className="mt-4 inline-flex rounded-xl bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground">Back to Knowledge Hub</Link>
    </div>
  ),
  errorComponent: ({ error }: { error: any }) => (
    <div className="mx-auto max-w-2xl p-10 text-center">
      <h1 className="font-display text-2xl font-bold text-navy">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error?.message || String(error)}</p>
    </div>
  ),
  component: CataloguePage,
});

type SortKey = "relevant" | "newest" | "most-viewed" | "most-downloaded" | "alphabetical";
type ViewMode = "grid" | "list" | "compact";

function CataloguePage() {
  const { type, dbResources } = Route.useLoaderData();
  const isLibrary = type === "library";
  const staticList: KhResource[] = isLibrary ? KH_ALL : resourcesByType(type);
  const base: KhResource[] = [...(dbResources ?? []), ...staticList];
  const label = isLibrary ? "Resource Library" : labelForType(type);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [access, setAccess] = useState<string>("all");
  const [year, setYear] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("relevant");
  const [view, setView] = useState<ViewMode>("grid");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = base.filter((r) => {
      if (cat !== "all" && r.category !== cat) return false;
      if (access !== "all" && r.access !== access) return false;
      if (year !== "all" && String(r.year) !== year) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (!needle) return true;
      const hay = [r.title, r.summary, r.author, r.organization, r.moduleCode, ...r.keywords].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
    if (sort === "newest") list = [...list].sort((a, b) => b.year - a.year);
    if (sort === "most-viewed") list = [...list].sort((a, b) => b.metrics.views - a.metrics.views);
    if (sort === "most-downloaded") list = [...list].sort((a, b) => b.metrics.downloads - a.metrics.downloads);
    if (sort === "alphabetical") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [base, q, cat, access, year, typeFilter, sort]);

  const years = Array.from(new Set(base.map((r) => r.year))).sort((a, b) => b - a);
  const accessLevels: KhAccessLevel[] = ["Public Access", "Registered User", "Course Participant", "Completion Required"];

  const clear = () => { setQ(""); setCat("all"); setAccess("all"); setYear("all"); setTypeFilter("all"); };

  return (
    <PageShell
      sidebar={{
        ...KH_SIDEBAR_META,
        sections: knowledgeHubSidebarSections(type),
      }}
      cta={{
        icon: Upload,
        title: "Contribute a Resource",
        description: "Verified experts, trainers, and partners may submit new resources.",
        button: "Submit a Resource",
        href: "/knowledge-hub/submit-resource",
      }}
    >
      <div className="space-y-6">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link to="/knowledge-hub" className="hover:text-marine">Knowledge Hub</Link>
          <span className="mx-1.5">/</span>
          <span className="font-semibold text-navy">{label}</span>
        </nav>

        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-3xl font-extrabold text-navy">{label}</h1>
              <DemoDataBadge />
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {isLibrary
                ? "Unified catalogue of every published BARUNA Knowledge Hub resource."
                : KH_TYPES.find((t) => t.slug === type)!.description}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {filtered.length.toLocaleString()} of {base.length.toLocaleString()} resources
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["grid", "list", "compact"] as ViewMode[]).map((v) => {
              const Icon = v === "grid" ? LayoutGrid : v === "list" ? List : AlignJustify;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`grid h-9 w-9 place-items-center rounded-lg border ${view === v ? "border-marine bg-marine text-marine-foreground" : "border-border text-foreground/70 hover:border-marine/40"}`}
                  aria-label={`${v} view`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-navy shadow-soft focus:outline-none"
            >
              <option value="relevant">Most Relevant</option>
              <option value="newest">Newest</option>
              <option value="most-viewed">Most Viewed</option>
              <option value="most-downloaded">Most Downloaded</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </div>
        </header>

        <Panel>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 shadow-soft">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}, authors, keywords…`}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {q && (
                  <button aria-label="Clear search" onClick={() => setQ("")}><X className="h-4 w-4 text-muted-foreground" /></button>
                )}
              </div>
              {(q || cat !== "all" || access !== "all" || year !== "all" || typeFilter !== "all") && (
                <button onClick={clear} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-navy hover:border-marine/40">
                  Clear filters
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              {isLibrary && (
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 font-semibold text-navy">
                  <option value="all">All Types</option>
                  {KH_TYPES.map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}
                </select>
              )}
              <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 font-semibold text-navy">
                <option value="all">All Categories</option>
                {DEMO_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
              <select value={access} onChange={(e) => setAccess(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 font-semibold text-navy">
                <option value="all">All Access</option>
                {accessLevels.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={year} onChange={(e) => setYear(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 font-semibold text-navy">
                <option value="all">All Years</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </Panel>

        {filtered.length === 0 ? (
          <EmptyState onClear={clear} />
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((r, i) => <ResourceCard key={r.id} r={r} index={i} />)}
          </div>
        ) : view === "list" ? (
          <div className="space-y-3">
            {filtered.map((r) => <ListRow key={r.id} r={r} />)}
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {filtered.map((r) => (
              <Link key={r.id} to="/knowledge-hub/resource/$id" params={{ id: r.id }} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm hover:bg-muted">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-navy">{r.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.typeLabel} · {r.author} · {r.year}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{r.metrics.views.toLocaleString()} views</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function ListRow({ r }: { r: KhResource }) {
  return (
    <Link to="/knowledge-hub/resource/$id" params={{ id: r.id }} className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-hover">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex rounded-md bg-navy px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-navy-foreground">{r.typeLabel}</span>
          <DemoDataBadge />
        </div>
        <h3 className="mt-1.5 font-display text-base font-bold text-navy">{r.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.summary}</p>
        <p className="mt-2 text-xs text-muted-foreground">{r.author} · {r.organization} · {r.year} · {r.language}</p>
      </div>
      <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
        <p>{r.metrics.views.toLocaleString()} views</p>
        <p>{r.metrics.downloads.toLocaleString()} downloads</p>
      </div>
    </Link>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <Panel>
      <div className="mx-auto max-w-md py-6 text-center">
        <BookOpen className="mx-auto h-10 w-10 text-marine/60" />
        <h3 className="mt-3 font-display text-lg font-bold text-navy">No resources found.</h3>
        <p className="mt-1 text-sm text-muted-foreground">Try clearing your filters, searching a different keyword, or explore related training categories.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button onClick={onClear} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-navy hover:border-marine/40">
            Clear Filters
          </button>
          <Link to="/knowledge-hub/$type" params={{ type: "library" }} className="inline-flex items-center gap-1 rounded-xl bg-marine px-3 py-2 text-xs font-semibold text-marine-foreground">
            <Compass className="h-3.5 w-3.5" /> View All Resources
          </Link>
        </div>
      </div>
    </Panel>
  );
}
