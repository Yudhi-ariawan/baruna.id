import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Database } from "lucide-react";
import { getMasterData } from "@/lib/governance/master-data.functions";
import { ExpertiseMasterPanel } from "@/components/governance/master-data/ExpertiseMasterPanel";
import { TrainerLevelsPanel } from "@/components/governance/master-data/TrainerLevelsPanel";
import { ModuleLimitsPanel } from "@/components/governance/master-data/ModuleLimitsPanel";
import { KhTopicsPanel } from "@/components/governance/master-data/KhTopicsPanel";

// Slide 16: Approver and Admin have full access to the Experts and Academy domains.
// The database checks the role on every read and write (migration 20261023010000).
export const Route = createFileRoute("/governance/master-data")({
  head: () => ({ meta: [{ title: "Data Master — Konsol Kurasi BARUNA" }] }),
  component: MasterDataPage,
});

function MasterDataPage() {
  const fn = useServerFn(getMasterData);
  const q = useQuery({ queryKey: ["governance", "master-data"], queryFn: () => fn(), staleTime: 30_000 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-navy">
          <Database className="h-6 w-6 text-marine" /> Data Master
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Daftar acuan yang dipakai formulir dan aturan sistem. Setiap perubahan tercatat di audit trail.
        </p>
      </div>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : q.data ? (
        <>
          <ExpertiseMasterPanel items={q.data.expertise} />
          <KhTopicsPanel />
          <TrainerLevelsPanel key={q.data.trainerLevelVersions[0]?.version ?? 0} data={q.data} />
          <ModuleLimitsPanel />
        </>
      ) : null}
    </div>
  );
}
