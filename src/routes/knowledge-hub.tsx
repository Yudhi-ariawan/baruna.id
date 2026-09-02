import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  FileText,
  GraduationCap,
  Award,
  Video,
  ScrollText,
  PieChart,
  FolderOpen,
  Library,
  Layers,
  Search,
  ChevronRight,
  Download,
  Play,
  Bookmark,
  Building2,
  Globe,
  Users,
  Upload,
  Plus,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { Banner } from "@/components/baruna/page/Banner";
import { Panel, SectionHeader, Tag } from "@/components/baruna/page/primitives";
import { pageImages, courseImages } from "@/data/pages";
import {
  KH_TYPES,
  KH_ALL,
  countByType,
  totalPublished,
  totalViews,
  totalDownloads,
  labelForType,
  type KhResourceType,
} from "@/data/demo/knowledgeHub";
import { KH_SIDEBAR_META, knowledgeHubSidebarSections } from "@/data/khNav";
import { ResourceCard, DemoDataBadge } from "@/components/baruna/knowledge/ResourceCard";
import { DEMO_CATEGORIES } from "@/data/demo";

export const Route = createFileRoute("/knowledge-hub")({
  head: () => ({
    meta: [
      { title: "Knowledge Hub — BARUNA" },
      {
        name: "description",
        content:
          "Explore, discover, and share knowledge for a sustainable ocean and fisheries future — publications, learning modules, videos, best practices, and toolkits.",
      },
      { property: "og:title", content: "Knowledge Hub — BARUNA" },
      { property: "og:description", content: "Publications, modules, best practices, videos, and policy briefs." },
      { property: "og:image", content: pageImages.bannerUnderwater },
    ],
    links: [{ rel: "canonical", href: "/knowledge-hub" }],
  }),
  component: KnowledgeHubPage,
});

const TYPE_ICONS: Record<KhResourceType, LucideIcon> = {
  publications: FileText,
  "learning-modules": GraduationCap,
  "best-practices": Award,
  videos: Video,
  "policy-briefs": ScrollText,
  infographics: PieChart,
  "case-studies": FolderOpen,
  toolkits: Layers,
};

function KnowledgeHubPage() {
  const [q, setQ] = useState("");
  const total = totalPublished();

  const latest = useMemo(() => [...KH_ALL].sort((a, b) => b.year - a.year).slice(0, 8), []);
  const results = useMemo(() => {
    if (!q.trim()) return null;
    const needle = q.toLowerCase();
    return KH_ALL.filter((r) =>
      [r.title, r.summary, r.author, r.organization, ...r.keywords].join(" ").toLowerCase().includes(needle),
    ).slice(0, 12);
  }, [q]);

  return (
    <PageShell
      sidebar={{
        ...KH_SIDEBAR_META,
        sections: knowledgeHubSidebarSections(),
      }}
      cta={{
        icon: Upload,
        title: "Share Knowledge. Drive Change.",
        description: "Contribute your publications and resources to help build a stronger marine and fisheries knowledge ecosystem.",
        button: "Submit a Resource",
        href: "/knowledge-hub/submit-resource",
      }}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-3xl font-extrabold text-navy">Knowledge Hub</h1>
              <DemoDataBadge />
            </div>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Explore, discover, and share knowledge for a sustainable ocean and fisheries future.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-soft">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search publications, topics, authors…"
              />
            </div>
            <Link to="/knowledge-hub/$type" params={{ type: "library" }} className="flex items-center gap-2 rounded-xl bg-marine px-4 py-2.5 text-sm font-semibold text-marine-foreground shadow-soft">
              Resource Library <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {results && (
          <Panel>
            <SectionHeader title={`Search results (${results.length})`} action={null} />
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">No resources match “{q}”. Try another keyword or clear the search.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((r) => (
                  <Link key={r.id} to="/knowledge-hub/resource/$id" params={{ id: r.id }} className="rounded-lg border border-border p-3 text-sm hover:border-marine/40 hover:bg-muted">
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-marine">{r.typeLabel}</p>
                    <p className="mt-1 line-clamp-2 font-semibold text-navy">{r.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.author} · {r.year}</p>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        )}

        <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
          <div className="space-y-6">
            <Banner
              image={pageImages.bannerUnderwater}
              alt="Sea turtle swimming over coral reef"
              title={<>Reliable Knowledge.<br />Stronger Impact.</>}
              description="A single connected catalogue of BARUNA publications, modules, videos, toolkits, and case studies."
              stats={[
                { value: total.toLocaleString(), label: "Published Resources", icon: BookOpen },
                { value: totalViews().toLocaleString(), label: "Total Views", icon: Globe },
                { value: totalDownloads().toLocaleString(), label: "Downloads", icon: Download },
                { value: DEMO_CATEGORIES.length.toString(), label: "Training Categories", icon: Library },
              ]}
            />

            <Panel>
              <SectionHeader title="Browse Knowledge by Type" action={null} />
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {KH_TYPES.map((t) => {
                  const Icon = TYPE_ICONS[t.slug];
                  const count = countByType(t.slug);
                  return (
                    <li key={t.slug}>
                      <Link
                        to="/knowledge-hub/$type"
                        params={{ type: t.slug }}
                        className="flex min-h-[68px] items-center gap-3 px-4 py-3 transition-colors hover:bg-marine/5 sm:gap-4"
                      >
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <p className="font-display text-sm font-bold text-navy sm:text-base">{t.label}</p>
                            <span className="text-xs font-semibold text-marine">
                              {count} {t.slug === "learning-modules" ? "Modules" : t.slug === "toolkits" ? "Toolkits" : t.slug === "videos" ? "Videos" : "Resources"}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:line-clamp-1">{t.description}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <Link
                    to="/knowledge-hub/$type" params={{ type: "library" }}
                    className="flex min-h-[68px] items-center gap-3 bg-marine/5 px-4 py-3 transition-colors hover:bg-marine/10 sm:gap-4"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marine text-marine-foreground">
                      <Library className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="font-display text-sm font-bold text-navy sm:text-base">Resource Library</p>
                        <span className="text-xs font-semibold text-marine">{total} Resources</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:line-clamp-1">
                        Search all BARUNA knowledge resources in one catalogue.
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              </ul>
            </Panel>

            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold text-navy sm:text-xl">Latest Resources</h2>
                <Link to="/knowledge-hub/$type" params={{ type: "library" }} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-marine transition-colors hover:text-navy">
                  Browse Library <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {latest.map((r, i) => <ResourceCard key={r.id} r={r} index={i} />)}
              </div>
            </section>

            {/* Share Knowledge from Your Country */}
            <section className="overflow-hidden rounded-2xl border border-marine/30 bg-gradient-to-br from-navy to-marine p-7 text-navy-foreground shadow-card">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-foreground/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">
                    <Globe className="h-3.5 w-3.5" /> International Knowledge Exchange
                  </span>
                  <h2 className="mt-3 font-display text-2xl font-extrabold">Share Knowledge from Your Country</h2>
                  <p className="mt-2 text-sm leading-relaxed text-navy-foreground/85">
                    Contribute fisheries, aquaculture, marine conservation, ocean governance, and
                    capacity development knowledge from your country to enrich the BARUNA global
                    repository.
                  </p>
                </div>
                <Link
                  to="/knowledge-hub/submit-resource"
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-hover"
                >
                  <Plus className="h-4 w-4" /> Contribute Now
                </Link>
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <Panel>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-navy">Featured Resource</h2>
                <Bookmark className="h-5 w-5 fill-marine text-marine" />
              </div>
              {latest[0] && (
                <div className="mt-4 flex gap-3">
                  <img src={courseImages[5]} alt={latest[0].title} loading="lazy" width={120} height={160} className="h-32 w-24 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="text-[0.6rem] font-bold uppercase tracking-wide text-badge-course">{latest[0].typeLabel}</p>
                    <h3 className="mt-1 line-clamp-3 font-display text-sm font-bold leading-snug text-navy">{latest[0].title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{latest[0].summary}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{latest[0].fileType}{latest[0].fileSize ? ` · ${latest[0].fileSize}` : ""}</p>
                  </div>
                </div>
              )}
              {latest[0] && (
                <Link
                  to="/knowledge-hub/resource/$id"
                  params={{ id: latest[0].id }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-marine py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                >
                  {latest[0].type === "videos" ? <><Play className="h-4 w-4" /> Play</> : <><Download className="h-4 w-4" /> Open Resource</>}
                </Link>
              )}
            </Panel>

            <Panel>
              <SectionHeader title="Browse by Category" action={null} />
              <div className="flex flex-wrap gap-2">
                {DEMO_CATEGORIES.map((c) => (
                  <Link key={c.slug} to="/academy/category/$slug" params={{ slug: c.slug }}>
                    <Tag>{c.name}</Tag>
                  </Link>
                ))}
              </div>
            </Panel>

            <Panel>
              <SectionHeader title="Hub in Numbers" action={null} />
              <div className="grid grid-cols-2 gap-3">
                <NumberTile icon={BookOpen} value={total.toString()} label="Published" />
                <NumberTile icon={Users} value={DEMO_CATEGORIES.length.toString()} label="Categories" />
                <NumberTile icon={Building2} value="9" label="Trainers" />
                <NumberTile icon={Globe} value="60+" label="Countries" />
              </div>
              <Link to="/analytics" className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-semibold text-marine">
                Open Analytics <ArrowRight className="h-4 w-4" />
              </Link>
            </Panel>

            <Panel>
              <SectionHeader title="Most Viewed" action={null} />
              <ul className="space-y-2 text-sm">
                {[...KH_ALL].sort((a, b) => b.metrics.views - a.metrics.views).slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link to="/knowledge-hub/resource/$id" params={{ id: r.id }} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 hover:bg-muted">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-navy">{r.title}</span>
                        <span className="block text-[0.65rem] text-muted-foreground">{r.typeLabel}</span>
                      </span>
                      <span className="shrink-0 text-[0.65rem] text-muted-foreground">{r.metrics.views.toLocaleString()}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function NumberTile({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border p-3 text-center">
      <Icon className="mx-auto h-5 w-5 text-marine" />
      <p className="mt-2 font-display text-lg font-extrabold text-navy">{value}</p>
      <p className="text-[0.7rem] text-muted-foreground">{label}</p>
    </div>
  );
}

// Legacy helper retained for backward-compat imports (safe no-op export)
export const KNOWLEDGE_HUB_TYPE_LABEL = labelForType;
