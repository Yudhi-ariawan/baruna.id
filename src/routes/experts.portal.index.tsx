import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutDashboard, Award, BookOpen, Users, TrendingUp, FileEdit, ArrowRight, Info } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { DEMO_TRAINER, DEMO_MODULE, LEVEL_LABEL, computeRecognition, participantLearningHoursGenerated, formatUsp } from "@/lib/trainerModules";

export const Route = createFileRoute("/experts/portal/")({
  head: () => ({
    meta: [
      { title: "Trainer Portal — BARUNA Experts" },
      { name: "description", content: "Private dashboard for approved BARUNA trainers: submit modules, track review status, and manage your teaching portfolio." },
      { property: "og:title", content: "Trainer Portal — BARUNA Experts" },
      { property: "og:description", content: "Private trainer dashboard." },
    ],
    links: [{ rel: "canonical", href: "/experts/portal" }],
  }),
  component: PortalDashboard,
});

function PortalDashboard() {
  const rec = computeRecognition({
    usp: DEMO_TRAINER.uniqueSuccessfulParticipants,
    completionRatePct: DEMO_TRAINER.completionRatePct,
    averageRating: DEMO_TRAINER.averageRating,
    hasUnresolvedComplaint: DEMO_TRAINER.hasUnresolvedComplaint,
    moduleCurrent: DEMO_TRAINER.moduleCurrent,
    awardedLevel: DEMO_TRAINER.awardedLevel,
  });
  const plhg = participantLearningHoursGenerated(DEMO_TRAINER.instructionalHours, DEMO_TRAINER.uniqueSuccessfulParticipants);

  return (
    <PageShell
      sidebar={{ ...EXPERTS_SIDEBAR_META, title: "Trainer Portal", subtitle: "Approved BARUNA Trainer workspace.", sections: trainerPortalNav("/experts/portal") }}
      cta={{ icon: LayoutDashboard, title: "Ready to submit your next module?", description: "Additional modules unlock as your recognition level grows.", button: "Submit a Module", href: "/experts/portal/submit-module" }}
    >
      <div className="space-y-6">
        <header className="rounded-2xl border border-marine/20 bg-gradient-to-br from-marine/5 to-transparent p-6">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-marine">
            <LayoutDashboard className="h-3.5 w-3.5" /> Welcome back
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-navy">{DEMO_TRAINER.fullName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{DEMO_TRAINER.title} · {DEMO_TRAINER.organization}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-marine/10 px-3 py-1 text-xs font-bold text-marine">
              <Award className="h-3 w-3" /> {LEVEL_LABEL[DEMO_TRAINER.awardedLevel]}
            </span>
            <span className="rounded-full bg-eco-community/10 px-3 py-1 text-xs font-semibold text-eco-community">
              Approved since {DEMO_TRAINER.approvedAt}
            </span>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={FileEdit} label="Approved Modules" value={DEMO_TRAINER.approvedModules} />
          <StatCard icon={BookOpen} label="Published Self-Paced Courses" value={DEMO_TRAINER.publishedShortCourses} />
          <StatCard icon={Users} label="Unique Successful Participants" value={formatUsp(DEMO_TRAINER.uniqueSuccessfulParticipants)} />
          <StatCard icon={TrendingUp} label="Participant Learning Hours Generated" value={formatUsp(plhg)} sub={`${DEMO_TRAINER.instructionalHours} IH × ${formatUsp(DEMO_TRAINER.uniqueSuccessfulParticipants)} USP`} />
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-navy">Recognition Progress</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Current: <strong>{LEVEL_LABEL[DEMO_TRAINER.awardedLevel]}</strong>
                {rec.nextLevel && <> · Next: <strong>{LEVEL_LABEL[rec.nextLevel]}</strong></>}
              </p>
            </div>
            <Link to="/experts/portal/recognition" className="text-xs font-semibold text-marine hover:text-navy">Details <ArrowRight className="inline h-3 w-3" /></Link>
          </div>
          {rec.nextLevel && (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-[0.7rem] font-semibold text-foreground/70">
                <span>{formatUsp(rec.usp)} / {formatUsp(rec.requiredForNext)} USP</span>
                <span>{rec.progressPct}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-marine" style={{ width: `${rec.progressPct}%` }} />
              </div>
            </div>
          )}
          <p className="mt-4 rounded-lg bg-marine/5 p-3 text-xs text-foreground/80">
            <Info className="mr-1 inline h-3.5 w-3.5 text-marine" />
            {rec.eligibleForReview
              ? "You are Eligible for Level Review. BARUNA administrators will assess promotion — recognition is never awarded automatically."
              : "Recognition is never awarded automatically. Continue delivering quality training to become eligible for review."}
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-navy">My Modules</h2>
            <Link to="/experts/portal/submit-module" className="text-xs font-semibold text-marine hover:text-navy">Submit new <ArrowRight className="inline h-3 w-3" /></Link>
          </div>
          <div className="mt-4 divide-y divide-border">
            <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-navy">{DEMO_MODULE.title}</p>
                <p className="text-xs text-muted-foreground">{DEMO_MODULE.code} · {DEMO_MODULE.instructionalHours} IH · {DEMO_MODULE.version}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-eco-community/15 px-3 py-0.5 text-xs font-bold text-eco-community">{DEMO_MODULE.status}</span>
                <Link to="/experts/portal/review-status" className="text-xs font-semibold text-marine hover:text-navy">Review history</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
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
