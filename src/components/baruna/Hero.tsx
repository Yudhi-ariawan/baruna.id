import { ArrowRight, Play, Hand } from "lucide-react";
import { images, learnerStats } from "@/data/baruna";

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
              BARUNA connects people, knowledge, and opportunities to strengthen capacity
              and drive sustainable marine and fisheries development for a better future.
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

          {/* Right learner dashboard */}
          <div className="rounded-2xl border border-navy-foreground/15 bg-navy/85 p-6 text-navy-foreground shadow-card backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-sm text-navy-foreground/80">
                  Welcome back <Hand className="h-4 w-4 text-star" />
                </p>
                <p className="mt-1 font-display text-2xl font-extrabold">Komang</p>
                <p className="mt-1 text-sm text-navy-foreground/80">
                  Keep going! You're making great progress.
                </p>
              </div>
              <img
                src={images.userAvatar}
                alt="Komang"
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-navy-foreground/30"
              />
            </div>

            <div className="mt-6 grid grid-cols-4 gap-2">
              {learnerStats.map(({ label, value, icon: Icon }) => (
                <div key={label} className="text-center">
                  <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-navy-foreground/10">
                    <Icon className="h-4 w-4 text-navy-foreground" />
                  </div>
                  <p className="mt-2 font-display text-lg font-bold leading-none">{value}</p>
                  <p className="mt-1 text-[0.65rem] leading-tight text-navy-foreground/75">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <button className="mt-6 flex w-full items-center justify-between rounded-xl bg-navy-foreground/10 px-4 py-3 text-sm font-semibold transition-colors hover:bg-navy-foreground/20">
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
