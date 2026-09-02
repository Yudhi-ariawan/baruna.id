import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronRight,
  FileText,
  CalendarDays,
  Hash,
  ArrowRight,
  GraduationCap,
  Inbox,
  PlayCircle,
  XCircle,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import {
  useApplications,
  APP_STATUSES,
  type AppStatus,
  formatDate,
} from "@/lib/application";

export const Route = createFileRoute("/academy/applications/")({
  head: () => ({
    meta: [
      { title: "My Applications — Academy — BARUNA" },
      { name: "description", content: "Track your BARUNA Academy training applications and their progress." },
    ],
  }),
  component: ApplicationsDashboard,
});

const statusTone: Record<AppStatus, string> = {
  Submitted: "bg-marine/10 text-marine",
  "Under Review": "bg-star/25 text-accent",
  Shortlisted: "bg-badge-webinar/30 text-navy",
  Accepted: "bg-badge-training/20 text-badge-training",
  Rejected: "bg-destructive/10 text-destructive",
};

function StatusTracker({ status }: { status: AppStatus }) {
  if (status === "Rejected") {
    return (
      <div className="flex items-center gap-2.5 rounded-lg bg-destructive/5 px-3 py-2.5">
        <XCircle className="h-5 w-5 shrink-0 text-destructive" />
        <p className="text-xs font-semibold text-destructive">
          Application not selected. Thank you for applying — we encourage you to apply to future programs.
        </p>
      </div>
    );
  }
  const activeIndex = (APP_STATUSES as readonly string[]).indexOf(status);
  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:items-center">
      {APP_STATUSES.map((s, i) => {
        const reached = i <= activeIndex;
        return (
          <li key={s} className="flex items-center gap-2 sm:flex-1 sm:flex-col sm:gap-1.5">
            <div className="flex items-center gap-2 sm:w-full sm:flex-col sm:gap-1.5">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  reached ? "bg-marine text-marine-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-xs font-semibold ${reached ? "text-navy" : "text-muted-foreground"}`}>{s}</span>
            </div>
            {i < APP_STATUSES.length - 1 && (
              <span
                className={`ml-3 h-6 w-0.5 sm:ml-0 sm:h-0.5 sm:w-full ${i < activeIndex ? "bg-marine" : "bg-border"}`}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ApplicationsDashboard() {
  const apps = useApplications();

  return (
    <AcademyShell active="my-applications">
      <div className="space-y-6">
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy">My Applications</span>
        </nav>

        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">My Applications</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Track the status of every training application you have submitted — from submission to acceptance. Accepted
            programs can be opened directly in My Learning.
          </p>
        </div>

        {apps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-soft">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
              <Inbox className="h-7 w-7" />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-navy">No applications yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Browse training programs and apply to start your blended learning journey.
            </p>
            <Link
              to="/academy/training"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90"
            >
              Browse Training <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {apps.map((app) => {
              const docs = Object.values(app.documents).filter(Boolean).length;
              const total = Object.keys(app.documents).length;
              const accepted = app.status === "Accepted";
              return (
                <article key={app.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
                        <GraduationCap className="h-5 w-5" />
                      </span>
                      <div>
                        <Link
                          to="/academy/applications/$id"
                          params={{ id: app.id }}
                          className="font-display text-lg font-bold text-navy transition-colors hover:text-marine"
                        >
                          {app.title}
                        </Link>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-marine/70" /> Applied {formatDate(app.createdAt)}</span>
                          <span className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-marine/70" /> {app.id}</span>
                          <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-marine/70" /> {docs}/{total} documents</span>
                        </div>
                      </div>
                    </div>
                    <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-bold ${statusTone[app.status]}`}>
                      {app.status}
                    </span>
                  </div>

                  <div className="mt-5 rounded-xl border border-border bg-background p-4">
                    <StatusTracker status={app.status} />
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2.5">
                    <Link
                      to="/academy/applications/$id"
                      params={{ id: app.id }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-marine bg-card px-4 py-2 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                    >
                      View Details <ArrowRight className="h-4 w-4" />
                    </Link>
                    {accepted && (
                      <Link
                        to="/academy/learn/$id"
                        params={{ id: app.id }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90"
                      >
                        <PlayCircle className="h-4 w-4" /> Open Training
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AcademyShell>
  );
}
