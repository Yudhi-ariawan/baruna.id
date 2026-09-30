import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  Bookmark, Share2, Download, Play, Users, GraduationCap, CalendarDays, MessagesSquare,
  Building2, FileText, ArrowRight, ArrowLeft, AlertCircle, Eye, Clock, Layers, Award,
  BookOpen, Lock,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { Panel } from "@/components/baruna/page/primitives";
import {
  getResourceById, relatedResources, BEST_PRACTICE_STRUCTURE, CASE_STUDY_STRUCTURE, TOOLKIT_TOOLS,
} from "@/data/demo/knowledgeHub";
import {
  DEMO_EXPERTS, DEMO_CATEGORIES, DEMO_SHORT_COURSES, DEMO_EVENTS, DEMO_COMMUNITIES, DEMO_PARTNERS, DEMO_MODULES,
} from "@/data/demo";
import { masterByCode, masterByKhCode, MINUTES_PER_JP } from "@/data/masterModules";
import { useShortCourses } from "@/lib/shortCourses";
import { AccessNotificationModal } from "@/components/baruna/knowledge/AccessNotificationModal";
import { KH_SIDEBAR_META, knowledgeHubSidebarSections } from "@/data/khNav";
import { ResourceCard, DemoDataBadge, AccessBadge } from "@/components/baruna/knowledge/ResourceCard";
import { toggleSaved, useIsSaved, shareResource } from "@/lib/khSaved";
import { courseImages } from "@/data/pages";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/knowledge-hub_/resource/$id")({
  loader: async ({ params }) => {
    const demoResource = getResourceById(params.id);
    if (demoResource) return { resource: demoResource };

    const { data: m } = await supabase
      .from("module_registry")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();

    if (m) {
      let authorName = "BARUNA Trainer";
      if (m.author_expert_id) {
        const { data: exp } = await supabase
          .from("experts_directory_v")
          .select("display_name")
          .eq("id", m.author_expert_id)
          .maybeSingle();
        if (exp?.display_name) authorName = exp.display_name;
        else {
          const { data: prof } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", m.author_expert_id)
            .maybeSingle();
          if (prof?.display_name) authorName = prof.display_name;
        }
      }

      const resource: any = {
        id: m.id,
        type: "learning-modules",
        typeLabel: "Learning Module",
        title: m.title,
        category: "fisheries-management",
        summary: m.summary || "Approved BARUNA learning module connected to Self-Paced Courses.",
        abstract: m.summary || "Approved BARUNA learning module.",
        author: authorName,
        contributor: "BARUNA Academy",
        organization: "BARUNA Network",
        year: new Date(m.created_at).getFullYear(),
        language: m.language || "English",
        country: "Indonesia",
        keywords: ["Learning Module", "Self-Paced", m.title.toLowerCase()],
        access: "Completion Required",
        status: "Published",
        fileType: "Module Package",
        pages: (m.estimated_learning_hours || 2) * 12,
        version: "1.0",
        moduleCode: "BARUNA-MOD-01",
        shortCourseCode: m.id,
        expertId: m.author_expert_id || "",
        metrics: { views: 42, uniqueViewers: 18, downloads: 12, saves: 4, shares: 2 },
        citation: `${authorName} (${new Date(m.created_at).getFullYear()}). ${m.title}. BARUNA Knowledge Hub.`,
        createdAt: m.created_at,
        updatedAt: m.created_at,
      };

      return { resource };
    }

    throw notFound();
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Resource not found — BARUNA" }, { name: "robots", content: "noindex" }] };
    }
    const r = loaderData.resource;
    return {
      meta: [
        { title: `${r.title} — ${r.typeLabel} — BARUNA` },
        { name: "description", content: r.summary },
        { property: "og:title", content: r.title },
        { property: "og:description", content: r.summary },
      ],
      links: [{ rel: "canonical", href: `/knowledge-hub/resource/${r.id}` }],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-10 text-center">
      <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
      <h1 className="mt-3 font-display text-2xl font-bold text-navy">Resource not found</h1>
      <Link to="/knowledge-hub/$type" params={{ type: "library" }} className="mt-4 inline-flex rounded-xl bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground">Browse the Resource Library</Link>
    </div>
  ),
  errorComponent: ({ error }: { error: any }) => (
    <div className="mx-auto max-w-2xl p-10 text-center">
      <h1 className="font-display text-2xl font-bold text-navy">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error?.message || String(error)}</p>
    </div>
  ),
  component: ResourceDetailPage,
});

// Naive view-count store per-session (client-side only).
const VIEW_KEY = "baruna:kh-viewed";
function markViewed(id: string) {
  if (typeof window === "undefined") return;
  try {
    const set = new Set<string>(JSON.parse(sessionStorage.getItem(VIEW_KEY) ?? "[]") as string[]);
    if (!set.has(id)) {
      set.add(id);
      sessionStorage.setItem(VIEW_KEY, JSON.stringify([...set]));
    }
  } catch { /* ignore */ }
}

function ResourceDetailPage() {
  const { resource: r } = Route.useLoaderData();
  const saved = useIsSaved(r.id);
  useEffect(() => { markViewed(r.id); }, [r.id]);

  const expert = DEMO_EXPERTS.find((e) => e.id === r.expertId);
  const category = DEMO_CATEGORIES.find((c) => c.slug === r.category);
  const module = r.moduleCode ? DEMO_MODULES.find((m) => m.code === r.moduleCode) : undefined;
  const course = r.shortCourseCode ? DEMO_SHORT_COURSES.find((c) => c.code === r.shortCourseCode) : undefined;
  // Fisheries master module lookup (13 modules): resolve by KH code OR SC code.
  const masterModule =
    (r.moduleCode && masterByKhCode[r.moduleCode]) ||
    (r.shortCourseCode && masterByCode[r.shortCourseCode]) ||
    undefined;
  const { isCompleted, priorLearning } = useShortCourses();
  const scCompleted = masterModule ? isCompleted(masterModule.code) : false;
  const scPrior = masterModule ? priorLearning(masterModule.code) : false;
  const event = r.relatedEventId ? DEMO_EVENTS.find((e) => e.id === r.relatedEventId) : undefined;
  const community = r.relatedCommunitySlug ? DEMO_COMMUNITIES.find((c) => c.slug === r.relatedCommunitySlug) : undefined;
  const partner = r.relatedPartnerSlug ? DEMO_PARTNERS.find((p) => p.slug === r.relatedPartnerSlug) : undefined;
  const related = useMemo(() => relatedResources(r, 4), [r]);

  const cover = courseImages[(r.id.charCodeAt(r.id.length - 1)) % courseImages.length];
  const canDownload = r.access === "Public Access";

  // Gated-access modal state (shown when a locked module action is clicked).
  const [gateOpen, setGateOpen] = useState(false);
  const gated = r.type === "learning-modules" && !!masterModule && !scCompleted;

  return (
    <PageShell
      sidebar={{ ...KH_SIDEBAR_META, sections: knowledgeHubSidebarSections(r.type) }}
      cta={{
        icon: BookOpen,
        title: "Contribute to the Knowledge Hub",
        description: "Verified experts, trainers, and partners may submit resources.",
        button: "Submit a Resource",
        href: "/knowledge-hub/submit-resource",
      }}
    >
      <div className="space-y-6">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link to="/knowledge-hub" className="hover:text-marine">Knowledge Hub</Link>
          <span className="mx-1.5">/</span>
          <Link to="/knowledge-hub/$type" params={{ type: r.type }} className="hover:text-marine">{r.typeLabel}s</Link>
          <span className="mx-1.5">/</span>
          <span className="font-semibold text-navy">{r.title}</span>
        </nav>

        <Link to="/knowledge-hub/$type" params={{ type: r.type }} className="inline-flex items-center gap-1 text-xs font-semibold text-marine">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {r.typeLabel}s
        </Link>

        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Panel className="overflow-hidden p-0">
              <div className="relative h-56 sm:h-72">
                <img src={cover} alt={r.title} className="h-full w-full object-cover" width={1600} height={720} />
                <div className="absolute inset-0 bg-gradient-to-t from-navy/85 to-transparent" />
                <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
                  <span className="inline-flex rounded-md bg-navy px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-navy-foreground">{r.typeLabel}</span>
                  {r.id.startsWith("pub-") || r.id.startsWith("lm-") || r.id.startsWith("bp-") || r.id.startsWith("vid-") || r.id.startsWith("pb-") || r.id.startsWith("info-") || r.id.startsWith("cs-") || r.id.startsWith("tk-") || r.id.startsWith("res-") ? (
                    <DemoDataBadge />
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-green-500/15 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-green-700">
                      Verified Module
                    </span>
                  )}
                </div>
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 text-navy-foreground">
                  <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{r.title}</h1>
                  <p className="mt-1 text-xs text-navy-foreground/80">{r.author} · {r.organization} · {r.year} · {r.language}</p>
                </div>
                {r.type === "videos" && (
                  <button className="absolute inset-0 grid place-items-center" aria-label="Play video">
                    <span className="grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-110">
                      <Play className="h-7 w-7" />
                    </span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-border p-4">
                <AccessBadge level={r.access} />
                {category && (
                  <Link to="/academy/category/$slug" params={{ slug: category.slug }} className="inline-flex rounded-md bg-muted px-2 py-1 text-[0.7rem] font-semibold text-navy hover:bg-marine/10">
                    {category.name}
                  </Link>
                )}
                <span className="ml-auto flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleSaved(r.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${saved ? "border-marine bg-marine text-marine-foreground" : "border-border text-marine hover:border-marine"}`}
                  >
                    <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} /> {saved ? "Saved" : "Save"}
                  </button>
                  <button
                    onClick={() => void shareResource(r.title, `/knowledge-hub/resource/${r.id}`)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-marine hover:border-marine"
                  >
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </button>
                  {r.type === "learning-modules" && masterModule ? (
                    scCompleted ? (
                      <Link to="/academy/self-paced/$code" params={{ code: masterModule.code }} className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white">
                        <Award className="h-3.5 w-3.5" /> Completed · View Certificate
                      </Link>
                    ) : (
                      <button
                        onClick={() => setGateOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-3 py-2 text-xs font-semibold text-marine-foreground"
                      >
                        <Lock className="h-3.5 w-3.5" /> Start Module
                      </button>
                    )
                  ) : r.type === "learning-modules" ? (
                    <Link to="/academy/self-paced/$code" params={{ code: r.shortCourseCode || (course ? course.code : r.id) }} className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-3 py-2 text-xs font-semibold text-marine-foreground">
                      <GraduationCap className="h-3.5 w-3.5" /> Take the Self-Paced Course
                    </Link>
                  ) : canDownload ? (
                    <button className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-3 py-2 text-xs font-semibold text-marine-foreground">
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                  ) : (
                    <button disabled className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground" title={`${r.access} — sign-in required`}>
                      <AlertCircle className="h-3.5 w-3.5" /> {r.access}
                    </button>
                  )}
                </span>
              </div>
            </Panel>

            <Panel>
              <h2 className="font-display text-base font-bold text-navy">Abstract</h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/85">{r.abstract}</p>
              <p className="mt-3 text-sm leading-relaxed text-foreground/85">{r.summary}</p>
            </Panel>

            {r.type === "learning-modules" && masterModule && (
              <Panel>
                {scPrior && (
                  <div className="mb-3 rounded-xl border border-green-600/40 bg-green-600/10 p-3 text-xs font-semibold text-green-800">
                    Prior Learning Recognised — you completed this module inside the Full Training Program.
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-navy px-2 py-1 text-[0.65rem] font-bold text-navy-foreground">{masterModule.khCode}</span>
                  <span className="rounded-md bg-marine/10 px-2 py-1 text-[0.65rem] font-semibold text-marine">{masterModule.subCategory}</span>
                  <span className="rounded-md bg-muted px-2 py-1 text-[0.65rem] font-semibold text-navy">{masterModule.level}</span>
                  <span className="rounded-md bg-muted px-2 py-1 text-[0.65rem] font-semibold text-navy">{masterModule.language}</span>
                </div>
                <h2 className="mt-3 font-display text-base font-bold text-navy">Learning Objectives</h2>
                <ul className="mt-2 space-y-1 text-sm text-foreground/85">
                  {masterModule.objectives.map((o: string, i: number) => (
                    <li key={i} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-marine" />{o}</li>
                  ))}
                </ul>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Instructional Hours" value={`${masterModule.hours}h`} />
                  <Stat label="Jam Pelajaran" value={`${masterModule.jp} JP`} icon={Clock} />
                  <Stat label="Self-Paced Course" value={masterModule.code} />
                  <Stat label="Version" value={masterModule.version} />
                </div>
                <div className="mt-4 rounded-xl border border-marine/30 bg-marine/5 p-3 text-xs text-navy">
                  <p className="font-semibold">Also part of the Full Training Program</p>
                  <p className="mt-1 text-foreground/80">
                    This module is included in the <strong>International Training on Fisheries for African Countries</strong>
                    {masterModule.pathways.length > 0 && (
                      <> · Pathway: {masterModule.pathways.join(", ")}</>
                    )}
                    <> · 1 JP = {MINUTES_PER_JP} minutes</>
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => (gated ? setGateOpen(true) : undefined)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-marine/40 bg-card px-3 py-2 text-xs font-semibold text-marine hover:border-marine"
                  >
                    <BookOpen className="h-3.5 w-3.5" /> Open Learning Materials
                  </button>
                  <button
                    onClick={() => (gated ? setGateOpen(true) : undefined)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-marine/40 bg-card px-3 py-2 text-xs font-semibold text-marine hover:border-marine"
                  >
                    <Download className="h-3.5 w-3.5" /> Download Module
                  </button>
                  <button
                    onClick={() => (gated ? setGateOpen(true) : undefined)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-marine/40 bg-card px-3 py-2 text-xs font-semibold text-marine hover:border-marine"
                  >
                    <FileText className="h-3.5 w-3.5" /> Take Assessment
                  </button>
                </div>
              </Panel>
            )}

            {r.type === "learning-modules" && !masterModule && module && (
              <Panel>
                <h2 className="font-display text-base font-bold text-navy">Learning Outcomes</h2>
                <ul className="mt-2 space-y-1 text-sm text-foreground/85">
                  {module.learningOutcomes.map((o, i) => (
                    <li key={i} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-marine" />{o}</li>
                  ))}
                </ul>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Instructional Hours" value={`${module.instructionalHours}h`} />
                  <Stat label="Version" value={module.version} />
                  <Stat label="Enrollments" value={course ? course.enrollments.toLocaleString() : "—"} />
                  <Stat label="Completion" value={course ? `${course.completionRatePct}%` : "—"} />
                </div>
              </Panel>
            )}

            {r.type === "best-practices" && (
              <Panel>
                <h2 className="font-display text-base font-bold text-navy">Practice Structure</h2>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field term="Challenge" desc={BEST_PRACTICE_STRUCTURE.challenge} />
                  <Field term="Context" desc={BEST_PRACTICE_STRUCTURE.context} />
                  <Field term="Intervention" desc={BEST_PRACTICE_STRUCTURE.intervention} />
                  <Field term="Steps" desc={BEST_PRACTICE_STRUCTURE.steps.join(" → ")} />
                  <Field term="Stakeholders" desc={BEST_PRACTICE_STRUCTURE.stakeholders.join(", ")} />
                  <Field term="Results" desc={BEST_PRACTICE_STRUCTURE.results} />
                  <Field term="Lessons" desc={BEST_PRACTICE_STRUCTURE.lessons} />
                  <Field term="Replication" desc={BEST_PRACTICE_STRUCTURE.replication} />
                </dl>
              </Panel>
            )}

            {r.type === "case-studies" && (
              <Panel>
                <h2 className="font-display text-base font-bold text-navy">Case Study</h2>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field term="Background" desc={CASE_STUDY_STRUCTURE.background} />
                  <Field term="Problem" desc={CASE_STUDY_STRUCTURE.problem} />
                  <Field term="Intervention" desc={CASE_STUDY_STRUCTURE.intervention} />
                  <Field term="Process" desc={CASE_STUDY_STRUCTURE.process.join(" → ")} />
                  <Field term="Results" desc={CASE_STUDY_STRUCTURE.results} />
                  <Field term="Challenges" desc={CASE_STUDY_STRUCTURE.challenges.join(", ")} />
                  <Field term="Lessons" desc={CASE_STUDY_STRUCTURE.lessons} />
                  <Field term="Recommendations" desc={CASE_STUDY_STRUCTURE.recommendations} />
                </dl>
              </Panel>
            )}

            {r.type === "toolkits" && (
              <Panel>
                <h2 className="font-display text-base font-bold text-navy">Included Tools</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {TOOLKIT_TOOLS.map((t) => (
                    <div key={t} className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm">
                      <Layers className="h-4 w-4 text-marine" /> {t}
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {r.type === "policy-briefs" && (
              <Panel>
                <h2 className="font-display text-base font-bold text-navy">Policy Brief</h2>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field term="Policy Issue" desc={`Advancing ${category?.name.toLowerCase()} practice across the region.`} />
                  <Field term="Key Findings" desc="Practitioner surveys highlight recurring capacity gaps addressed by BARUNA training." />
                  <Field term="Recommended Actions" desc="Fund national trainer cohorts and mainstream BARUNA modules into partner curricula." />
                  <Field term="Intended Audience" desc="Ministry staff, donor partners, and civil-society leaders." />
                </dl>
              </Panel>
            )}

            {r.type === "videos" && (
              <Panel>
                <h2 className="font-display text-base font-bold text-navy">Video Details</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Duration" value={r.duration ?? "—"} />
                  <Stat label="Type" value={r.videoKind ?? "Video"} />
                  <Stat label="Speaker" value={r.speaker ?? "—"} />
                  <Stat label="Language" value={r.language} />
                </div>
                <button className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-marine hover:border-marine">
                  <FileText className="h-3.5 w-3.5" /> View Transcript
                </button>
              </Panel>
            )}

            <Panel>
              <h2 className="font-display text-base font-bold text-navy">Related Resources</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((rr, i) => <ResourceCard key={rr.id} r={rr} index={i} />)}
              </div>
            </Panel>
          </div>

          <aside className="space-y-5">
            {expert && (
              <Panel>
                <h3 className="font-display text-sm font-bold text-navy">Related Expert</h3>
                <Link to="/experts/$slug" params={{ slug: expert.slug }} className="mt-2 flex items-center gap-3 rounded-lg p-1 hover:bg-muted">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-marine/10 font-bold text-marine">
                    {expert.fullName.split(" ").slice(-2).map((s) => s[0]).join("")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy">{expert.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">{expert.title}</p>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 text-marine" />
                </Link>
              </Panel>
            )}

            <Panel>
              <h3 className="font-display text-sm font-bold text-navy">Connected Learning</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {masterModule ? (
                  <RelLink to="/academy/self-paced/$code" params={{ code: masterModule.code }} icon={GraduationCap}
                    title="Related Self-Paced Course" subtitle={`${masterModule.code} · ${masterModule.shortCourseTitle}`} />
                ) : course && (
                  <RelLink to="/academy/self-paced/$code" params={{ code: course.code }} icon={GraduationCap}
                    title="Related Self-Paced Course" subtitle={course.title} />
                )}
                {!masterModule && module && (
                  <RelLink to="/academy/self-paced/$code" params={{ code: module.code }} icon={Award}
                    title="Master Module" subtitle={`${module.code} · ${module.title}`} />
                )}
                {r.trainingProgram && (
                  <RelLink to="/academy/training/$slug" params={{ slug: "international-training-fisheries-african-countries" }} icon={Users}
                    title="Training Program" subtitle={r.trainingProgram} />
                )}
                {event && (
                  <RelLink to="/events/$slug" params={{ slug: event.slug }} icon={CalendarDays}
                    title="Related Event" subtitle={event.title} />
                )}
                {community && (
                  <RelLink to="/community" icon={MessagesSquare} title="Community of Practice" subtitle={community.name} />
                )}
                {partner && (
                  <RelLink to="/partnership" icon={Building2} title="Partner" subtitle={partner.name} />
                )}
                {r.relatedArchive && (
                  <RelLink to="/academy/archive" icon={FileText} title="Training Archive" subtitle={r.relatedArchive} />
                )}
              </ul>
            </Panel>

            <Panel>
              <h3 className="font-display text-sm font-bold text-navy">Resource Analytics</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Stat label="Views" value={r.metrics.views.toLocaleString()} icon={Eye} />
                <Stat label="Unique" value={r.metrics.uniqueViewers.toLocaleString()} icon={Users} />
                <Stat label="Downloads" value={r.metrics.downloads.toLocaleString()} icon={Download} />
                <Stat label="Saves" value={r.metrics.saves.toLocaleString()} icon={Bookmark} />
              </div>
              <Link to="/analytics" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-marine">
                Open Analytics <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Panel>

            <Panel>
              <h3 className="font-display text-sm font-bold text-navy">File & Metadata</h3>
              <dl className="mt-3 space-y-1.5 text-xs text-foreground/80">
                <MetaRow k="File type" v={r.fileType} />
                {r.fileSize && <MetaRow k="File size" v={r.fileSize} />}
                {r.pages && <MetaRow k="Pages" v={String(r.pages)} />}
                {r.duration && <MetaRow k="Duration" v={r.duration} />}
                <MetaRow k="Version" v={r.version} />
                <MetaRow k="Country" v={r.country} />
                <MetaRow k="Updated" v={r.updatedAt} />
              </dl>
            </Panel>

            <Panel>
              <h3 className="font-display text-sm font-bold text-navy">Keywords</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.keywords.map((k: string) => (
                  <span key={k} className="inline-flex rounded-full bg-marine/10 px-2 py-0.5 text-[0.65rem] font-semibold text-marine">{k}</span>
                ))}
              </div>
            </Panel>

            <Panel>
              <h3 className="font-display text-sm font-bold text-navy">Citation</h3>
              <p className="mt-2 text-xs text-foreground/80">{r.citation}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => { if (typeof navigator !== "undefined") navigator.clipboard?.writeText(r.citation); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[0.7rem] font-semibold text-marine hover:border-marine"
                >
                  Copy citation
                </button>
                <button className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[0.7rem] font-semibold text-muted-foreground hover:text-destructive">
                  Report an issue
                </button>
              </div>
            </Panel>
          </aside>
        </div>
      </div>
      <AccessNotificationModal
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        master={masterModule}
        moduleTitle={r.title}
      />
    </PageShell>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border border-border p-2 text-center">
      {Icon && <Icon className="mx-auto h-4 w-4 text-marine" />}
      <p className="mt-1 font-display text-sm font-extrabold text-navy">{value}</p>
      <p className="text-[0.65rem] text-muted-foreground">{label}</p>
    </div>
  );
}
function Field({ term, desc }: { term: string; desc: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{term}</dt>
      <dd className="mt-1 text-sm text-foreground/85">{desc}</dd>
    </div>
  );
}
function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium text-navy">{v}</dd>
    </div>
  );
}
type RelLinkProps = {
  to: string;
  params?: Record<string, string>;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
};
function RelLink({ to, params, icon: Icon, title, subtitle }: RelLinkProps) {
  const el = (
    <>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-marine/10 text-marine">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
        <span className="block truncate text-sm font-semibold text-navy">{subtitle}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-marine" />
    </>
  );
  return (
    <li>
      <Link to={to as string} params={params as never} className="flex items-center gap-2 rounded-lg border border-border p-2 transition-colors hover:border-marine/40 hover:bg-muted">
        {el}
      </Link>
    </li>
  );
}
