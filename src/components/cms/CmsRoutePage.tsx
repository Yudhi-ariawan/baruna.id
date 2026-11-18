// Public frame for CMS content: the normal site shell around a published page or form.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { PageShell } from "@/components/baruna/page/PageShell";
import type { CmsPublicPage } from "@/lib/cms/cms-types";
import { CmsPageView } from "./CmsPageView";

export function CmsRoutePage({ page }: { page: CmsPublicPage }) {
  return (
    <PageShell sidebar={null} cta={null}>
      <CmsPageView page={page} />
    </PageShell>
  );
}

/** A built-in menu page that a published CMS page with the same address replaces. */
export function CmsOrBuiltIn({ page, children }: { page: CmsPublicPage | null | undefined; children: ReactNode }) {
  return page ? <CmsRoutePage page={page} /> : <>{children}</>;
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
