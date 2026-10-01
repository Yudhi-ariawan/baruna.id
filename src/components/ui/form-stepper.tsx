import { Check } from "lucide-react";

export interface StepItem {
  id: string | number;
  title: string;
  description?: string;
}

export interface FormStepperProps {
  steps: StepItem[];
  currentStep: number; // 1-indexed
  onStepClick?: (stepIndex: number) => void;
  className?: string;
  allowStepClick?: boolean;
}

export function FormStepper({
  steps,
  currentStep,
  onStepClick,
  className = "",
  allowStepClick = false,
}: FormStepperProps) {
  return (
    <nav aria-label="Progress" className={`w-full ${className}`}>
      <ol className="flex items-center justify-between gap-2 sm:gap-4 w-full">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isClickable = allowStepClick && onStepClick && (isCompleted || isCurrent);

          return (
            <li
              key={step.id}
              className={`relative flex-1 ${index !== steps.length - 1 ? "pr-4 sm:pr-8" : ""}`}
            >
              {/* Connecting Line */}
              {index !== steps.length - 1 && (
                <div
                  className="absolute top-4 left-7 sm:left-9 -ml-px w-[calc(100%-2rem)] sm:w-[calc(100%-2.5rem)] h-0.5 bg-slate-200"
                  aria-hidden="true"
                >
                  <div
                    className="h-full bg-marine transition-all duration-300"
                    style={{
                      width: isCompleted ? "100%" : "0%",
                    }}
                  />
                </div>
              )}

              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick?.(stepNumber)}
                className={`group flex items-center text-left w-full ${
                  isClickable ? "cursor-pointer" : "cursor-default"
                }`}
              >
                {/* Step Circle with Number or Green Checkmark */}
                <span className="flex items-center">
                  <span
                    className={`grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-full text-xs font-bold transition-all duration-200 ${
                      isCompleted
                        ? "bg-emerald-600 text-white shadow-xs ring-4 ring-emerald-100"
                        : isCurrent
                        ? "bg-navy text-white shadow-sm ring-4 ring-navy/10"
                        : "border-2 border-slate-200 bg-white text-slate-400"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 stroke-[3]" />
                    ) : (
                      <span>{stepNumber}</span>
                    )}
                  </span>
                </span>

                {/* Step Title & Description */}
                <span className="ml-2.5 sm:ml-3 min-w-0 hidden sm:block">
                  <span
                    className={`block text-xs font-bold truncate ${
                      isCurrent
                        ? "text-navy"
                        : isCompleted
                        ? "text-emerald-700"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </span>
                  {step.description && (
                    <span className="block text-[10px] text-muted-foreground truncate">
                      {step.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
