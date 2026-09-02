import { Link } from "@tanstack/react-router";
import { ArrowRight, type LucideIcon } from "lucide-react";

export function CtaBanner({
  icon: Icon,
  title,
  description,
  button,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  button: string;
  href?: string;
}) {
  const buttonClass =
    "inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-hover";
  return (
    <section className="bg-gradient-to-r from-marine/15 via-marine/10 to-marine/15">
      <div className="mx-auto flex max-w-[1500px] flex-col items-center gap-5 px-4 py-8 sm:px-6 md:flex-row md:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-marine/15 text-marine">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-extrabold text-navy sm:text-xl">{title}</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {href ? (
          <Link to={href} className={buttonClass}>
            {button}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button className={buttonClass}>
            {button}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );
}
