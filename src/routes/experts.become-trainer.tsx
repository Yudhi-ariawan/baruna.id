import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, CheckCircle2, ShieldCheck, FileEdit, Award, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { publicExpertsNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { TRAINER_APP_STATUSES } from "@/lib/trainerModules";

export const Route = createFileRoute("/experts/become-trainer")({
  head: () => ({
    meta: [
      { title: "Become a BARUNA Trainer — Experts" },
      { name: "description", content: "Trainer application, qualification review, and module submission workflow for verified BARUNA experts." },
      { property: "og:title", content: "Become a BARUNA Trainer" },
      { property: "og:description", content: "How Verified BARUNA Experts become Approved Trainers." },
    ],
    links: [{ rel: "canonical", href: "/experts/become-trainer" }],
  }),
  component: BecomeTrainerPage,
});

const STEPS = [
  { icon: ShieldCheck, title: "Prerequisite", body: "You must first be a Verified BARUNA Expert. Trainer status is a separate approval and is not granted automatically." },
  { icon: FileEdit, title: "Trainer Application", body: "Submit proposed training role, competency evidence, teaching samples, and originality / copyright / conflict of interest declarations." },
  { icon: CheckCircle2, title: "Qualification Review", body: "Administrative, technical, and teaching-competency reviews (interview or demonstration may be required)." },
  { icon: Award, title: "Approved BARUNA Trainer", body: "Once approved you may submit ONE initial training module for review and publication as a BARUNA Self-Paced Course." },
];

const REQUIREMENTS = [
  "Verified BARUNA Expert status (see 'Become an Expert')",
  "Proposed training role: Lead Trainer, Co-Trainer, Technical Instructor, Facilitator, Resource Person, Subject Matter Expert, Reviewer, Mentor, or Module Author",
  "Training experience and evidence of teaching competence",
  "Experience developing learning materials and assessments",
  "Sample teaching material, presentation, and (when required) a short teaching video",
  "Proposed module topic, target participants, instructional hours, and learning outcomes",
  "Signed declarations: originality, copyright, conflict of interest, and BARUNA code of conduct",
];

function BecomeTrainerPage() {
  return (
    <PageShell
      sidebar={{ ...EXPERTS_SIDEBAR_META, sections: publicExpertsNav("/experts/become-trainer") }}
      cta={{
        icon: GraduationCap,
        title: "Ready to apply?",
        description: "Complete the trainer application. Only Verified BARUNA Experts are eligible.",
        button: "Start Trainer Application",
        href: "/experts/join",
      }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Become a BARUNA Trainer</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            BARUNA Trainer status is granted only after a dedicated qualification review. Being a Verified BARUNA Expert is a prerequisite but does not automatically confer trainer authorization.
          </p>
        </div>

        <div className="rounded-2xl border border-marine/20 bg-marine/5 p-5">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-marine">
            <ShieldCheck className="h-4 w-4" /> One Trainer — One Initial Module
          </p>
          <p className="mt-2 text-sm text-foreground/80">
            Each newly Approved BARUNA Trainer may initially submit <strong>one training module</strong>. Additional module submissions unlock only after that module passes review, is published, and meets sustained quality performance.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s, i) => (
            <article key={s.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Step {i + 1}</div>
              <div className="mt-2 grid h-9 w-9 place-items-center rounded-xl bg-marine/10 text-marine">
                <s.icon className="h-4 w-4" />
              </div>
              <h3 className="mt-3 font-display text-base font-bold text-navy">{s.title}</h3>
              <p className="mt-1.5 text-xs text-foreground/70">{s.body}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-navy">Application Requirements</h2>
          <ul className="mt-4 space-y-2">
            {REQUIREMENTS.map((r) => (
              <li key={r} className="flex gap-2 text-sm text-foreground/80">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-eco-community" /> {r}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-navy">Application Statuses</h2>
          <p className="mt-1 text-xs text-muted-foreground">All trainer applications move through the following stages. Reviewers record every decision to the audit trail.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {TRAINER_APP_STATUSES.map((s) => (
              <span key={s} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground/80">{s}</span>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link to="/experts/join" className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground hover:bg-navy">
            Register as an Expert First <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/experts/recognition" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-navy hover:bg-muted">
            View Trainer Recognition Levels
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
