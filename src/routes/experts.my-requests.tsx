import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Plus,
  Eye,
  Trash2,
  UserPlus,
  CheckCircle2,
  Clock,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import {
  useRequests,
  deleteRequest,
  formatDate,
  REQUEST_PIPELINE,
  REQUEST_TYPE_CONFIG,
  REQUEST_STATUS_STYLES,
  type ExpertRequest,
  type RequestStatus,
} from "@/lib/experts";

export const Route = createFileRoute("/experts/my-requests")({
  head: () => ({
    meta: [
      { title: "My Requests — BARUNA Experts" },
      {
        name: "description",
        content: "Track all the expert requests you have submitted to the BARUNA network.",
      },
    ],
    links: [{ rel: "canonical", href: "/experts/my-requests" }],
  }),
  component: MyRequestsPage,
});

const STATUS_ICON: Record<RequestStatus, LucideIcon> = {
  Draft: Eye,
  Submitted: Clock,
  "Under Review": Clock,
  "Expert Matching": Users,
  Confirmed: UserCog,
  Completed: CheckCircle2,
};

function StatusBadge({ status }: { status: RequestStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${REQUEST_STATUS_STYLES[status]}`}
    >
      <Icon className="h-3.5 w-3.5" /> {status}
    </span>
  );
}

function Pipeline({ status }: { status: RequestStatus }) {
  const reachedIndex = REQUEST_PIPELINE.indexOf(status);
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1">
        {REQUEST_PIPELINE.map((stage, i) => {
          const reached = i <= reachedIndex;
          return (
            <div key={stage} className="flex flex-1 items-center">
              <span className={`h-2.5 w-2.5 rounded-full ${reached ? "bg-marine" : "bg-muted"}`} />
              {i < REQUEST_PIPELINE.length - 1 && (
                <span className={`h-px flex-1 ${i < reachedIndex ? "bg-marine" : "bg-muted"}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[0.6rem] font-medium text-muted-foreground">
        {REQUEST_PIPELINE.map((stage) => (
          <span key={stage} className="flex-1 text-center first:text-left last:text-right">
            {stage}
          </span>
        ))}
      </div>
    </div>
  );
}

function summaryFor(r: ExpertRequest): string {
  const v = r.values;
  return (
    v.eventName ||
    v.trainingTitle ||
    v.subjectArea ||
    v.objective ||
    v.technicalIssue ||
    "Expert request"
  );
}

function RequestCard({ r }: { r: ExpertRequest }) {
  const config = REQUEST_TYPE_CONFIG[r.type];
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.65rem] font-bold uppercase tracking-wide text-marine">
              {config.label}
            </span>
            <span className="text-[0.65rem] text-muted-foreground">· {r.id}</span>
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-navy">{summaryFor(r)}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {r.values.organization || "—"}
            {r.values.country ? ` · ${r.values.country}` : ""}
          </p>
        </div>
        <StatusBadge status={r.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Submitted {formatDate(r.createdAt)}</span>
        <span>
          · Assigned Expert:{" "}
          <span className="font-semibold text-navy">{r.assignedExpert || "To be matched"}</span>
        </span>
      </div>

      {r.status !== "Draft" && <Pipeline status={r.status} />}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <Link
          to="/experts/request"
          search={{ type: r.type }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-muted"
        >
          <Eye className="h-3.5 w-3.5" /> View Details
        </Link>
        {r.status === "Draft" && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this draft request? This cannot be undone.")) deleteRequest(r.id);
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

function MyRequestsPage() {
  const requests = useRequests();
  const counts = {
    total: requests.length,
    active: requests.filter(
      (r) => r.status !== "Draft" && r.status !== "Completed",
    ).length,
    confirmed: requests.filter((r) => r.status === "Confirmed" || r.status === "Completed").length,
    drafts: requests.filter((r) => r.status === "Draft").length,
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          to="/experts"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-marine transition-colors hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> Experts
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">My Requests</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Track all the expert requests you have submitted and follow their matching progress.
            </p>
          </div>
          <Link
            to="/experts/request"
            className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
          >
            <Plus className="h-4 w-4" /> Request an Expert
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total", value: counts.total },
            { label: "Active", value: counts.active },
            { label: "Confirmed", value: counts.confirmed },
            { label: "Drafts", value: counts.drafts },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center shadow-soft">
              <p className="font-display text-2xl font-extrabold text-navy">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {requests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <UserPlus className="mx-auto h-8 w-8 text-marine" />
              <p className="mt-3 font-display text-lg font-bold text-navy">No requests yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Request a speaker, trainer, reviewer, mentor, or technical assistance from the BARUNA
                network.
              </p>
              <Link
                to="/experts/request"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
              >
                <Plus className="h-4 w-4" /> Request an Expert
              </Link>
            </div>
          ) : (
            requests.map((r) => <RequestCard key={r.id} r={r} />)
          )}
        </div>
      </main>
    </div>
  );
}
