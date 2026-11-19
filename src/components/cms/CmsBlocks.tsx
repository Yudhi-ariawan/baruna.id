// Renders CMS page blocks for visitors (and for the editor preview). Text comes in
// the visitor's language with Indonesian as fallback; links and images were checked
// by the database and are checked again here before use.
import { Link } from "@tanstack/react-router";
import { ArrowRight, ExternalLink, FileText } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cmsImageUrl, cmsText, type CmsBlock, type CmsPublicForm } from "@/lib/cms/cms-types";
import { urlOk } from "@/lib/cms/cms-validation";
import { CmsRichText } from "./CmsRichText";
import { CmsFormView } from "./CmsFormView";

function SmartLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  if (!urlOk(href)) return <span className={className}>{children}</span>;
  if (href.startsWith("https://")) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
  }
  return <Link to={href} className={className}>{children}</Link>;
}

export function CmsBlocks({ blocks, forms, preview = false }: { blocks: CmsBlock[]; forms: CmsPublicForm[]; preview?: boolean }) {
  const { language } = useLanguage();
  const t = (id?: string | null, en?: string | null) => cmsText(language, id, en);

  return (
    <div className="space-y-8">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "banner": {
            const img = cmsImageUrl(b.image);
            return (
              <section key={i} className="relative overflow-hidden rounded-3xl bg-navy text-white shadow-soft">
                {img ? <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" /> : null}
                <div className="relative space-y-3 p-6 sm:p-10">
                  <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{t(b.title_id, b.title_en)}</h2>
                  {t(b.text_id, b.text_en) ? <p className="max-w-2xl text-sm text-white/85 sm:text-base">{t(b.text_id, b.text_en)}</p> : null}
                  {(b.stats ?? []).length ? (
                    <dl className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
                      {(b.stats ?? []).map((s, j) => (
                        <div key={j} className="rounded-2xl bg-white/10 px-3 py-2">
                          <dt className="text-[11px] uppercase tracking-wide text-white/70">{t(s.label_id, s.label_en)}</dt>
                          <dd className="font-display text-xl font-bold">{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              </section>
            );
          }
          case "text":
            return (
              <section key={i} className="space-y-2">
                {t(b.heading_id, b.heading_en) ? <h2 className="font-display text-xl font-bold text-navy">{t(b.heading_id, b.heading_en)}</h2> : null}
                <CmsRichText text={t(b.body_id, b.body_en)} />
              </section>
            );
          case "media": {
            const img = cmsImageUrl(b.image);
            const left = b.image_side === "left";
            const heading = t(b.heading_id, b.heading_en);
            return (
              <section key={i} className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  <div className={`space-y-3 p-6 sm:p-8 ${left ? "lg:order-2" : ""}`}>
                    {heading ? <h2 className="font-display text-2xl font-bold text-navy">{heading}</h2> : null}
                    <CmsRichText text={t(b.body_id, b.body_en)} className="text-muted-foreground" />
                  </div>
                  {img ? (
                    <div className={`relative min-h-[220px] ${left ? "lg:order-1" : ""}`}>
                      <img src={img} alt={heading} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    </div>
                  ) : null}
                </div>
              </section>
            );
          }
          case "gallery":
            return (
              <section key={i} className="space-y-3">
                {t(b.heading_id, b.heading_en) ? <h2 className="font-display text-xl font-bold text-navy">{t(b.heading_id, b.heading_en)}</h2> : null}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {b.items.map((p, j) => {
                    const img = cmsImageUrl(p.image);
                    const caption = t(p.caption_id, p.caption_en);
                    return img ? (
                      <figure key={j} className="space-y-1.5">
                        <img src={img} alt={caption} loading="lazy" className="h-32 w-full rounded-xl object-cover sm:h-36" />
                        {caption ? <figcaption className="text-xs text-muted-foreground">{caption}</figcaption> : null}
                      </figure>
                    ) : null;
                  })}
                </div>
              </section>
            );
          case "cards":
            return (
              <section key={i} className="space-y-3">
                {t(b.heading_id, b.heading_en) ? <h2 className="font-display text-xl font-bold text-navy">{t(b.heading_id, b.heading_en)}</h2> : null}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {b.items.map((c, j) => {
                    const img = cmsImageUrl(c.image);
                    const body = (
                      <>
                        {img ? <img src={img} alt="" className="h-36 w-full object-cover" /> : null}
                        <div className="space-y-1.5 p-4">
                          <h3 className="font-display text-base font-bold text-navy">{t(c.title_id, c.title_en)}</h3>
                          {t(c.text_id, c.text_en) ? <p className="text-sm text-muted-foreground">{t(c.text_id, c.text_en)}</p> : null}
                          {c.url ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-marine">Selengkapnya <ArrowRight className="h-3 w-3" /></span> : null}
                        </div>
                      </>
                    );
                    const cls = "block overflow-hidden rounded-2xl border border-border bg-card shadow-soft";
                    return c.url ? <SmartLink key={j} href={c.url} className={`${cls} hover:border-marine`}>{body}</SmartLink> : <div key={j} className={cls}>{body}</div>;
                  })}
                </div>
              </section>
            );
          case "cta":
            return (
              <section key={i} className="flex flex-col items-start gap-3 rounded-3xl border border-marine/20 bg-marine/5 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h2 className="font-display text-lg font-bold text-navy">{t(b.title_id, b.title_en)}</h2>
                  {t(b.text_id, b.text_en) ? <p className="text-sm text-muted-foreground">{t(b.text_id, b.text_en)}</p> : null}
                </div>
                <SmartLink href={b.url} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-marine px-4 py-2 text-sm font-semibold text-white hover:bg-navy">
                  {t(b.button_id, b.button_en)} <ArrowRight className="h-4 w-4" />
                </SmartLink>
              </section>
            );
          case "faq":
            return (
              <section key={i} className="space-y-3">
                {t(b.heading_id, b.heading_en) ? <h2 className="font-display text-xl font-bold text-navy">{t(b.heading_id, b.heading_en)}</h2> : null}
                <div className="divide-y divide-border rounded-2xl border border-border bg-card">
                  {b.items.map((q, j) => (
                    <details key={j} className="group p-4">
                      <summary className="cursor-pointer list-none font-semibold text-navy">{t(q.q_id, q.q_en)}</summary>
                      <div className="mt-2"><CmsRichText text={t(q.a_id, q.a_en)} /></div>
                    </details>
                  ))}
                </div>
              </section>
            );
          case "links":
            return (
              <section key={i} className="space-y-3">
                {t(b.heading_id, b.heading_en) ? <h2 className="font-display text-xl font-bold text-navy">{t(b.heading_id, b.heading_en)}</h2> : null}
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {b.items.map((l, j) => (
                    <li key={j}>
                      <SmartLink href={l.url} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-navy hover:border-marine">
                        {l.url.startsWith("https://") ? <ExternalLink className="h-4 w-4 text-marine" /> : <FileText className="h-4 w-4 text-marine" />}
                        {t(l.label_id, l.label_en)}
                      </SmartLink>
                    </li>
                  ))}
                </ul>
              </section>
            );
          case "form": {
            const form = forms.find((f) => f.slug === b.form_slug);
            return form ? (
              <CmsFormView key={i} form={form} preview={preview} />
            ) : (
              <p key={i} className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Formulir ini sedang tidak menerima kiriman.</p>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
