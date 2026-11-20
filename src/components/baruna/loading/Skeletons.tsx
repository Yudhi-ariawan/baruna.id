// Loading placeholders for the whole site: grey shapes with a light sweeping across
// (`.skeleton-shimmer` in styles.css, stopped under "reduce motion"). Each keeps a
// screen-reader text (role="status"), so replacing "Loading…" text loses nothing.
// The console list rows (LoadingSkeleton / LoadingTableRow) are re-exported here too.
import { cn } from "@/lib/utils";
export { LoadingSkeleton as ListSkeleton, LoadingTableRow } from "@/components/baruna/console/LoadingSkeleton";

export function SkeletonBar({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton-shimmer rounded-md", className)} />;
}

function Status({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Stand-in for a select / input that is still loading its options. */
export function FieldSkeleton({ label = "Memuat…", className }: { label?: string; className?: string }) {
  return (
    <Status label={label} className={className}>
      <SkeletonBar className="h-10 w-full rounded-lg" />
    </Status>
  );
}

/** Row of choice chips (topic / expertise pickers) that is still loading. */
export function ChipsSkeleton({ count = 8, label = "Memuat…", className }: { count?: number; label?: string; className?: string }) {
  const widths = ["w-20", "w-28", "w-24", "w-32", "w-16", "w-24", "w-28", "w-20"];
  return (
    <Status label={label} className={cn("flex flex-wrap gap-2", className)}>
      {Array.from({ length: count }, (_, i) => <SkeletonBar key={i} className={cn("h-8 rounded-full", widths[i % widths.length])} />)}
    </Status>
  );
}

/** A few short lines (inside a card, a dialog, or next to a button). */
export function LinesSkeleton({ lines = 3, label = "Memuat…", className }: { lines?: number; label?: string; className?: string }) {
  return (
    <Status label={label} className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBar key={i} className={cn("h-3.5", i === lines - 1 ? "w-1/2" : i % 2 ? "w-5/6" : "w-full")} />
      ))}
    </Status>
  );
}

/** One card: title line and a few text lines. */
export function PanelSkeleton({ lines = 3, label = "Memuat…", className }: { lines?: number; label?: string; className?: string }) {
  return (
    <Status label={label} className={cn("rounded-2xl border border-border bg-card p-5 shadow-soft", className)}>
      <SkeletonBar className="h-4 w-1/3" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <SkeletonBar key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </Status>
  );
}

/** Row of figure tiles (dashboard counters). */
export function StatsSkeleton({ count = 4, label = "Memuat…", className }: { count?: number; label?: string; className?: string }) {
  return (
    <Status label={label} className={cn("grid grid-cols-2 gap-3 xl:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <SkeletonBar className="h-3 w-2/3" />
          <SkeletonBar className="mt-3 h-7 w-12" />
        </div>
      ))}
    </Status>
  );
}

/** Grid of catalog cards (image on top, title, two lines). */
export function CardGridSkeleton({ count = 6, label = "Memuat…", className }: { count?: number; label?: string; className?: string }) {
  return (
    <Status label={label} className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <SkeletonBar className="h-36 w-full rounded-none" />
          <div className="space-y-2 p-4">
            <SkeletonBar className="h-4 w-3/4" />
            <SkeletonBar className="h-3 w-full" />
            <SkeletonBar className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </Status>
  );
}

/** Content area of a page: heading, figures, and a list. For whole-page waits. */
export function PageSkeleton({ label = "Memuat halaman…", className, withStats = true }: { label?: string; className?: string; withStats?: boolean }) {
  return (
    <Status label={label} className={cn("space-y-6", className)}>
      <div className="space-y-3">
        <SkeletonBar className="h-5 w-32 rounded-full" />
        <SkeletonBar className="h-8 w-2/3 max-w-md" />
        <SkeletonBar className="h-3.5 w-full max-w-xl" />
      </div>
      {withStats ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <SkeletonBar className="h-3 w-2/3" />
              <SkeletonBar className="mt-3 h-7 w-12" />
            </div>
          ))}
        </div>
      ) : null}
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <SkeletonBar className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <SkeletonBar className={cn("h-3.5", i % 2 ? "w-1/2" : "w-2/3")} />
              <SkeletonBar className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </Status>
  );
}

/** Full-screen wait outside any page frame (session checks, route changes). */
export function ScreenSkeleton({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="min-h-[60vh] bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <PageSkeleton label={label} />
      </div>
    </div>
  );
}
