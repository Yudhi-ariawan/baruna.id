// Data Master: bidang keahlian offered on the Become an Expert form.
import { useServerFn } from "@tanstack/react-start";
import {
  saveMasterExpertise,
  setMasterExpertiseActive,
  type MasterExpertise,
} from "@/lib/governance/master-data.functions";
import { TaxonomyMasterPanel } from "./TaxonomyMasterPanel";

export function ExpertiseMasterPanel({ items }: { items: MasterExpertise[] }) {
  const save = useServerFn(saveMasterExpertise);
  const setActive = useServerFn(setMasterExpertiseActive);
  const activeCount = items.filter((i) => i.active).length;
  return (
    <TaxonomyMasterPanel
      title="Bidang Keahlian"
      intro={
        <>
          Bidang aktif ({activeCount}) tampil di formulir <em>Become an Expert</em>. Bidang yang sudah dipakai profil atau
          pengajuan tidak bisa diganti namanya (profil yang tayang menyimpan nama itu); nonaktifkan lalu buat bidang baru.
          Menonaktifkan tidak mengubah profil yang sudah ada.
        </>
      }
      newLabel="Bidang baru"
      newPlaceholder="mis. Seaweed Farming"
      confirmDeactivate={(name) =>
        `Nonaktifkan "${name}"? Bidang ini tidak lagi ditawarkan di formulir; profil yang sudah memakainya tidak berubah.`
      }
      items={items}
      save={(data) => save({ data })}
      setActive={(data) => setActive({ data })}
      invalidate={[["governance", "master-data"], ["experts", "expertise-options"]]}
    />
  );
}
