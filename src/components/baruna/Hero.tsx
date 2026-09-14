import { ArrowRight, Play } from "lucide-react";
import { images } from "@/data/baruna";
import { HomeWelcomeCard } from "./HomeWelcomeCard";

export function Hero() {
  return (
    <section className="mx-auto max-w-[1500px] px-4 pt-5 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl shadow-card">
        <img
          src={images.heroOcean}
          alt="Traditional Indonesian boat on a calm tropical ocean with green mountains"
          width={1920}
          height={900}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="hero-overlay absolute inset-0" />

        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:p-12">
          {/* Left copy */}
          <div className="max-w-xl text-navy-foreground">
            <h1 className="font-display text-4xl font-extrabold leading-[1.08] sm:text-5xl">
              From Ocean Wisdom <br className="hidden sm:block" />
              to Global Impact
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-navy-foreground/85 sm:text-base">
              BARUNA connects people, knowledge, and opportunities to strengthen capacity and drive
              sustainable marine and fisheries development for a better future.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-hover">
                Explore the Ecosystem
                <ArrowRight className="h-4 w-4" />
              </button>
              <button className="inline-flex items-center gap-2 rounded-xl border border-navy-foreground/40 bg-navy-foreground/10 px-5 py-3 text-sm font-semibold text-navy-foreground backdrop-blur transition-colors hover:bg-navy-foreground/20">
                <Play className="h-4 w-4 fill-current" />
                Watch Video
              </button>
            </div>

            <div className="mt-8 flex items-center gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`h-2 rounded-full transition-all ${
                    i === 0 ? "w-6 bg-navy-foreground" : "w-2 bg-navy-foreground/45"
                  }`}
                />
              ))}
            </div>
          </div>

          <HomeWelcomeCard />
        </div>
      </div>
    </section>
  );
}
