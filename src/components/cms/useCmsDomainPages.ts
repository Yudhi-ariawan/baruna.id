// The published CMS pages of one menu (About, Community, ...), as sidebar items, so a
// page made in the CMS can be found from its menu without editing the navigation
// (CATATAN_PERBAIKAN 2bt). The menu's own landing page is left out. Empty before the
// migration, on any read error, or when the menu has no extra pages.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { listPublicCmsPages } from "@/lib/cms/cms-public.functions";
import { cmsPagePath, cmsText, type CmsDomain } from "@/lib/cms/cms-types";
import type { SidebarSection } from "@/components/baruna/page/Sidebar";

export function useCmsDomainPages(domain: CmsDomain) {
  const fn = useServerFn(listPublicCmsPages);
  const { language } = useLanguage();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const q = useQuery({
    queryKey: ["cms", "pages", domain],
    queryFn: () => fn({ data: { domain, withText: false } }),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  const items = (q.data ?? [])
    .filter((p) => p.slug !== p.domain)
    .map((p) => {
      const to = cmsPagePath(p);
      return { label: cmsText(language, p.title_id, p.title_en), icon: FileText, to, active: pathname === to };
    });
  return items;
}

/** Sidebar section "Halaman lain" with the menu's CMS pages, or nothing when there are none. */
export function useCmsSidebarSection(domain: CmsDomain): SidebarSection[] {
  const { language } = useLanguage();
  const items = useCmsDomainPages(domain);
  return items.length ? [{ label: language === "id" ? "Halaman lain" : "More pages", items }] : [];
}
