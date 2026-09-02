import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Users, TrendingUp, Star, CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { DEMO_TRAINER, formatUsp, participantLearningHoursGenerated } from "@/lib/trainerModules";

export const Route = createFileRoute("/experts/portal/analytics")({
  head: () => ({
    meta: [
      { title: "Learner Statistics — Trainer Portal" },
      { name: "description", content: "Verified learner statistics for your BARUNA training modules." },
    ],
    links: [{ rel: "canonical", href: "/experts/portal/analytics" }],
  }),
  component: AnalyticsPage,
});

const COUNTRY_ROWS = [
  { country: "Indonesia", learners: 62 },
  { country: "Kenya", learners: 18 },
  { country: "Senegal", learners: 15 },
  { country: "Ghana", learners: 14 },
  { country: "Tanzania", learners: 11 },
  { country: "Egypt", learners: 9 },
  { country: "Nigeria", learners: 7 },
  { country: "Others (12 countries)", learners: 6 },
];

function AnalyticsPage() {
  const plhg = participantLearningHoursGenerated(DEMO_TRAINER.instructionalHours, DEMO_TRAINER.uniqueSuccessfulParticipants);
  const max = Math.max(...COUNTRY_ROWS.map((r) => r.learners));

  return (
    <PageShell
      sidebar={{ ...EXPERTS_SIDEBAR_META, title: "Trainer Portal", subtitle: "Learner statistics.", sections: trainerPortalNav("/experts/portal/analytics") }}
      cta={{ icon: BarChart3, title: "Learner-reach metrics only", description: "This dashboard reports verified Unique Successful Participants. It never inflates numbers with page views or downloads.", button: "Recognition Framework", href: "/experts/recognition" }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Learner Statistics</h1>
          <p className="mt-2 text-sm text-muted-foreground">All figures are verified by BARUNA and de-duplicated across accounts.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Users} label="Unique Successful Participants" value={formatUsp(DEMO_TRAINER.uniqueSuccessfulParticipants)} />
          <Metric icon={TrendingUp} label="Participant Learning Hours Generated" value={formatUsp(plhg)} />
          <Metric icon={CheckCircle2} label="Completion Rate" value={`${DEMO_TRAINER.completionRatePct}%`} sub="Target ≥ 60%" />
          <Metric icon={Star} label="Average Rating" value={DEMO_TRAINER.averageRating.toFixed(1)} sub="Target ≥ 4.0 / 5" />
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-navy">Learners by Country</h2>
          <ul className="mt-4 space-y-2">
            {COUNTRY_ROWS.map((r) => (
              <li key={r.country} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 text-navy">{r.country}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-marine" style={{ width: `${(r.learners / max) * 100}%` }} />
                </div>
                <span className="w-10 text-right text-xs font-bold text-foreground/80">{r.learners}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}

function Metric({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-marine" /> {label}
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold text-navy">{value}</p>
      {sub && <p className="mt-1 text-[0.65rem] text-muted-foreground">{sub}</p>}
    </div>
  );
}
