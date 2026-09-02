import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Plus,
  FileText,
  Eye,
  Pencil,
  RotateCcw,
  Trash2,
  Globe,
  CheckCircle2,
  Clock,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import {
  useResources,
  deleteResource,
  resubmitResource,
  formatDate,
  formatBytes,
  REVIEW_PIPELINE,
  STATUS_STYLES,
  type Resource,
  type ResourceStatus,
} from "@/lib/resources";

export const Route = createFileRoute("/knowledge-hub_/my-contributions")({
  head: () => ({
    meta: [
      { title: "My Contributions — Knowledge Hub — BARUNA" },
      {
        name: "description",
        content: "Track all the resources you have submitted to the BARUNA Knowledge Hub.",
      },
    ],
    links: [{ rel: "canonical", href: "/knowledge-hub/my-contributions" }],
  }),
  component: MyContributionsPage,
});

const STATUS_ICON: Record<ResourceStatus, LucideIcon> = {
  Draft: FileText,
  Submitted: Clock,
  "Under Review": Clock,
  Published: CheckCircle2,
  "Revision Required": AlertTriangle,
};

function StatusBadge({ status }: { status: ResourceStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[status]}`}>
      <Icon className="h-3.5 w-3.5" /> {status}
    </span>
  );
}

function Pipeline({ status }: { status: ResourceStatus }) {
  // Revision Required branches off "Under Review".
  const revision = status === "Revision Required";
  const reachedIndex = revision
    ? REVIEW_PIPELINE.indexOf("Under Review")
    : REVIEW_PIPELINE.indexOf(status);
  return (
    <div className="mt-3 flex items-center gap-1">
      {REVIEW_PIPELINE.map((stage, i) => {
        const reached = i <= reachedIndex;
        return (
          <div key={stage} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <span className={`h-2.5 w-2.5 rounded-full ${reached ? "bg-marine" : "bg-muted"}`} />
            </div>
            {i < REVIEW_PIPELINE.length - 1 && (
              <span className={`h-px flex-1 ${i < reachedIndex ? "bg-marine" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ContributionCard({ r }: { r: Resource }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.65rem] font-bold uppercase tracking-wide text-marine">{r.type}</span>
            {r.topicCategory && (
              <span className="text-[0.65rem] text-muted-foreground">· {r.topicCategory}</span>
            )}
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-navy">{r.title || "Untitled resource"}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>
        </div>
        <StatusBadge status={r.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {r.institution && <span>{r.institution}</span>}
        {r.country && <span>· {r.country}</span>}
        {r.file && <span>· {r.file.name} ({formatBytes(r.file.size)})</span>}
        <span>· Updated {formatDate(r.updatedAt)}</span>
      </div>

      {r.status !== "Draft" && <Pipeline status={r.status} />}

      {r.status === "Revision Required" && r.reviewNote && (
        <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <strong>Reviewer note:</strong> {r.reviewNote}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <Link
          to="/knowledge-hub/submit-resource"
          search={{ edit: r.id }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-muted"
        >
          <Eye className="h-3.5 w-3.5" /> View
        </Link>
        <Link
          to="/knowledge-hub/submit-resource"
          search={{ edit: r.id }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-muted"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
        {r.status === "Revision Required" && (
          <button
            type="button"
            onClick={() => resubmitResource(r.id)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-marine-foreground transition-colors hover:bg-navy"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Resubmit
          </button>
        )}
        {r.status === "Draft" && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this draft? This cannot be undone.")) deleteResource(r.id);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete Draft
          </button>
        )}
      </div>
    </article>
  );
}

function MyContributionsPage() {
  const resources = useResources();
  const counts = {
    total: resources.length,
    published: resources.filter((r) => r.status === "Published").length,
    review: resources.filter((r) => r.status === "Under Review" || r.status === "Submitted").length,
    drafts: resources.filter((r) => r.status === "Draft").length,
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link to="/knowledge-hub" className="inline-flex items-center gap-1.5 text-sm font-semibold text-marine transition-colors hover:text-navy">
          <ArrowLeft className="h-4 w-4" /> Knowledge Hub
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">My Contributions</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Track all the resources you have submitted to the Knowledge Hub and manage their review status.
            </p>
          </div>
          <Link
            to="/knowledge-hub/submit-resource"
            className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
          >
            <Plus className="h-4 w-4" /> Submit Resource
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total", value: counts.total },
            { label: "Published", value: counts.published },
            { label: "In Review", value: counts.review },
            { label: "Drafts", value: counts.drafts },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center shadow-soft">
              <p className="font-display text-2xl font-extrabold text-navy">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {resources.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <Globe className="mx-auto h-8 w-8 text-marine" />
              <p className="mt-3 font-display text-lg font-bold text-navy">No contributions yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Share your first publication, learning material, or best practice with the global community.
              </p>
              <Link to="/knowledge-hub/submit-resource" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy">
                <Plus className="h-4 w-4" /> Submit a Resource
              </Link>
            </div>
          ) : (
            resources.map((r) => <ContributionCard key={r.id} r={r} />)
          )}
        </div>
      </main>
    </div>
  );
}
