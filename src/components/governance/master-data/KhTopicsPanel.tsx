// Data Master: topik offered on the Knowledge Hub contribution form. Loads on its
// own, so the rest of Data Master keeps working before migration 20261102020000.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMasterKhTopics, saveMasterKhTopic, setMasterKhTopicActive } from "@/lib/governance/kh-topics.functions";
import { TaxonomyMasterPanel } from "./TaxonomyMasterPanel";

const QUERY_KEY = ["governance", "master-data", "kh-topics"];

export function KhTopicsPanel() {
  const list = useServerFn(getMasterKhTopics);
  const save = useServerFn(saveMasterKhTopic);
  const setActive = useServerFn(setMasterKhTopicActive);
  const q = useQuery({ queryKey: QUERY_KEY, queryFn: () => list(), staleTime: 30_000 });

  if (q.isLoading || q.isError || !q.data) {
    return (
      <section className="rounded-2xl border border-border bg-white p-5">
        <h2 className="font-display text-lg font-bold text-navy">Topik Knowledge Hub</h2>
        <p className={`mt-1 text-sm ${q.isError ? "text-destructive" : "text-muted-foreground"}`}>
          {q.isError ? (q.error as Error).message : "Memuat…"}
        </p>
      </section>
    );
  }
  const activeCount = q.data.filter((i) => i.active).length;
  return (
    <TaxonomyMasterPanel
      title="Topik Knowledge Hub"
      intro={
        <>
          Topik aktif ({activeCount}) tampil di formulir <em>Contribute Knowledge</em>; pengajuan dengan topik di luar daftar
          ditolak saat dikirim. Topik yang sudah dipakai publikasi atau pengajuan tidak bisa diganti namanya (publikasi yang
          tayang menyimpan nama itu); nonaktifkan lalu buat topik baru. Menonaktifkan tidak mengubah publikasi yang sudah ada.
        </>
      }
      newLabel="Topik baru"
      newPlaceholder="mis. Seaweed Farming"
      confirmDeactivate={(name) =>
        `Nonaktifkan "${name}"? Topik ini tidak lagi ditawarkan di formulir; publikasi yang sudah memakainya tidak berubah.`
      }
      items={q.data}
      save={(data) => save({ data })}
      setActive={(data) => setActive({ data })}
      invalidate={[QUERY_KEY, ["knowledge-hub", "topic-options"]]}
    />
  );
}
