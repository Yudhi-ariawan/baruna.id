// Site menu for the Navbar: the menu approved in the CMS (cms_menu_public_v) when one
// exists, otherwise the built-in menu. Before the migration, or on any read error,
// the built-in menu is used, so the Navbar never breaks.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen, CalendarDays, GraduationCap, Globe, Handshake, Home, Info, Link2, MessagesSquare, Users, type LucideIcon,
} from "lucide-react";
import { getPublicCmsMenu } from "@/lib/cms/cms-public.functions";
import { cmsText, type CmsMenuIcon } from "@/lib/cms/cms-types";

export type SiteMenuItem = { id: string; label: string; href: string; external: boolean; icon: LucideIcon; children: SiteMenuItem[] };

const ICONS: Record<CmsMenuIcon, LucideIcon> = {
  home: Home, academy: GraduationCap, knowledge: BookOpen, experts: Users, fellowship: Globe,
  community: MessagesSquare, events: CalendarDays, partnership: Handshake, about: Info, link: Link2,
};

export function useSiteMenu(builtIn: SiteMenuItem[], language: string): SiteMenuItem[] {
  const fn = useServerFn(getPublicCmsMenu);
  const q = useQuery({ queryKey: ["cms", "menu"], queryFn: () => fn(), staleTime: 5 * 60_000, gcTime: 30 * 60_000 });
  const rows = q.data ?? [];
  if (!rows.length) return builtIn;
  const toItem = (r: (typeof rows)[number]): SiteMenuItem => ({
    id: r.id, label: cmsText(language, r.label_id, r.label_en), href: r.href, external: r.is_external,
    icon: (r.icon && ICONS[r.icon]) || Link2, children: [],
  });
  const top = rows.filter((r) => !r.parent_id).sort((a, b) => a.sort_order - b.sort_order).map(toItem);
  for (const item of top) {
    item.children = rows.filter((r) => r.parent_id === item.id).sort((a, b) => a.sort_order - b.sort_order).map(toItem);
  }
  return top;
}
