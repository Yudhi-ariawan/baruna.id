// Data Master: kategori offered on the Request a Training form. Loads on its own,
// so the rest of Data Master keeps working before migration 20261102040000.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMasterTrainingCategories,
  saveMasterTrainingCategory,
  setMasterTrainingCategoryActive,
} from "@/lib/governance/training-categories.functions";
import { TaxonomyMasterPanel } from "./TaxonomyMasterPanel";

const QUERY_KEY = ["governance", "master-data", "training-categories"];

export function TrainingCategoriesPanel() {
  const list = useServerFn(getMasterTrainingCategories);
  const save = useServerFn(saveMasterTrainingCategory);
  const setActive = useServerFn(setMasterTrainingCategoryActive);
  const q = useQuery({ queryKey: QUERY_KEY, queryFn: () => list(), staleTime: 30_000 });

  if (q.isLoading || q.isError || !q.data) {
    return (
      <section className="rounded-2xl border border-border bg-white p-5">
        <h2 className="font-display text-lg font-bold text-navy">Kategori Pelatihan</h2>
        <p className={`mt-1 text-sm ${q.isError ? "text-destructive" : "text-muted-foreground"}`}>
          {q.isError ? (q.error as Error).message : "Memuat…"}
        </p>
      </section>
    );
  }
  const activeCount = q.data.filter((i) => i.active).length;
  return (
    <TaxonomyMasterPanel
      title="Kategori Pelatihan"
      intro={
        <>
          Kategori aktif ({activeCount}) tampil di formulir <em>Request a Training</em> (ditambah pilihan "Other"); permintaan
          dengan kategori di luar daftar ditolak saat dikirim. Kategori yang sudah dipakai permintaan tidak bisa diganti namanya;
          nonaktifkan lalu buat kategori baru. Daftar ini terpisah dari topik Knowledge Hub dan bidang keahlian.
        </>
      }
      newLabel="Kategori baru"
      newPlaceholder="mis. Seaweed Farming"
      confirmDeactivate={(name) =>
        `Nonaktifkan "${name}"? Kategori ini tidak lagi ditawarkan di formulir; permintaan yang sudah memakainya tidak berubah.`
      }
      items={q.data}
      save={(data) => save({ data })}
      setActive={(data) => setActive({ data })}
      invalidate={[QUERY_KEY, ["master", "training-category-options"]]}
    />
  );
}
