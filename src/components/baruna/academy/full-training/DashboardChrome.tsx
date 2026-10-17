import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  ArrowLeft,
  Lock,
  CheckCircle2,
  GraduationCap,
  Clock,
  Layers,
  Target,
  type LucideIcon,
} from "lucide-react";

export function DashHeader({ id, title }: { id: string; title: string }) {
  return (
    <>
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to="/academy/applications" className="font-medium text-foreground/70 hover:text-marine">My Learning</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-navy">{id}</span>
      </nav>
      <div className="mt-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-marine">Learning Dashboard</p>
            <h1 className="font-display text-xl font-bold text-navy">{title}</h1>
          </div>
        </div>
        <Link
          to="/academy/applications/$id"
          params={{ id }}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-marine hover:text-navy"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to application status
        </Link>
      </div>
    </>
  );
}

export function ProgressSummary({
  overall,
  completedModules,
  remainingModules,
  totalModules,
  hours,
}: {
  overall: number;
  completedModules: number;
  remainingModules: number;
  totalModules: number;
  hours: number;
}) {
  const stats: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Layers, label: "Completed Modules", value: `${completedModules}/${totalModules}` },
    { icon: Target, label: "Remaining Modules", value: `${remainingModules}` },
    { icon: Clock, label: "Estimated Hours", value: `${hours}h` },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="lg:w-72">
          <div className="flex items-end justify-between">
            <p className="font-display text-sm font-bold text-navy">Overall Progress</p>
            <span className="font-display text-2xl font-extrabold text-marine">{overall}%</span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-marine transition-all" style={{ width: `${overall}%` }} />
          </div>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-marine/10 text-marine">
                <s.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="font-display text-base font-bold text-navy">{s.value}</p>
                <p className="text-[0.7rem] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function JourneyTracker({
  steps,
  percent,
}: {
  steps: { label: string; done: boolean; unlocked: boolean }[];
  percent: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-navy">Assessment Journey</h2>
        <span className="text-sm font-semibold text-marine">{percent}% complete</span>
      </div>
      <div className="mt-4 flex flex-wrap items-start gap-y-4">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-start">
            <div className="flex w-20 flex-col items-center text-center sm:w-24">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  s.done
                    ? "bg-badge-training/15 text-badge-training"
                    : s.unlocked
                      ? "bg-marine/10 text-marine"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {s.done ? <CheckCircle2 className="h-5 w-5" /> : !s.unlocked ? <Lock className="h-4 w-4" /> : i + 1}
              </span>
              <p className={`mt-2 text-[0.65rem] font-semibold leading-tight ${s.done || s.unlocked ? "text-navy" : "text-muted-foreground"}`}>
                {s.label}
              </p>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionIntro({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-display text-lg font-bold text-navy">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}
