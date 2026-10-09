import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/baruna/Navbar";
import { Hero } from "@/components/baruna/Hero";
import { LearningSections } from "@/components/baruna/LearningSections";
import { Ecosystem } from "@/components/baruna/Ecosystem";
import { BottomGrid } from "@/components/baruna/BottomGrid";
import { StatsBar } from "@/components/baruna/StatsBar";
import { getPublishedModulesCatalog } from "@/lib/learning/learning.functions";

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      const publishedModules = await getPublishedModulesCatalog();
      return { publishedModules: publishedModules ?? [] };
    } catch (error) {
      console.warn("Could not load homepage module recommendations:", error);
      return { publishedModules: [] };
    }
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
  const { publishedModules } = Route.useLoaderData();

  return (
    <div className="min-h-screen w-full bg-background">
      <Navbar />
      <main className="overflow-x-hidden w-full">
        <Hero />
        <LearningSections publishedModules={publishedModules} />
        <Ecosystem />
        <BottomGrid />
      </main>
      <StatsBar />
    </div>
  );
}
