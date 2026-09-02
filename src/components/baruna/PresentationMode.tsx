import { useEffect, useState } from "react";
import { MonitorPlay, X, Info, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { usePresentationMode } from "@/lib/demoMode";

/**
 * Global Presentation / Demo Mode controls — mounted once in __root.tsx so they
 * are available on EVERY page of BARUNA.
 *
 * - A small floating control (bottom-right) lets a presenter switch the single
 *   global Presentation Mode flag ON/OFF from anywhere.
 * - When ON, a slim banner is fixed to the top of the viewport reminding the
 *   audience that all content is for demonstration only and nothing is saved.
 *
 * This component only reflects/toggles the flag — the data-safety guarantees
 * (no DB writes, no progress changes) live in the stores and feature pages.
 */
export function PresentationMode() {
  const [on, setPresentation] = usePresentationMode();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <>
      {on && (
        <div className="fixed inset-x-0 top-0 z-[60] border-b border-marine/30 bg-marine text-marine-foreground shadow-soft">
          <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-2 sm:px-6">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/20">
              <Info className="h-3.5 w-3.5" />
            </span>
            <p className="min-w-0 flex-1 text-[0.72rem] leading-tight sm:text-xs">
              <span className="font-bold uppercase tracking-wide">Presentation Mode</span>
              <span className="hidden sm:inline">
                {" "}
                — All content shown is for demonstration purposes only. No participant progress, quiz
                results, assignments, certificates, or database records are modified.
              </span>
            </p>
            <Link
              to="/demo"
              className="hidden shrink-0 items-center gap-1 rounded-md bg-white/15 px-2.5 py-1 text-[0.7rem] font-semibold transition-colors hover:bg-white/25 sm:inline-flex"
            >
              <Sparkles className="h-3.5 w-3.5" /> Demo Hub
            </Link>
            <button
              type="button"
              onClick={() => setPresentation(false)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/15 px-2.5 py-1 text-[0.7rem] font-semibold transition-colors hover:bg-white/25"
            >
              <X className="h-3.5 w-3.5" /> Exit
            </button>
          </div>
        </div>
      )}

      {/* Floating presenter control — available on every page */}
      <button
        type="button"
        onClick={() => setPresentation(!on)}
        aria-pressed={on}
        className={`fixed bottom-4 right-4 z-[60] inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold shadow-lg transition-colors ${
          on
            ? "bg-accent text-accent-foreground hover:bg-accent/90"
            : "border border-border bg-card text-navy hover:bg-muted"
        }`}
      >
        <MonitorPlay className="h-4 w-4" />
        {on ? "Presentation Mode: ON" : "Presentation Mode"}
      </button>
    </>
  );
}
