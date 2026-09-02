import type { ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";

export type BannerStat = { value: string; label: string; icon?: LucideIcon };

export type BannerProps = {
  image: string;
  alt: string;
  title: ReactNode;
  description: string;
  stats?: BannerStat[];
  cta?: { label: string };
  side?: ReactNode;
};

export function Banner({ image, alt, title, description, stats, cta, side }: BannerProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl shadow-card">
      <img
        src={image}
        alt={alt}
        width={1920}
        height={640}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="hero-overlay absolute inset-0" />
      <div className="relative grid gap-6 p-7 sm:p-9 lg:grid-cols-[1.5fr_1fr] lg:items-center lg:p-10">
        <div className="max-w-2xl text-navy-foreground">
          <h2 className="font-display text-3xl font-extrabold leading-[1.1] sm:text-4xl">{title}</h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-navy-foreground/85 sm:text-base">
            {description}
          </p>
          {cta && (
            <button className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-hover">
              {cta.label}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {stats && (
            <div className="mt-7 flex flex-wrap gap-x-7 gap-y-4 border-t border-navy-foreground/20 pt-6">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center gap-2.5">
                  {s.icon && (
                    <s.icon className="h-5 w-5 text-navy-foreground/80" strokeWidth={1.8} />
                  )}
                  <div className="leading-tight">
                    <p className="font-display text-xl font-extrabold">{s.value}</p>
                    <p className="text-[0.7rem] text-navy-foreground/75">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {side && <div className="lg:justify-self-end">{side}</div>}
      </div>
    </section>
  );
}
