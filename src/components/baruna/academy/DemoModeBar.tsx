import { MonitorPlay, Eye } from "lucide-react";
import { useDemoMode } from "@/lib/demoMode";

/**
 * Presenter / administrator control for Demo Mode.
 *
 * Renders a toggle to switch Demo Mode ON/OFF and, when active, a clearly
 * visible "DEMO MODE ACTIVE" badge. Demo Mode only relaxes navigation locks so
 * presenters can walk through the full participant journey — it never alters
 * participant progress, quiz results, attendance or certificates.
 */
export function DemoModeBar() {
  const [on, setDemo] = useDemoMode();

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between ${
        on ? "border-star bg-star/15" : "border-dashed border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            on ? "bg-star/30 text-accent" : "bg-muted text-muted-foreground"
          }`}
        >
          <MonitorPlay className="h-5 w-5" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-navy">Demo Mode</p>
            {on && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-accent-foreground">
                <Eye className="h-3 w-3" /> Demo Mode Active
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Presenter control · unlocks every phase for demonstration only. Participant progress,
            quiz results and certificates are never changed.
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Toggle Demo Mode"
        onClick={() => setDemo(!on)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
          on ? "bg-accent" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-card shadow-sm transition-transform ${
            on ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
