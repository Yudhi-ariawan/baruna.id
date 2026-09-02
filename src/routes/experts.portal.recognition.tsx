import { createFileRoute } from "@tanstack/react-router";
import { Award, CheckCircle2, XCircle, ShieldAlert } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { DEMO_TRAINER, LEVEL_LABEL, LEVEL_THRESHOLD, computeRecognition, formatUsp, type TrainerLevel } from "@/lib/trainerModules";

export const Route = createFileRoute("/experts/portal/recognition")({
  head: () => ({
    meta: [
      { title: "Recognition Level — Trainer Portal" },
      { name: "description", content: "Track your progress toward the next BARUNA trainer recognition level." },
    ],
    links: [{ rel: "canonical", href: "/experts/portal/recognition" }],
  }),
  component: RecognitionPortal,
});

function RecognitionPortal() {
  const rec = computeRecognition({
    usp: DEMO_TRAINER.uniqueSuccessfulParticipants,
    completionRatePct: DEMO_TRAINER.completionRatePct,
    averageRating: DEMO_TRAINER.averageRating,
    hasUnresolvedComplaint: DEMO_TRAINER.hasUnresolvedComplaint,
    moduleCurrent: DEMO_TRAINER.moduleCurrent,
    awardedLevel: DEMO_TRAINER.awardedLevel,
  });
  const LEVELS: TrainerLevel[] = ["certified", "advanced", "senior", "master"];

  return (
    <PageShell
      sidebar={{ ...EXPERTS_SIDEBAR_META, title: "Trainer Portal", subtitle: "Recognition progress.", sections: trainerPortalNav("/experts/portal/recognition") }}
      cta={{ icon: Award, title: "Recognition is never automatic", description: "Every promotion is reviewed and approved by BARUNA administrators.", button: "View Public Recognition Framework", href: "/experts/recognition" }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Recognition Level</h1>
          <p className="mt-2 text-sm text-muted-foreground">Current level: <strong>{LEVEL_LABEL[DEMO_TRAINER.awardedLevel]}</strong></p>
        </div>

        {rec.nextLevel && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-navy">Progress to {LEVEL_LABEL[rec.nextLevel]}</h2>
              <span className="text-xs font-bold text-marine">{rec.progressPct}%</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-marine" style={{ width: `${rec.progressPct}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatUsp(rec.usp)} of {formatUsp(rec.requiredForNext)} Unique Successful Participants
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
            <ShieldAlert className="h-5 w-5 text-marine" /> Quality Gates
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {rec.qualityGates.map((g) => (
              <li key={g.label} className={`flex items-start gap-2 rounded-lg p-3 text-xs ${g.passed ? "bg-eco-community/10 text-foreground/85" : "bg-destructive/10 text-foreground/85"}`}>
                {g.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-eco-community" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                <div>
                  <p className="font-bold text-navy">{g.label}</p>
                  <p className="text-[0.7rem] text-muted-foreground">{g.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className={`mt-4 rounded-lg p-3 text-xs ${rec.eligibleForReview ? "bg-eco-community/10 text-foreground/85" : "bg-muted text-foreground/70"}`}>
            {rec.eligibleForReview
              ? "You are Eligible for Level Review. Await administrative decision — recognition is never awarded automatically."
              : "Continue delivering quality training to become eligible for review."}
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-navy">Level Thresholds</h2>
          <ol className="mt-4 space-y-2">
            {LEVELS.map((lvl) => {
              const achieved = LEVEL_THRESHOLD[lvl] <= rec.usp;
              return (
                <li key={lvl} className={`flex items-center justify-between rounded-lg border p-3 text-sm ${achieved ? "border-eco-community/40 bg-eco-community/5" : "border-border"}`}>
                  <div>
                    <p className="font-bold text-navy">{LEVEL_LABEL[lvl]}</p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      {lvl === "master" ? ">10,000" : LEVEL_THRESHOLD[lvl].toLocaleString()} Unique Successful Participants
                    </p>
                  </div>
                  {achieved && <CheckCircle2 className="h-4 w-4 text-eco-community" />}
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </PageShell>
  );
}
