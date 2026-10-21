import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Users, TrendingUp, Star, CheckCircle2, BookOpen } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { formatUsp } from "@/lib/trainerModules";
import { useTrainerPortal } from "@/lib/experts/useTrainerPortal";
import { getTrainerLearningSummary } from "@/lib/experts/trainer-learning.functions";

export const Route = createFileRoute("/experts/portal/analytics")({
  head: () => ({ meta: [{ title: "Learner Statistics — Trainer Portal" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const q = useTrainerPortal();
  const d = q.data;
  const t = d?.trainer;
  const summaryFn = useServerFn(getTrainerLearningSummary);
  const summary = useQuery({
    queryKey: ["trainer-portal", "learning-summary"],
    queryFn: () => summaryFn(),
    enabled: Boolean(t),
    staleTime: 60_000,
  });
  const countries = d?.analytics?.countries ?? [];
  const hours = (d?.modules ?? [])
    .filter((m) => ["approved", "published"].includes(m.status))
    .reduce((n, m) => n + (m.hours ?? 0), 0);

  if (q.isLoading) return <p className="p-10 text-sm text-muted-foreground">Loading learner statistics…</p>;
  if (!t) return <p className="p-10 text-sm text-muted-foreground">Learner statistics are unavailable.</p>;
  const max = Math.max(0, ...countries.map((r) => r.participants));
  const rate = summary.data?.totals.completionRate;

  return (
    <PageShell
      sidebar={{ ...EXPERTS_SIDEBAR_META, title: "Trainer Portal", subtitle: "Learner statistics.", sections: trainerPortalNav("/experts/portal/analytics") }}
      cta={{ icon: BarChart3, title: "Verified metrics only", description: "Unavailable metrics remain clearly marked rather than estimated.", button: "Recognition Framework", href: "/experts/recognition" }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Learner Statistics</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Figures are read from verified trainer records and from the BARUNA learning records of your published modules.
            Individual participants are monitored by BARUNA administrators; this page shows totals only.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Users} label="Successful Participants" value={formatUsp(t.uniqueSuccessfulParticipants)} />
          <Metric icon={TrendingUp} label="Learning Hours Generated" value={formatUsp(hours * t.uniqueSuccessfulParticipants)} />
          <Metric
            icon={CheckCircle2}
            label="Completion Rate"
            value={summary.isLoading ? "…" : rate === null || rate === undefined ? "Not available" : `${rate}%`}
            hint={rate === null || rate === undefined ? undefined : `${summary.data!.totals.passed} of ${summary.data!.totals.approved} approved participants passed the official quiz`}
          />
          <Metric icon={Star} label="Average Rating" value={d?.analytics?.averageRating == null ? "Not available" : d.analytics.averageRating.toFixed(1)} />
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
            <BookOpen className="h-5 w-5 text-marine" /> Participants per Published Module
          </h2>
          {summary.isError ? (
            <p className="mt-4 text-sm text-destructive">{summary.error instanceof Error ? summary.error.message : "Statistics could not be loaded."}</p>
          ) : summary.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : (summary.data?.modules.length ?? 0) === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">You have no published module yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Module</th>
                    <th className="px-2 py-2 text-right">Pending</th>
                    <th className="px-2 py-2 text-right">Approved</th>
                    <th className="px-2 py-2 text-right">Started</th>
                    <th className="px-2 py-2 text-right">Passed</th>
                    <th className="px-2 py-2 text-right">Avg. best score</th>
                    <th className="px-2 py-2 text-right">Quiz attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.data!.modules.map((m) => (
                    <tr key={m.moduleId} className="border-t border-border">
                      <td className="py-2.5 pr-3 font-semibold text-navy">
                        {m.title}
                        {!m.hasOfficialQuiz && (
                          <p className="text-[10px] font-semibold text-amber-700">
                            No official quiz yet: participants cannot pass until you add one through a module revision.
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right">{m.applicationsPending}</td>
                      <td className="px-2 py-2.5 text-right">{m.participantsApproved}</td>
                      <td className="px-2 py-2.5 text-right">{m.participantsStarted}</td>
                      <td className="px-2 py-2.5 text-right">
                        {m.participantsPassed}
                        {m.participantsApproved ? ` (${Math.round((m.participantsPassed / m.participantsApproved) * 100)}%)` : ""}
                      </td>
                      <td className="px-2 py-2.5 text-right">{m.averageBestScore === null ? "-" : `${m.averageBestScore}%`}</td>
                      <td className="px-2 py-2.5 text-right">{m.quizAttempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-navy">Recorded Participants by Delivery Country</h2>
          {countries.length ? (
            <ul className="mt-4 space-y-2">
              {countries.map((r) => (
                <li key={r.country} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 text-navy">{r.country}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-marine" style={{ width: `${max ? (r.participants / max) * 100 : 0}%` }} />
                  </div>
                  <span className="w-10 text-right text-xs font-bold">{r.participants}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No country-level facilitation data has been recorded.</p>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function Metric({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-marine" />
        {label}
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold text-navy">{value}</p>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
