// Display pagination for console queues (see Pager.tsx).
import { useEffect, useState } from "react";

export const QUEUE_PAGE_SIZE = 25;

/**
 * Current page of `items`. Goes back to page 1 when `resetKey` changes (filter or
 * search), and stays within range when the list shrinks (e.g. after a decision).
 */
export function usePagedList<T>(items: T[], resetKey: string, pageSize = QUEUE_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [resetKey]);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    page: current,
    pageCount,
    total: items.length,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + pageSize, items.length),
    setPage,
  };
}
