import { Check } from "lucide-react";
import { STEPS } from "./config";

export function StepperNav({
  isId,
  currentStep,
  onSelect,
}: {
  isId: boolean;
  currentStep: number;
  onSelect: (step: number) => void;
}) {
  return (
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3 text-xs font-semibold text-muted-foreground">
          <span className="uppercase tracking-wider text-marine font-bold">
            {isId ? `Langkah ${currentStep} dari ${STEPS.length}` : `Step ${currentStep} of ${STEPS.length}`}
          </span>
          <span>
            {Math.round((currentStep / STEPS.length) * 100)}% {isId ? "Selesai" : "Completed"}
          </span>
        </div>

        {/* Step Progress Line */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-4">
          <div
            className="h-full rounded-full bg-marine transition-all duration-300"
            style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Stepper Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {STEPS.map((s) => {
            const active = s.n === currentStep;
            const isDone = s.n < currentStep;
            const Icon = s.icon;

            return (
              <button
                key={s.n}
                type="button"
                onClick={() => {
                  // Allow navigating directly to visited steps
                  onSelect(s.n);
                }}
                className={`flex items-start gap-2.5 rounded-xl p-3 text-left transition-all border cursor-pointer ${
                  active
                    ? "border-marine bg-marine/10 shadow-xs ring-1 ring-marine/30"
                    : isDone
                      ? "border-eco-community/40 bg-eco-community/5 hover:bg-eco-community/10"
                      : "border-transparent bg-muted/40 hover:bg-muted text-muted-foreground"
                }`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                    active
                      ? "bg-marine text-white shadow-xs"
                      : isDone
                        ? "bg-eco-community text-white"
                        : "bg-background text-muted-foreground border border-border"
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : s.n}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xs font-bold truncate ${
                      active ? "text-navy" : isDone ? "text-navy" : "text-muted-foreground"
                    }`}
                  >
                    {isId ? s.titleId : s.titleEn}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate hidden sm:block">
                    {isId ? s.descId : s.descEn}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
  );
}
