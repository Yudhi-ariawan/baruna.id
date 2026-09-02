import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ecosystem } from "@/data/baruna";

const iconBg: Record<string, string> = {
  "eco-academy": "bg-eco-academy",
  "eco-knowledge": "bg-eco-knowledge",
  "eco-experts": "bg-eco-experts",
  "eco-fellowship": "bg-eco-fellowship",
  "eco-community": "bg-eco-community",
  "eco-events": "bg-eco-events",
  "eco-partnership": "bg-eco-partnership",
};

export function Ecosystem() {
  return (
    <section className="mx-auto max-w-[1500px] px-4 py-2 sm:px-6">
      <div className="mb-6 text-center">
        <h2 className="font-display text-2xl font-extrabold text-navy sm:text-3xl">
          Explore the BARUNA Ecosystem
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          One connected network for marine and fisheries capacity building.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ecosystem.map(({ title, description, icon: Icon, color, href }) => (
          <Link
            key={title}
            to={href}
            className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-1 hover:border-marine/40 hover:shadow-hover"
          >
            <div
              className={`grid h-12 w-12 place-items-center rounded-full text-navy-foreground ${iconBg[color]}`}
            >
              <Icon className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-display text-base font-bold text-navy">{title}</h3>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-marine">
              Explore
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
