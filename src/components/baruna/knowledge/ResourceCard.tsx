import { Link } from "@tanstack/react-router";
import { Bookmark, Share2, Eye, Play, Clock, GraduationCap, ArrowRight } from "lucide-react";
import { courseImages } from "@/data/pages";
import { useIsSaved, toggleSaved, shareResource } from "@/lib/khSaved";
import { DEMO_CATEGORIES } from "@/data/demo";
import type { KhResource } from "@/data/demo/knowledgeHub";

function categoryName(slug: string) {
  return DEMO_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}

export function DemoDataBadge() {
  return (
    <span className="inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-amber-700">
      Demo Data
    </span>
  );
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

export function ResourceCard({ r, index }: { r: KhResource; index: number }) {
  const saved = useIsSaved(r.id);
  const cover = courseImages[index % courseImages.length];
  const isVideo = r.type === "videos";
  const isModule = r.type === "learning-modules";

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-hover">
      <Link to="/knowledge-hub/resource/$id" params={{ id: r.id }} className="relative block h-36 overflow-hidden">
        <img src={cover} alt={r.title} loading="lazy" width={768} height={512} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
          <span className="inline-flex rounded-md bg-navy px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-navy-foreground">
            {r.typeLabel}
          </span>
          <DemoDataBadge />
        </div>
        {isVideo && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-navy/85 px-1.5 py-0.5 text-[0.6rem] font-semibold text-navy-foreground">
            <Play className="h-3 w-3" /> {r.duration}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link to="/knowledge-hub/resource/$id" params={{ id: r.id }} className="line-clamp-2 min-h-[2.75rem] font-display text-sm font-bold text-navy hover:text-marine">
          {r.title}
        </Link>
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{r.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <AccessBadge level={r.access} />
          <span className="inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[0.6rem] font-semibold text-foreground/70">
            {categoryName(r.category)}
          </span>
        </div>
        <p className="mt-2 text-xs font-medium text-navy">{r.author}</p>
        <p className="text-[0.7rem] text-muted-foreground">{r.organization} · {r.year} · {r.language}</p>
        {isModule && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {r.pages ? `${Math.round((r.pages ?? 0) / 12)}h instruction` : ""}</span>
            <span className="inline-flex items-center gap-1"><GraduationCap className="h-3 w-3" /> {r.moduleCode}</span>
          </div>
        )}
        {isVideo && r.speaker && (
          <p className="mt-1 text-[0.7rem] text-muted-foreground">Speaker: {r.speaker}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground">
            <Eye className="h-3 w-3" /> {r.metrics.views.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={saved ? "Remove from saved" : "Save resource"}
              onClick={(e) => { e.preventDefault(); toggleSaved(r.id); }}
              className={`grid h-8 w-8 place-items-center rounded-full border border-border transition-colors ${saved ? "bg-marine text-marine-foreground" : "text-marine hover:bg-marine hover:text-marine-foreground"}`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />
            </button>
            <button
              type="button"
              aria-label="Share resource"
              onClick={(e) => { e.preventDefault(); void shareResource(r.title, `/knowledge-hub/resource/${r.id}`); }}
              className="grid h-8 w-8 place-items-center rounded-full border border-border text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
            <Link
              to="/knowledge-hub/resource/$id"
              params={{ id: r.id }}
              className="inline-flex items-center gap-1 rounded-full bg-marine px-3 py-1.5 text-[0.7rem] font-semibold text-marine-foreground transition-transform hover:-translate-y-0.5"
            >
              View <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
