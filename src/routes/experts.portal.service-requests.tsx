import { createFileRoute } from "@tanstack/react-router";
import { Inbox, Calendar, MapPin, CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";

export const Route = createFileRoute("/experts/portal/service-requests")({
  head: () => ({
    meta: [
      { title: "Service Requests — Trainer Portal" },
      { name: "description", content: "Incoming Expert Service requests directed to you as a BARUNA trainer." },
    ],
    links: [{ rel: "canonical", href: "/experts/portal/service-requests" }],
  }),
  component: ServiceRequestsPortal,
});

const REQS = [
  { id: "SR-2026-000431", org: "Republic of Kenya — State Department for Fisheries", type: "Trainer", topic: "Biofloc tilapia training for extension officers", date: "2026-06-14", place: "Mombasa, Kenya", status: "Approved" },
  { id: "SR-2026-000418", org: "SEAFDEC", type: "Speaker", topic: "Aquaculture innovations webinar", date: "2026-05-08", place: "Online", status: "Scheduled" },
  { id: "SR-2026-000392", org: "Ocean University of China", type: "Reviewer", topic: "External review — MSc curriculum in aquaculture", date: "2026-04-20", place: "Remote", status: "Under Review" },
  { id: "SR-2026-000376", org: "Ministry of Fisheries — Ghana", type: "Mentor", topic: "Mentor a national trainer cohort (4 sessions)", date: "2026-04-01", place: "Accra, Ghana", status: "Expert Contacted" },
];

const STYLES: Record<string, string> = {
  Approved: "bg-eco-community/15 text-eco-community",
  Scheduled: "bg-marine/15 text-marine",
  "Under Review": "bg-badge-workshop/15 text-badge-workshop",
  "Expert Contacted": "bg-accent/25 text-accent-foreground",
};

function ServiceRequestsPortal() {
  return (
    <PageShell
      sidebar={{ ...EXPERTS_SIDEBAR_META, title: "Trainer Portal", subtitle: "Incoming Expert Services.", sections: trainerPortalNav("/experts/portal/service-requests") }}
      cta={{ icon: Inbox, title: "Missed something?", description: "All requests remain in your audit trail with reviewer comments.", button: "Back to Dashboard", href: "/experts/portal" }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Service Requests</h1>
          <p className="mt-2 text-sm text-muted-foreground">Requests routed to you by BARUNA's expert matching workflow.</p>
        </div>

        <ul className="space-y-3">
          {REQS.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{r.id} · {r.type}</p>
                  <p className="mt-0.5 font-display text-base font-bold text-navy">{r.topic}</p>
                  <p className="mt-1 text-xs text-foreground/70">{r.org}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[0.7rem] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {r.date}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.place}</span>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-bold ${STYLES[r.status] ?? "bg-muted text-foreground/70"}`}>
                  <CheckCircle2 className="h-3 w-3" /> {r.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-lg bg-marine px-4 py-1.5 text-xs font-semibold text-marine-foreground hover:bg-navy">Accept</button>
                <button className="rounded-lg border border-border px-4 py-1.5 text-xs font-semibold text-navy hover:bg-muted">Request info</button>
                <button className="rounded-lg border border-destructive/40 px-4 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10">Decline</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}
