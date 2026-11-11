// Which application course ids are Course Offerings, and their offering code
// (CATATAN_PERBAIKAN 2ay). New applications use the offering code; applications from
// before 2as may hold the offering TITLE instead (admin_course_enrollment_decide
// still matches titles). Same preference as that RPC: code first, then the most
// recent offering with that title.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Map from each id that names an offering (by code or by title) to its offering code. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveOfferingIds(db: any, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  // UUIDs are modules; quotes and backslashes cannot be passed safely in a list filter.
  const candidates = [...new Set(ids)].filter((id) => id && !UUID.test(id) && !/["\\]/.test(id));
  if (candidates.length === 0) return out;
  const [byCode, byTitle] = await Promise.all([
    db.from("course_offerings").select("offering_code").in("offering_code", candidates),
    db.from("course_offerings").select("offering_code, offering_title, created_at").in("offering_title", candidates)
      .order("created_at", { ascending: false }),
  ]);
  if (byCode.error) throw new Error(byCode.error.message);
  if (byTitle.error) throw new Error(byTitle.error.message);
  for (const o of (byCode.data ?? []) as Array<{ offering_code: string }>) out.set(o.offering_code, o.offering_code);
  for (const o of (byTitle.data ?? []) as Array<{ offering_code: string; offering_title: string }>) {
    if (!out.has(o.offering_title)) out.set(o.offering_title, o.offering_code);
  }
  return out;
}
