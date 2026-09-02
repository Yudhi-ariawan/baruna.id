import { createFileRoute } from "@tanstack/react-router";
import { BookOpenCheck, Users, TrendingUp, Award, Clock } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { DEMO_TRAINER, DEMO_MODULE, LEVEL_LABEL, participantLearningHoursGenerated, formatUsp } from "@/lib/trainerModules";

export const Route = createFileRoute("/experts/portal/portfolio")({
  head: () => ({
    meta: [
      { title: "Teaching Portfolio — Trainer Portal" },
      { name: "description", content: "Verified public record of a BARUNA trainer's modules, courses, and learning-reach metrics." },
    ],
    links: [{ rel: "canonical", href: "/experts/portal/portfolio" }],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const plhg = participantLearningHoursGenerated(DEMO_TRAINER.instructionalHours, DEMO_TRAINER.uniqueSuccessfulParticipants);
  return (
    <PageShell
      sidebar={{ ...EXPERTS_SIDEBAR_META, title: "Trainer Portal", subtitle: "Teaching portfolio.", sections: trainerPortalNav("/experts/portal/portfolio") }}
      cta={{ icon: BookOpenCheck, title: "Ready to grow your portfolio?", description: "Submit an additional module — subject to your current level limit.", button: "Submit Module", href: "/experts/portal/submit-module" }}
    >
      <div className="space-y-6">
        <header className="rounded-2xl bg-navy p-6 text-navy-foreground shadow-card">
          <p className="text-xs font-bold uppercase tracking-wider text-navy-foreground/70">Teaching Portfolio</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold">{DEMO_TRAINER.fullName}</h1>
          <p className="mt-1 text-sm text-navy-foreground/80">{DEMO_TRAINER.title}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold"><Award className="h-3 w-3" /> {LEVEL_LABEL[DEMO_TRAINER.awardedLevel]}</span>
            {DEMO_TRAINER.expertCategories.map((c) => (
              <span key={c} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{c}</span>
            ))}
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={BookOpenCheck} label="Approved Modules" value={DEMO_TRAINER.approvedModules} />
          <Metric icon={Clock} label="Instructional Hours (all modules)" value={DEMO_TRAINER.instructionalHours} sub="Sum of module IH" />
          <Metric icon={Users} label="Unique Successful Participants" value={formatUsp(DEMO_TRAINER.uniqueSuccessfulParticipants)} />
          <Metric icon={TrendingUp} label="Participant Learning Hours Generated" value={formatUsp(plhg)} sub={`${DEMO_TRAINER.instructionalHours} × ${formatUsp(DEMO_TRAINER.uniqueSuccessfulParticipants)}`} />
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-navy">Approved Modules</h2>
          <ul className="mt-4 divide-y divide-border">
            <li className="py-3">
              <p className="text-sm font-bold text-navy">{DEMO_MODULE.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{DEMO_MODULE.code} · {DEMO_MODULE.instructionalHours} IH · {DEMO_MODULE.version} · {DEMO_MODULE.language}</p>
              <p className="mt-1 text-xs text-foreground/70 max-w-3xl">{DEMO_MODULE.description}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[0.65rem]">
                <span className="rounded-full bg-eco-community/15 px-2 py-0.5 font-bold text-eco-community">{DEMO_MODULE.status}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold text-navy">{DEMO_TRAINER.uniqueSuccessfulParticipants} USP</span>
              </div>
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-navy">Training Roles Held</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEMO_TRAINER.trainingRoles.map((r) => (
              <span key={r} className="rounded-full bg-marine/10 px-3 py-1 text-xs font-semibold text-marine">{r}</span>
            ))}
          </div>
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
