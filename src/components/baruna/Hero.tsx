import { ArrowRight, Play } from "lucide-react";
import { images } from "@/data/baruna";
import { HomeWelcomeCard } from "./HomeWelcomeCard";

export function Hero() {
  return (
    <section className="mx-auto max-w-[1500px] px-3 sm:px-6 pt-3 sm:pt-5 w-full">
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-card w-full">
        <img
          src={images.heroOcean}
          alt="Traditional Indonesian boat on a calm tropical ocean with green mountains"
          width={1920}
          height={900}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="hero-overlay absolute inset-0" />

        <div className="relative grid gap-6 sm:gap-8 p-4 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:p-12 w-full">
          {/* Left copy */}
          <div className="max-w-xl text-navy-foreground">
            <h1 className="font-display text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight">
              From Ocean Wisdom <br className="hidden sm:block" />
              to Global Impact
            </h1>
            <p className="mt-3 sm:mt-5 max-w-md text-xs sm:text-sm md:text-base leading-relaxed text-navy-foreground/85">
              BARUNA connects people, knowledge, and opportunities to strengthen capacity and drive
              sustainable marine and fisheries development for a better future.
            </p>
            <div className="mt-5 sm:mt-7 flex flex-wrap gap-2.5 sm:gap-3">
              <button className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-semibold text-accent-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-hover cursor-pointer">
                Explore the Ecosystem
                <ArrowRight className="h-4 w-4" />
              </button>
              <button className="inline-flex items-center gap-1.5 rounded-xl border border-navy-foreground/40 bg-navy-foreground/10 px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-semibold text-navy-foreground backdrop-blur transition-colors hover:bg-navy-foreground/20 cursor-pointer">
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
