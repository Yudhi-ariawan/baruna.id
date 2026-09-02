import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  Mail,
  Phone,
  Globe,
  Building2,
  MapPin,
  Users,
  Calendar,
  Languages as LanguagesIcon,
} from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import {
  useRequest,
  deleteRequest,
  formatDate,
  STATUS_STYLES,
  TIMELINE_STAGES,
  timelineReachedIndex,
} from "@/lib/trainingRequests";

export const Route = createFileRoute("/academy/training-requests/$id")({
  head: () => ({
    meta: [
      { title: "Training Request — Academy — BARUNA" },
      { name: "description", content: "View the status timeline of your BARUNA training request." },
    ],
  }),
  component: TrainingRequestDetailPage,
});

function TrainingRequestDetailPage() {
  const { id } = useParams({ from: Route.id });
  const request = useRequest(id);

  if (!request) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <h1 className="font-display text-2xl font-extrabold text-navy">Request not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This training request may have been removed.
          </p>
          <Link
            to="/academy/training-requests"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
          >
            <ArrowLeft className="h-4 w-4" /> Back to My Training Requests
          </Link>
        </main>
      </div>
    );
  }

  const reached = timelineReachedIndex(request.status);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          to="/academy/training-requests"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-marine transition-colors hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> My Training Requests
        </Link>

        {/* Header */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="font-mono text-xs font-bold text-marine">{request.reference}</span>
              <h1 className="mt-1 font-display text-2xl font-extrabold text-navy">
                {request.trainingTopic}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {request.trainingCategory} · Submitted {formatDate(request.createdAt)}
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[request.status]}`}
            >
              {request.status}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Timeline */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold text-navy">Status Timeline</h2>
            <ol className="mt-5 space-y-0">
              {TIMELINE_STAGES.map((stage, i) => {
                const done = i < reached;
                const current = i === reached;
                const isLast = i === TIMELINE_STAGES.length - 1;
                return (
                  <li key={stage} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                          done
                            ? "bg-eco-community text-navy-foreground"
                            : current
                              ? "bg-marine text-marine-foreground"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {done ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : current ? (
                          <Clock className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </span>
                      {!isLast && (
                        <span
                          className={`my-1 w-px flex-1 ${i < reached ? "bg-eco-community" : "bg-border"}`}
                          style={{ minHeight: "1.75rem" }}
                        />
                      )}
                    </div>
                    <div className={`pb-6 ${isLast ? "pb-0" : ""}`}>
                      <p
                        className={`font-display text-sm font-bold ${
                          done || current ? "text-navy" : "text-muted-foreground"
                        }`}
                      >
                        {stage}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {done ? "Completed" : current ? "In progress" : "Pending"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold text-navy">Requester</h2>
              <p className="mt-3 font-semibold text-navy">{request.fullName}</p>
              <p className="text-sm text-muted-foreground">{request.position}</p>
              <dl className="mt-4 space-y-2 text-sm">
                <DetailRow icon={Building2}>
                  {request.organization} · {request.organizationType}
                </DetailRow>
                <DetailRow icon={MapPin}>{request.country}</DetailRow>
                <DetailRow icon={Mail}>{request.email}</DetailRow>
                {request.phone && <DetailRow icon={Phone}>{request.phone}</DetailRow>}
                {request.website && <DetailRow icon={Globe}>{request.website}</DetailRow>}
              </dl>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold text-navy">Training Summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <DetailRow icon={Users}>
                  {request.targetAudience}
                  {request.participantCount ? ` · ${request.participantCount} participants` : ""}
                </DetailRow>
                {request.deliveryMode && (
                  <DetailRow icon={Calendar}>
                    {request.deliveryMode}
                    {request.duration ? ` · ${request.duration}` : ""}
                    {request.trainingPeriod ? ` · ${request.trainingPeriod}` : ""}
                  </DetailRow>
                )}
                {request.location && <DetailRow icon={MapPin}>{request.location}</DetailRow>}
                <DetailRow icon={LanguagesIcon}>{request.language}</DetailRow>
              </dl>
            </div>
          </div>
        </div>

        {/* Full request content */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-navy">Request Details</h2>
          <div className="mt-4 space-y-4">
            <Block label="Training Objectives" value={request.objectives} />
            <Block label="Learning Needs" value={request.needs} />
            <Block label="Expected Learning Outcomes" value={request.outcomes} />
            {request.challenges && <Block label="Current Challenges" value={request.challenges} />}
            <Block label="Preferred Competency Level" value={request.competencyLevel} />
            {request.participantProfile && (
              <Block label="Preferred Participant Profile" value={request.participantProfile} />
            )}
            {request.fundingStatus && (
              <Block label="Funding Status" value={request.fundingStatus} />
            )}
            {request.supportRequested.length > 0 && (
              <div>
                <p className="text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">
                  Support Requested from BARUNA
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {request.supportRequested.map((s) => (
                    <span
                      key={s}
                      className="inline-flex rounded-full bg-marine/10 px-3 py-1 text-xs font-semibold text-marine"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {request.existingPartners && (
              <Block label="Existing Partners" value={request.existingPartners} />
            )}
            {request.remarks && <Block label="Additional Remarks" value={request.remarks} />}
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <button
              type="button"
              onClick={() => {
                if (confirm("Withdraw and delete this training request? This cannot be undone.")) {
                  deleteRequest(request.id);
                  window.location.href = "/academy/training-requests";
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" /> Withdraw Request
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  children,
}: {
  icon: typeof Mail;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-foreground/80">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-marine" />
      <span>{children}</span>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm text-foreground/90">{value}</p>
    </div>
  );
}
