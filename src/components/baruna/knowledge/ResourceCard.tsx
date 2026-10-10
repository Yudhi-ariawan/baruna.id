import { Link } from "@tanstack/react-router";
import { Bookmark, Share2, Eye, Play, Clock, GraduationCap, ArrowRight, Download } from "lucide-react";
import { courseImages } from "@/data/pages";
import { useIsSaved, toggleSaved, shareResource } from "@/lib/khSaved";
import { DEMO_CATEGORIES } from "@/data/demo";
import type { KhResource } from "@/data/demo/knowledgeHub";
import { MODULE_CATEGORY_LABELS } from "@/lib/academy/module-categories";

function categoryName(slug: string) {
  return MODULE_CATEGORY_LABELS[slug] ?? DEMO_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}

export function DemoDataBadge() {
  return null;
}

export function AccessBadge({ level }: { level: KhResource["access"] }) {
  const map: Record<string, string> = {
    "Public Access": "bg-eco-community/15 text-eco-community",
    "Registered User": "bg-badge-course/15 text-badge-course",
    "Course Participant": "bg-badge-workshop/15 text-badge-workshop",
    "Completion Required": "bg-eco-knowledge/15 text-eco-knowledge",
    "Restricted Internal": "bg-destructive/10 text-destructive",
  };
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide ${map[level]}`}>
      {level}
    </span>
  );
}

export function ResourceCard({ r, index }: { r: KhResource; index: number; demo?: boolean }) {
  const saved = useIsSaved(r.id);
  const fallbackCover = r.id === "01b19c79-d63a-4ad1-b585-3386820a0cba"
    ? "/sample-module-files/Course_Cover_Image.jpg"
    : courseImages[index % courseImages.length];
  const cover = r.coverImage || fallbackCover;
  const isVideo = r.type === "videos";
  const isModule = r.type === "learning-modules";

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-hover">
      <Link to="/knowledge-hub/resource/$id" params={{ id: r.id }} className="relative block h-36 shrink-0 overflow-hidden">
        <img
          src={cover}
          alt={r.title}
          loading="lazy"
          width={768}
          height={512}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          onError={(e) => {
            const fallback = fallbackCover;
            if (e.currentTarget.src !== fallback) {
              e.currentTarget.src = fallback;
            }
          }}
        />
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-2">
          <span className="inline-flex max-w-[65%] rounded-md bg-navy px-2 py-1 text-[0.6rem] font-bold uppercase leading-tight tracking-wide text-navy-foreground shadow-sm">
            {r.typeLabel}
          </span>
          {!r.id.includes("-") || r.id.length > 20 ? (
            <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-emerald-600/90 px-2 py-1 text-[0.55rem] font-bold uppercase leading-none tracking-wider text-white shadow-sm backdrop-blur-sm">
              Verified
            </span>
          ) : null}
        </div>
        {isVideo && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-navy/85 px-1.5 py-0.5 text-[0.6rem] font-semibold text-navy-foreground">
            <Play className="h-3 w-3 fill-current" /> {r.duration || r.videoKind || "Video"}
          </span>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col p-4 pb-5">
        <Link to="/knowledge-hub/resource/$id" params={{ id: r.id }} className="line-clamp-2 min-h-[2.75rem] font-display text-sm font-bold text-navy hover:text-marine">
          {r.title}
        </Link>
        <p className="mt-2 line-clamp-2 min-h-8 text-xs text-muted-foreground">{r.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <AccessBadge level={r.access} />
          <span className="inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[0.6rem] font-semibold text-foreground/70">
            {categoryName(r.category)}
          </span>
        </div>
        <p className="mt-2 text-xs font-medium text-navy">{r.author}</p>
        <p className="text-[0.7rem] text-muted-foreground">{r.organization} · {r.year} · {r.language}</p>
        {isModule && (r.learningHours || r.moduleCode) && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] text-muted-foreground">
            {r.learningHours ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {r.learningHours} Jam Belajar
              </span>
            ) : null}
            {r.moduleCode ? (
              <span className="inline-flex items-center gap-1">
                <GraduationCap className="h-3 w-3" /> {r.moduleCode}
              </span>
            ) : null}
          </div>
        )}
        {isVideo && r.speaker && (
          <p className="mt-1 text-[0.7rem] text-muted-foreground">Speaker: {r.speaker}</p>
        )}
        <div className="mt-auto border-t border-border/70 pt-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Eye className="h-3 w-3 shrink-0" /> {r.metrics.views.toLocaleString()} views
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Download className="h-3 w-3 shrink-0" /> {r.metrics.downloads.toLocaleString()} downloads
            </span>
          </div>
          <div className="mt-2 flex w-full items-center justify-end gap-1.5">
            <button
              type="button"
              aria-label={saved ? "Remove from saved" : "Save resource"}
              onClick={(e) => { e.preventDefault(); toggleSaved(r.id); }}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border transition-colors ${saved ? "bg-marine text-marine-foreground" : "text-marine hover:bg-marine hover:text-marine-foreground"}`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />
            </button>
            <button
              type="button"
              aria-label="Share resource"
              onClick={(e) => { e.preventDefault(); void shareResource(r.title, `/knowledge-hub/resource/${r.id}`); }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
            <Link
              to="/knowledge-hub/resource/$id"
              params={{ id: r.id }}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-marine px-3 py-1.5 text-[0.7rem] font-semibold text-marine-foreground transition-transform hover:-translate-y-0.5"
            >
              View <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
