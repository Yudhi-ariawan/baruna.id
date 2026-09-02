import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ClipboardList, Inbox } from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { AcademyHeader } from "@/components/baruna/academy/ui";
import {
  useRequests,
  formatDate,
  STATUS_STYLES,
  type RequestStatus,
} from "@/lib/trainingRequests";

export const Route = createFileRoute("/academy/training-requests/")({
  head: () => ({
    meta: [
      { title: "My Training Requests — Academy — BARUNA" },
      {
        name: "description",
        content:
          "Track all the training requests you have submitted to BARUNA and follow their review and coordination progress.",
      },
    ],
    links: [{ rel: "canonical", href: "/academy/training-requests" }],
  }),
  component: TrainingRequestsPage,
});

function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function TrainingRequestsPage() {
  const requests = useRequests();
  const counts = {
    total: requests.length,
    active: requests.filter((r) => !["Completed", "Closed"].includes(r.status)).length,
    scheduled: requests.filter((r) => r.status === "Scheduled" || r.status === "Approved").length,
    completed: requests.filter((r) => r.status === "Completed").length,
  };

  return (
    <AcademyShell active="my-training-requests">
      <div className="space-y-6">
        <AcademyHeader
          crumb="My Training Requests"
          title="My Training Requests"
          description="Track all the training requests you have submitted and follow their review and coordination progress."
          searchPlaceholder="Search your training requests..."
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total", value: counts.total },
              { label: "Active", value: counts.active },
              { label: "Approved / Scheduled", value: counts.scheduled },
              { label: "Completed", value: counts.completed },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-border bg-card p-4 text-center shadow-soft"
              >
                <p className="font-display text-2xl font-extrabold text-navy">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            to="/academy/request-training"
            className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
          >
            <Plus className="h-4 w-4" /> Request a Training
          </Link>
        </div>

        {requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Inbox className="mx-auto h-8 w-8 text-marine" />
            <p className="mt-3 font-display text-lg font-bold text-navy">No training requests yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Can't find the right training? Submit a request and BARUNA will help identify or
              develop a suitable program.
            </p>
            <Link
              to="/academy/request-training"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
            >
              <Plus className="h-4 w-4" /> Request a Training
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {/* Desktop table */}
            <table className="hidden w-full text-left text-sm md:table">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Reference Number</th>
                  <th className="px-5 py-3">Training Topic</th>
                  <th className="px-5 py-3">Organization</th>
                  <th className="px-5 py-3">Submission Date</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr
                    key={r.id}
                    className="group border-b border-border last:border-0 transition-colors hover:bg-muted/40"
                  >
                    <td className="px-5 py-4">
                      <Link
                        to="/academy/training-requests/$id"
                        params={{ id: r.id }}
                        className="font-mono text-xs font-bold text-marine hover:text-navy"
                      >
                        {r.reference}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        to="/academy/training-requests/$id"
                        params={{ id: r.id }}
                        className="font-semibold text-navy hover:text-marine"
                      >
                        {r.trainingTopic}
                      </Link>
                      <p className="text-xs text-muted-foreground">{r.trainingCategory}</p>
                    </td>
                    <td className="px-5 py-4 text-foreground/80">
                      {r.organization}
                      <p className="text-xs text-muted-foreground">{r.country}</p>
                    </td>
                    <td className="px-5 py-4 text-foreground/80">{formatDate(r.createdAt)}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="divide-y divide-border md:hidden">
              {requests.map((r) => (
                <Link
                  key={r.id}
                  to="/academy/training-requests/$id"
                  params={{ id: r.id }}
                  className="block p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-marine">{r.reference}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-1.5 font-semibold text-navy">{r.trainingTopic}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.organization} · {r.country}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted {formatDate(r.createdAt)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" /> Click any request to view its full status
          timeline.
        </p>
      </div>
    </AcademyShell>
  );
}
