import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/baruna/Navbar";
import { Hero } from "@/components/baruna/Hero";
import { LearningSections } from "@/components/baruna/LearningSections";
import { Ecosystem } from "@/components/baruna/Ecosystem";
import { BottomGrid } from "@/components/baruna/BottomGrid";
import { StatsBar } from "@/components/baruna/StatsBar";
import { getPublishedModulesCatalog } from "@/lib/learning/learning.functions";
import { getLatestPublicKnowledgeResources } from "@/lib/home/home.functions";
import { listPublicExperts } from "@/lib/experts/directory.functions";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [publishedModules, latestResources, publicExperts] = await Promise.all([
      getPublishedModulesCatalog().catch((error) => {
        console.warn("Could not load homepage module recommendations:", error);
        return [];
      }),
      getLatestPublicKnowledgeResources().catch((error) => {
        console.warn("Could not load homepage knowledge resources:", error);
        return [];
      }),
      listPublicExperts().catch((error) => {
        console.warn("Could not load homepage featured experts:", error);
        return [];
      }),
    ]);
    const featuredExperts = [...publicExperts]
      .sort((left, right) => {
        const score = (expert: (typeof publicExperts)[number]) =>
          Number(expert.contactEmail?.toLowerCase().endsWith("@kkp.go.id")) * 2 +
          Number(expert.trainerStatus === "active");
        return score(right) - score(left) || left.displayName.localeCompare(right.displayName);
      })
      .slice(0, 3);
    return { publishedModules, latestResources, featuredExperts };
  },
  head: () => ({
    meta: [
      { title: "BARUNA — From Ocean Wisdom to Global Impact" },
      {
        name: "description",
        content:
          "BARUNA connects people, knowledge, and opportunities to strengthen capacity and drive sustainable marine and fisheries development for a better future.",
      },
      { property: "og:title", content: "BARUNA — From Ocean Wisdom to Global Impact" },
      {
        property: "og:description",
        content:
          "Indonesia's Marine and Fisheries Knowledge & Capacity Building Network.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { publishedModules, latestResources, featuredExperts } = Route.useLoaderData();

  return (
    <div className="min-h-screen w-full bg-background">
      <Navbar />
      <main className="overflow-x-hidden w-full">
        <Hero />
        <LearningSections publishedModules={publishedModules} />
        <Ecosystem />
        <BottomGrid latestResources={latestResources} featuredExperts={featuredExperts} />
      </main>
      <StatsBar />
    </div>
  );
}
