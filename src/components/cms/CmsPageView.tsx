// A whole CMS page: title, summary and blocks, with the open forms its form blocks use.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useLanguage } from "@/lib/i18n";
import { cmsText, type CmsBlock } from "@/lib/cms/cms-types";
import { getPublicCmsForms } from "@/lib/cms/cms-public.functions";
import { CmsBlocks } from "./CmsBlocks";

type PageLike = { title_id: string; title_en?: string | null; summary_id?: string | null; summary_en?: string | null; blocks: CmsBlock[] };

export function CmsPageView({ page, preview = false }: { page: PageLike; preview?: boolean }) {
  const { language } = useLanguage();
  const getForms = useServerFn(getPublicCmsForms);
  const slugs = Array.from(new Set(page.blocks.flatMap((b) => (b.type === "form" && b.form_slug ? [b.form_slug] : []))));
  const formsQ = useQuery({
    queryKey: ["cms", "forms", slugs.join(",")],
    queryFn: () => getForms({ data: { slugs } }),
    enabled: slugs.length > 0,
    staleTime: 60_000,
  });
  const summary = cmsText(language, page.summary_id, page.summary_en);
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-extrabold text-navy">{cmsText(language, page.title_id, page.title_en)}</h1>
        {summary ? <p className="max-w-3xl text-base text-muted-foreground">{summary}</p> : null}
      </header>
      <CmsBlocks blocks={page.blocks} forms={formsQ.data ?? []} preview={preview} />
    </article>
  );
}
