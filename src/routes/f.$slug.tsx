// An open CMS form on its own address /f/<slug> (Dynamic CMS, kurikulum 3.1, CATATAN_PERBAIKAN 2br).
import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicCmsForms } from "@/lib/cms/cms-public.functions";
import { CmsFormView } from "@/components/cms/CmsFormView";
import { CmsNotFound, CmsShell } from "@/components/cms/CmsRoutePage";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const Route = createFileRoute("/f/$slug")({
  loader: async ({ params }) => {
    if (!SLUG.test(params.slug) || params.slug.length > 80) throw notFound();
    const [form] = await getPublicCmsForms({ data: { slugs: [params.slug] } });
    if (!form) throw notFound();
    return { form };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.form.title_id ?? "Formulir"} — BARUNA` }] }),
  notFoundComponent: () => <CmsNotFound what="form" />,
  component: CmsPublicFormRoute,
});

function CmsPublicFormRoute() {
  const { form } = Route.useLoaderData();
  return (
    <CmsShell>
      <div className="mx-auto max-w-2xl">
        <CmsFormView form={form} />
      </div>
    </CmsShell>
  );
}
