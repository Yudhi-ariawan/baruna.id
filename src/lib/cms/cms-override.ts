// Route loader for a built-in menu page (About, Community, Fellowship, Partnership):
// its published CMS page, or null so the built-in content stays (CATATAN_PERBAIKAN 2br).
import { getPublicCmsPage } from "./cms-public.functions";
import type { CmsPublicPage } from "./cms-types";

export async function loadCmsOverride(slug: string): Promise<CmsPublicPage | null> {
  return getPublicCmsPage({ data: { slug } }).catch(() => null);
}
