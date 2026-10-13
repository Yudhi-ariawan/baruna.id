import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bookmark,
  ArrowRight,
  BookOpen,
  GraduationCap,
  CalendarDays,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { ResourceCard } from "@/components/baruna/knowledge/ResourceCard";
import { getResourceById, type KhResource } from "@/data/demo/knowledgeHub";
import { DEMO_SHORT_COURSES } from "@/data/demo";
import { events } from "@/data/events";
import { useSavedIds, clearAllSaved } from "@/lib/khSaved";
import { useShortCourses } from "@/lib/shortCourses";
import { useSavedEvents } from "@/lib/eventActions";
import { getKnowledgeHubOverview } from "@/lib/knowledge-hub/knowledge-hub.functions";
import { getPublishedModulesCatalog } from "@/lib/learning/learning.functions";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved Items — BARUNA" },
      {
        name: "description",
        content:
          "Your bookmarked Knowledge Hub publications, learning modules, self-paced courses, and events.",
      },
    ],
  }),
  component: SavedPage,
});

type SavedFilterTab = "all" | "knowledge-hub" | "courses" | "events";

function SavedPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<SavedFilterTab>("all");

  // 1. Saved Knowledge Hub Resource IDs
  const savedKhIds = useSavedIds();
  const getKhOverviewFn = useServerFn(getKnowledgeHubOverview);
  const { data: khOverview, isLoading: khLoading } = useQuery({
    queryKey: ["saved-items", "knowledge-hub-overview"],
    queryFn: () => getKhOverviewFn(),
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const savedKhResources: KhResource[] = useMemo(() => {
    if (savedKhIds.length === 0) return [];
    const byId = new Map<string, KhResource>();
    for (const r of khOverview?.resources ?? []) {
      byId.set(r.id, r);
    }
    return savedKhIds
      .map((id) => byId.get(id) ?? getResourceById(id))
      .filter((item): item is KhResource => Boolean(item));
  }, [savedKhIds, khOverview]);

  // 2. Enrolled / Active Self-Paced Courses
  const { enrollments } = useShortCourses();
  const getModulesCatalogFn = useServerFn(getPublishedModulesCatalog);
  const { data: publishedModules } = useQuery({
    queryKey: ["saved-items", "published-modules"],
    queryFn: () => getModulesCatalogFn(),
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const myCourses = useMemo(() => {
    const entries = Object.values(enrollments ?? {});
    return entries.map((enr) => {
      const dbMod = (publishedModules ?? []).find((m) => m.id === enr.code);
      const demoCourse = DEMO_SHORT_COURSES.find((c) => c.code === enr.code);
      return {
        code: enr.code,
        title: dbMod?.title || enr.title || demoCourse?.title || `Course ${enr.code}`,
        hours:
          dbMod?.estimated_learning_hours ||
          enr.hours ||
          demoCourse?.instructionalHours ||
          2,
        instructor: dbMod?.authorName || enr.instructor || "BARUNA Trainer",
        completed: enr.completed,
        score: enr.score,
      };
    });
  }, [enrollments, publishedModules]);

  // 3. Bookmarked Events
  const savedEventsStore = useSavedEvents();
  const bookmarkedEvents = useMemo(() => {
    return events.filter((e) => savedEventsStore.items.includes(e.slug));
  }, [savedEventsStore.items]);

  const totalSavedCount =
    savedKhResources.length + myCourses.length + bookmarkedEvents.length;

  const tabs: { id: SavedFilterTab; label: string; count: number; icon: typeof Bookmark }[] = [
    { id: "all", label: "All Saved Items", count: totalSavedCount, icon: Bookmark },
    { id: "knowledge-hub", label: "Knowledge Hub", count: savedKhResources.length, icon: BookOpen },
    { id: "courses", label: "Self-Paced Courses", count: myCourses.length, icon: GraduationCap },
    { id: "events", label: "Events", count: bookmarkedEvents.length, icon: CalendarDays },
  ];

  const showKh = activeTab === "all" || activeTab === "knowledge-hub";
  const showCourses = activeTab === "all" || activeTab === "courses";
  const showEvents = activeTab === "all" || activeTab === "events";

  return (
    <PageShell
      sidebar={{
        icon: Bookmark,
        title: "Saved Items",
        subtitle: "Everything you've bookmarked across BARUNA.",
        sections: [
          {
            label: "Categories",
            items: tabs.map((tab) => ({
              label: tab.label,
              icon: tab.icon,
              count: tab.count,
              active: activeTab === tab.id,
              onClick: () => setActiveTab(tab.id),
            })),
          },
          {
            label: "Browse",
            items: [
              { label: "Knowledge Hub", to: "/knowledge-hub", icon: BookOpen },
              { label: "Self-Paced Courses", to: "/academy/self-paced", icon: GraduationCap },
              { label: "All Events", to: "/events", icon: CalendarDays },
            ],
          },
        ],
      }}
      cta={{
        icon: Bookmark,
        title: "Discover more resources",
        description:
          "Tap the bookmark icon on any Knowledge Hub publication, module, or event to save it here for quick access.",
        button: "Explore Knowledge Hub",
        href: "/knowledge-hub",
      }}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">{t("saved.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your personal reading list of bookmarked Knowledge Hub publications, active courses,
              and saved events.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-marine/20 bg-marine/5 px-3 py-1 text-xs font-semibold text-marine">
              <Sparkles className="h-3.5 w-3.5" />
              {totalSavedCount} Saved
            </span>
          </div>
        </div>

        {/* Interactive Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
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
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 1. Saved Knowledge Hub Resources Section */}
        {showKh && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-marine" />
                <h2 className="font-display text-lg font-bold text-navy">
                  Bookmarked Knowledge Hub Resources ({savedKhResources.length})
                </h2>
              </div>
              {savedKhResources.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearAllSaved()}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear all
                </button>
              )}
            </div>

            {khLoading && savedKhIds.length > 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                Loading your bookmarked resources...
              </div>
            ) : savedKhResources.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <Bookmark className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-bold text-navy">
                  No bookmarked Knowledge Hub resources yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click the bookmark icon on any Policy Brief, Infographic, Case Study, Publication,
                  Video, or Learning Module in the Knowledge Hub to save it here.
                </p>
                <Link
                  to="/knowledge-hub"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-marine px-4 py-2 text-xs font-semibold text-white hover:bg-marine/90"
                >
                  Browse Knowledge Hub <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {savedKhResources.map((r, idx) => (
                  <ResourceCard key={r.id} r={r} index={idx} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* 2. Enrolled / Active Self-Paced Courses Section */}
        {showCourses && (
          <section className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-marine" />
              <h2 className="font-display text-lg font-bold text-navy">
                {t("saved.courses")} ({myCourses.length})
              </h2>
            </div>

            {myCourses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
                <p className="text-sm font-bold text-navy">No active Self-Paced Courses yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Courses and modules you enroll in will automatically appear here.
                </p>
                <Link
                  to="/academy/self-paced"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-marine/40 px-4 py-1.5 text-xs font-semibold text-marine hover:bg-marine hover:text-white"
                >
                  Browse Self-Paced Courses <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {myCourses.map((c) => (
                  <Link
                    key={c.code}
                    to="/academy/self-paced/$code"
                    params={{ code: c.code }}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-marine/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-navy">{c.title}</p>
                        {c.completed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
                            <CheckCircle2 className="h-3 w-3" /> Completed
                            {c.score != null ? ` (${c.score}%)` : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/60">
                            <Clock className="h-3 w-3" /> In Progress
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.instructor} · {c.hours} Jam Belajar
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-marine" />
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 3. Bookmarked Events Section */}
        {showEvents && (
          <section className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-marine" />
              <h2 className="font-display text-lg font-bold text-navy">
                {t("saved.events")} ({bookmarkedEvents.length})
              </h2>
            </div>

            {bookmarkedEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
                <p className="text-sm font-bold text-navy">No bookmarked events yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Save upcoming conferences, webinars, or workshops from the Events directory.
                </p>
                <Link
                  to="/events"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-marine/40 px-4 py-1.5 text-xs font-semibold text-marine hover:bg-marine hover:text-white"
                >
                  Browse Events <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {bookmarkedEvents.map((e) => (
                  <div
                    key={e.slug}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-marine/50"
                  >
                    <Link
                      to="/events/$slug"
                      params={{ slug: e.slug }}
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate text-sm font-bold text-navy hover:text-marine">
                        {e.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {e.dateLabel} · {e.format} · {e.city}, {e.country}
                      </p>
                    </Link>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => savedEventsStore.toggle(e.slug)}
                        aria-label="Remove event from saved"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <Link to="/events/$slug" params={{ slug: e.slug }}>
                        <ArrowRight className="h-4 w-4 text-marine" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </PageShell>
  );
}

