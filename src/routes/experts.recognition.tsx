import { createFileRoute } from "@tanstack/react-router";
import { Award, CheckCircle2, ShieldAlert, Info } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { publicExpertsNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { LEVEL_LABEL, LEVEL_THRESHOLD, LEVEL_RATIONALE, QUALITY_GATES, type TrainerLevel } from "@/lib/trainerModules";

export const Route = createFileRoute("/experts/recognition")({
  head: () => ({
    meta: [
      { title: "Trainer Recognition — BARUNA Experts" },
      { name: "description", content: "Tiered BARUNA trainer recognition based on Unique Successful Participants and verified quality safeguards." },
      { property: "og:title", content: "Trainer Recognition — BARUNA Experts" },
      { property: "og:description", content: "Certified, Advanced, Senior, and Master Trainer levels." },
    ],
    links: [{ rel: "canonical", href: "/experts/recognition" }],
  }),
  component: RecognitionPage,
});

const LEVELS: TrainerLevel[] = ["certified", "advanced", "senior", "master"];

const LEVEL_MEANING: Record<TrainerLevel, string> = {
  none: "",
  certified: "The trainer has successfully delivered an approved Self-Paced Course to at least one credible and complete training cohort.",
  advanced: "The trainer has demonstrated consistent delivery beyond a single cohort.",
  senior: "The trainer has achieved large-scale and sustained learning impact.",
  master: "The trainer has demonstrated exceptional, large-scale, sustained, and verified contribution to capacity development.",
};

const LEVEL_BENEFITS: Record<TrainerLevel, string[]> = {
  none: [],
  certified: ["Certificate of Training Delivery", "Digital recognition badge", "Teaching Portfolio activated"],
  advanced: ["Advanced Trainer certificate", "Eligibility to propose additional modules", "Eligibility to serve as Co-Reviewer"],
  senior: ["Senior Trainer certificate", "Featured expert profile", "Eligibility to serve as Lead Trainer", "Eligibility to mentor new trainers", "Eligibility to serve as Academic Reviewer"],
  master: ["Highest-level recognition certificate", "Master Trainer badge", "Featured placement in Experts", "Eligibility to serve as Curriculum Advisor", "Eligibility to chair academic review panels"],
};

function RecognitionPage() {
  return (
    <PageShell
      sidebar={{ ...EXPERTS_SIDEBAR_META, sections: publicExpertsNav("/experts/recognition") }}
      cta={{ icon: Award, title: "Ready to be recognized?", description: "Become an approved BARUNA Trainer to start building your teaching portfolio.", button: "Become a BARUNA Trainer", href: "/experts/become-trainer" }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Trainer Recognition</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            BARUNA recognises trainers based on <strong>Unique Successful Participants</strong> and verified quality. Recognition is never awarded automatically — every promotion is reviewed and approved.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {LEVELS.map((lvl) => (
            <article key={lvl} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-marine">
                <Award className="h-3.5 w-3.5" /> {LEVEL_LABEL[lvl]}
              </div>
              <p className="mt-2 font-display text-3xl font-extrabold text-navy">
                {lvl === "master" ? ">10,000" : LEVEL_THRESHOLD[lvl].toLocaleString()}
              </p>
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Unique Successful Participants</p>
              <p className="mt-3 text-xs text-foreground/70">{LEVEL_MEANING[lvl]}</p>
              <p className="mt-2 text-[0.7rem] italic text-muted-foreground">{LEVEL_RATIONALE[lvl]}</p>
              <ul className="mt-3 space-y-1">
                {LEVEL_BENEFITS[lvl].map((b) => (
                  <li key={b} className="flex gap-1.5 text-[0.7rem] text-foreground/80">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-eco-community" /> {b}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
            <ShieldAlert className="h-5 w-5 text-marine" /> Quality Safeguards
          </h2>
          <p className="mt-1 text-sm text-foreground/70">Participant numbers alone never guarantee recognition. All promotions require:</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              `Course completion rate ≥ ${QUALITY_GATES.minCompletionRate}%`,
              `Average participant rating ≥ ${QUALITY_GATES.minAverageRating.toFixed(1)} / 5`,
              "No unresolved participant complaints",
              "No academic-integrity or copyright violations",
              "Module status: Approved and Current",
              "Verified unique-participant records (no duplicate accounts)",
            ].map((s) => (
              <li key={s} className="flex gap-2 rounded-lg bg-muted/60 p-3 text-xs font-medium text-foreground/80">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-eco-community" /> {s}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-marine/25 bg-marine/5 p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-marine">
            <Info className="h-4 w-4" /> How Participant Learning Hours Generated is calculated
          </h3>
          <p className="mt-2 text-sm text-foreground/80">
            <strong>Participant Learning Hours Generated</strong> = Instructional Hours × Unique Successful Participants.
            This is a <em>learning-reach</em> metric — it is <strong>not</strong> the same as the trainer's Instructional Hours delivered, and it is never labelled "Teaching Hours".
          </p>
        </section>
      </div>
    </PageShell>
  );
}
