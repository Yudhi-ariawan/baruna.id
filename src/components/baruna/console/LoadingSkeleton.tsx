// Loading placeholder for console and admin pages: grey bars with a light sweeping
// across (skeleton shimmer) instead of the text "Memuat…". The text stays for screen
// readers (role="status").
import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return <div className={cn("skeleton-shimmer rounded-md", className)} />;
}

/** A few list rows (cards or table rows). */
export function LoadingSkeleton({ rows = 3, label = "Memuat…", className }: { rows?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("space-y-3", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4">
          <Bar className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Bar className={cn("h-3.5", i % 2 ? "w-1/2" : "w-2/3")} />
            <Bar className="h-3 w-1/3" />
          </div>
          <Bar className="hidden h-7 w-20 sm:block" />
        </div>
      ))}
    </div>
  );
}

/** One row inside an existing table while it loads. */
export function LoadingTableRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-4">
        <span className="sr-only">Memuat…</span>
        <div className="space-y-2">
          <Bar className="h-3.5 w-2/3" />
          <Bar className="h-3.5 w-1/2" />
        </div>
      </td>
    </tr>
  );
}
