import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCmsOverview } from "@/lib/cms/cms.functions";
import { CmsCreate, CmsDrafts, CmsForms, CmsMenu, CmsPages } from "@/components/governance/cms/CmsLists";
import { CMS_QUERY_KEY } from "@/components/governance/cms/cmsLabels";

export const Route = createFileRoute("/governance/cms/")({
  head: () => ({ meta: [{ title: "Konten Situs (CMS) — Konsol Kurasi BARUNA" }] }),
  component: CmsOverviewPage,
});

function CmsOverviewPage() {
  const fn = useServerFn(getCmsOverview);
  const q = useQuery({ queryKey: CMS_QUERY_KEY, queryFn: () => fn(), staleTime: 30_000 });
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-navy">Konten Situs (CMS)</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Menu navigasi, halaman, dan formulir situs dikelola di sini tanpa mengubah kode (kurikulum 3.1, Slide 43). Setiap perubahan
          menjadi draf, lalu tayang setelah disetujui orang lain (Slide 13). Halaman menu yang belum punya isi CMS tetap memakai isi bawaannya.
        </p>
      </header>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Memuat…</p> : null}
      {q.isError ? <p className="text-sm text-destructive">{(q.error as Error).message}</p> : null}
      {q.data ? (
        <>
          <CmsCreate data={q.data} />
          <section className="space-y-2"><h2 className="text-sm font-semibold text-navy">Draf terbuka</h2><CmsDrafts data={q.data} /></section>
          <section className="space-y-2"><h2 className="text-sm font-semibold text-navy">Menu navigasi</h2><CmsMenu data={q.data} /></section>
          <section className="space-y-2"><h2 className="text-sm font-semibold text-navy">Halaman</h2><CmsPages data={q.data} /></section>
          <section className="space-y-2"><h2 className="text-sm font-semibold text-navy">Formulir</h2><CmsForms data={q.data} /></section>
        </>
      ) : null}
    </div>
  );
}
