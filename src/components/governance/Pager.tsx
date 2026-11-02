// Display pagination for console queues. The data is already read in batches on
// the server (fetchAllPages); this only keeps the page light when a queue holds
// hundreds or thousands of rows. Filters and search still apply to the whole list.
import { QUEUE_PAGE_SIZE, type usePagedList } from "@/lib/governance/usePagedList";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PagerProps = Pick<ReturnType<typeof usePagedList>, "page" | "pageCount" | "total" | "from" | "to" | "setPage">;

export function Pager({ page, pageCount, total, from, to, setPage }: PagerProps) {
  if (total <= QUEUE_PAGE_SIZE && pageCount <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-1 pt-3 text-xs text-muted-foreground">
      <span>
        Menampilkan {from}–{to} dari {total}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-semibold text-navy hover:bg-muted disabled:opacity-40">
          <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
        </button>
        <span className="px-2 font-semibold text-navy">
          {page} / {pageCount}
        </span>
        <button type="button" onClick={() => setPage(page + 1)} disabled={page >= pageCount}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-semibold text-navy hover:bg-muted disabled:opacity-40">
          Berikutnya <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
