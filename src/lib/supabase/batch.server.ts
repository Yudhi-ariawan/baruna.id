/**
 * Helpers for reads that must keep working as tables grow.
 *
 * - PostgREST caps every response at `max-rows` (1000 on Supabase). A plain
 *   `.select()` silently returns only the first 1000 rows, so lists above that
 *   size lose data without any error. `fetchAllPages` keeps requesting ranges.
 * - `.in("id", ids)` puts every id in the URL. Hundreds of UUIDs exceed URL
 *   limits and the request fails. `fetchByIdChunks` splits the ids.
 *
 * Both throw on the first error so callers never mistake a failure for an
 * empty result.
 */

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

const PAGE_SIZE = 1000;
const ID_CHUNK = 100;
const MAX_PAGES = 200; // hard stop: 200k rows

export async function fetchAllPages<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const from = i * PAGE_SIZE;
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
  throw new Error("Data terlalu besar untuk dimuat sekaligus.");
}

/** `chunk` must apply a stable order, because each id chunk is itself paged. */
export async function fetchByIdChunks<T>(
  ids: readonly string[],
  chunk: (ids: string[], from: number, to: number) => PageResult<T>,
): Promise<T[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const out: T[] = [];
  for (let i = 0; i < unique.length; i += ID_CHUNK) {
    const part = unique.slice(i, i + ID_CHUNK);
    out.push(...(await fetchAllPages<T>((from, to) => chunk(part, from, to))));
  }
  return out;
}
