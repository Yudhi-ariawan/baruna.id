// A published CMS page at /p/<slug> (Dynamic CMS, kurikulum 3.1, CATATAN_PERBAIKAN 2br).
import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicCmsPage } from "@/lib/cms/cms-public.functions";
import { CmsNotFound, CmsRoutePage } from "@/components/cms/CmsRoutePage";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    if (!SLUG.test(params.slug) || params.slug.length > 80) throw notFound();
    const page = await getPublicCmsPage({ data: { slug: params.slug } });
    if (!page) throw notFound();
    return { page };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.page.title_id ?? "Halaman"} — BARUNA` },
      ...(loaderData?.page.summary_id ? [{ name: "description", content: loaderData.page.summary_id }] : []),
    ],
  }),
  notFoundComponent: () => <CmsNotFound what="page" />,
  component: CmsPublicPageRoute,
});

function CmsPublicPageRoute() {
  const { page } = Route.useLoaderData();
  return <CmsRoutePage page={page} />;
}
