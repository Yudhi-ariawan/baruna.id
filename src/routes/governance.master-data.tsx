import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Database } from "lucide-react";
import { getMasterData } from "@/lib/governance/master-data.functions";
import { ExpertiseMasterPanel } from "@/components/governance/master-data/ExpertiseMasterPanel";
import { TrainerLevelsPanel } from "@/components/governance/master-data/TrainerLevelsPanel";
import { ModuleLimitsPanel } from "@/components/governance/master-data/ModuleLimitsPanel";
import { KhTopicsPanel } from "@/components/governance/master-data/KhTopicsPanel";
import { LanguagesPanel } from "@/components/governance/master-data/LanguagesPanel";
import { TrainingCategoriesPanel } from "@/components/governance/master-data/TrainingCategoriesPanel";
import { MasterChangeRequestsPanel } from "@/components/governance/master-data/MasterChangeRequestsPanel";
import { Toaster } from "@/components/baruna/Toaster";
import { LoadingSkeleton } from "@/components/baruna/console/LoadingSkeleton";

// Slide 16: Approver and Admin have full access to the Experts and Academy domains;
// Operators read everything and propose changes that another Approver/Admin approves
// (migration 20261116010000, CATATAN_PERBAIKAN 2az). The database checks every step.
export const Route = createFileRoute("/governance/master-data")({
  head: () => ({ meta: [{ title: "Data Master — Konsol Kurasi BARUNA" }] }),
  component: MasterDataPage,
});

function MasterDataPage() {
  const fn = useServerFn(getMasterData);
  const q = useQuery({ queryKey: ["governance", "master-data"], queryFn: () => fn(), staleTime: 30_000 });

  return (
    <div className="space-y-6">
      <Toaster />
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-navy">
          <Database className="h-6 w-6 text-marine" /> Data Master
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Daftar acuan yang dipakai formulir dan aturan sistem. Setiap perubahan tercatat di audit trail.
        </p>
      </div>
      {q.isLoading ? (
        <LoadingSkeleton />
      ) : q.isError ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : q.data ? (
        <>
          <MasterChangeRequestsPanel />
          <ExpertiseMasterPanel items={q.data.expertise} />
          <KhTopicsPanel />
          <LanguagesPanel />
          <TrainingCategoriesPanel />
          <TrainerLevelsPanel key={q.data.trainerLevelVersions[0]?.version ?? 0} data={q.data} />
          <ModuleLimitsPanel />
        </>
      ) : null}
    </div>
  );
}
