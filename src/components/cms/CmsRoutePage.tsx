// Public frame for CMS content: the normal site shell around a published page or form.
// A /p/<slug> page gets the sidebar of its menu (CATATAN_PERBAIKAN 2bt).
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { PageShell } from "@/components/baruna/page/PageShell";
import { CalendarDays, Globe, Handshake, Home, Info, MessagesSquare, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { CMS_DOMAIN_LABEL, type CmsDomain, type CmsPublicPage } from "@/lib/cms/cms-types";
import { CmsPageView } from "./CmsPageView";
import { useCmsDomainPages } from "./useCmsDomainPages";

const DOMAIN_ICON: Record<CmsDomain, LucideIcon> = {
  about: Info, community: MessagesSquare, fellowship: Globe, partnership: Handshake, events: CalendarDays,
};
/** Where "back to the menu" goes: the menu's own page (Events: its event hub). */
const DOMAIN_HOME: Record<CmsDomain, string> = {
  about: "/about", community: "/community", fellowship: "/fellowship", partnership: "/partnership", events: "/events",
};

/** A page at /p/<slug>: framed by a sidebar of its menu, listing the menu's other CMS pages. */
export function CmsRoutePage({ page }: { page: CmsPublicPage }) {
  const { language } = useLanguage();
  const others = useCmsDomainPages(page.domain);
  const id = language === "id";
  const label = CMS_DOMAIN_LABEL[page.domain];
  return (
    <PageShell
      sidebar={{
        icon: DOMAIN_ICON[page.domain],
        title: label,
        subtitle: id ? `Halaman di menu ${label}.` : `Pages of the ${label} menu.`,
        sections: [{
          label: id ? "Halaman" : "Pages",
          items: [{ label: id ? `Halaman utama ${label}` : `${label} main page`, icon: Home, to: DOMAIN_HOME[page.domain] }, ...others],
        }],
      }}
      cta={null}
    >
      <CmsPageView page={page} />
    </PageShell>
  );
}

/** Content of a built-in menu page (About, Community, Fellowship, Partnership): the
 *  published CMS page with the menu's address when there is one, otherwise the
 *  built-in content. The page keeps its own frame (sidebar and closing banner). */
export function CmsFramedContent({ page, children }: { page: CmsPublicPage | null | undefined; children: ReactNode }) {
  return page ? <CmsPageView page={page} /> : <>{children}</>;
}

export function CmsShell({ children }: { children: ReactNode }) {
  return (
    <PageShell sidebar={null} cta={null}>
      {children}
    </PageShell>
  );
}

export function CmsNotFound({ what }: { what: "page" | "form" }) {
  return (
    <CmsShell>
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">
          {what === "page" ? "Halaman tidak ditemukan / Page not found" : "Formulir tidak ditemukan / Form not found"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {what === "page" ? "Halaman ini belum tayang atau sudah ditarik." : "Formulir ini belum dibuka atau sudah ditutup."}
        </p>
        <Link to="/" className="mt-5 inline-flex rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground">
          Beranda / Home
        </Link>
      </div>
    </CmsShell>
  );
}
