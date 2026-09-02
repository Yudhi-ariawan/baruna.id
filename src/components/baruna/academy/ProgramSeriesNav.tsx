import { Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight, Layers } from "lucide-react";

const TRAINING_SLUG = "international-training-fisheries-african-countries";

/**
 * Program Series switcher — connects the completed 2024 edition with the live
 * 2026 edition. Purely additive: it links between the two editions and never
 * alters the 2026 application / learning / certificate workflow.
 */
export function ProgramSeriesNav({ active }: { active: "2024" | "2026" }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-marine/10 text-marine">
          <Layers className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-navy">Program Series</h2>
          <p className="text-xs text-muted-foreground">
            International Training on Fisheries for African Countries
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* 2024 — Completed */}
        <div
          className={`flex flex-col rounded-xl border p-4 transition-colors ${
            active === "2024" ? "border-success/50 bg-success/5" : "border-border bg-background"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-2xl font-extrabold text-navy">2024</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-success">
              <CheckCircle2 className="h-3 w-3" /> Completed
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">First edition · Indonesia · Sep 2024</p>
          {active === "2024" ? (
            <span className="mt-3 inline-flex items-center justify-center rounded-lg border border-border bg-card py-2 text-sm font-semibold text-muted-foreground">
              Currently Viewing
            </span>
          ) : (
            <Link
              to="/academy/edition-2024"
              className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-success bg-card py-2 text-sm font-semibold text-success transition-colors hover:bg-success hover:text-success-foreground"
            >
              View Program <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {/* 2026 — Applications Open */}
        <div
          className={`flex flex-col rounded-xl border p-4 transition-colors ${
            active === "2026" ? "border-marine/50 bg-marine/5" : "border-border bg-background"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-2xl font-extrabold text-navy">2026</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-marine/15 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-marine">
              Applications Open
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Blended · Bali, Indonesia · Sep 2026</p>
          {active === "2026" ? (
            <span className="mt-3 inline-flex items-center justify-center rounded-lg border border-border bg-card py-2 text-sm font-semibold text-muted-foreground">
              Currently Viewing
            </span>
          ) : (
            <Link
              to="/academy/training/$slug"
              params={{ slug: TRAINING_SLUG }}
              className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-marine py-2 text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90"
            >
              Apply Now <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
