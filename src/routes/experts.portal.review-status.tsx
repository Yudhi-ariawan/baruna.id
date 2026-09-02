import { createFileRoute } from "@tanstack/react-router";
import { ListTree, CheckCircle2, Clock } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { DEMO_MODULE, MODULE_REVIEW_PIPELINE, MODULE_STATUS_STYLES, type ModuleStatus } from "@/lib/trainerModules";

export const Route = createFileRoute("/experts/portal/review-status")({
  head: () => ({
    meta: [
      { title: "Module Review Status — Trainer Portal" },
      { name: "description", content: "Track your module through the BARUNA multi-stage review pipeline." },
    ],
    links: [{ rel: "canonical", href: "/experts/portal/review-status" }],
  }),
  component: ReviewStatusPage,
});

function ReviewStatusPage() {
  const currentIdx = MODULE_REVIEW_PIPELINE.indexOf(DEMO_MODULE.status as ModuleStatus);
  return (
    <PageShell
      sidebar={{ ...EXPERTS_SIDEBAR_META, title: "Trainer Portal", subtitle: "Module review pipeline.", sections: trainerPortalNav("/experts/portal/review-status") }}
      cta={{ icon: ListTree, title: "Reviewer feedback matters", description: "All decisions are recorded and shared transparently.", button: "Back to Dashboard", href: "/experts/portal" }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Module Review Status</h1>
          <p className="mt-2 text-sm text-muted-foreground">Every review decision is recorded to your permanent audit trail.</p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Module</p>
          <h2 className="mt-1 font-display text-xl font-bold text-navy">{DEMO_MODULE.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{DEMO_MODULE.code} · {DEMO_MODULE.instructionalHours} IH · {DEMO_MODULE.version}</p>
          <div className="mt-3">
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-bold ${MODULE_STATUS_STYLES[DEMO_MODULE.status]}`}>
              {DEMO_MODULE.status}
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h3 className="font-display text-base font-bold text-navy">Review Pipeline</h3>
          <ol className="mt-5 space-y-3">
            {MODULE_REVIEW_PIPELINE.map((stage, i) => {
              const done = i <= currentIdx;
              return (
                <li key={stage} className={`flex items-start gap-3 rounded-xl border p-3 ${done ? "border-eco-community/30 bg-eco-community/5" : "border-border bg-muted/30"}`}>
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${done ? "bg-eco-community text-white" : "bg-muted text-muted-foreground"}`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-navy">{stage}</p>
                    {done && i === currentIdx && <p className="text-[0.7rem] text-eco-community">Current stage</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h3 className="font-display text-base font-bold text-navy">Review History (Audit Trail)</h3>
          <ul className="mt-4 divide-y divide-border">
            {DEMO_MODULE.reviewHistory.map((r, i) => (
              <li key={i} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-navy">{r.reviewerRole}</p>
                  <span className="text-xs text-muted-foreground">{r.ts}</span>
                </div>
                <p className="mt-0.5 text-xs text-foreground/70">Reviewer: {r.reviewer}</p>
                <p className="mt-1 text-xs">
                  <span className="rounded-full bg-eco-community/15 px-2 py-0.5 text-[0.65rem] font-bold text-eco-community">{r.decision}</span>
                </p>
                <p className="mt-2 text-sm text-foreground/80">{r.comment}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
