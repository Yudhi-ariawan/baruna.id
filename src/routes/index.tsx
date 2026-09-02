import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/baruna/Navbar";
import { Hero } from "@/components/baruna/Hero";
import { LearningSections } from "@/components/baruna/LearningSections";
import { Ecosystem } from "@/components/baruna/Ecosystem";
import { BottomGrid } from "@/components/baruna/BottomGrid";
import { StatsBar } from "@/components/baruna/StatsBar";

export const Route = createFileRoute("/")({
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
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <LearningSections />
        <Ecosystem />
        <BottomGrid />
      </main>
      <StatsBar />
    </div>
  );
}
