import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Clock, Users, Sparkles } from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { AcademyHeader } from "@/components/baruna/academy/ui";
import { pathways } from "@/data/pathways";
import pathwayBeginner from "@/assets/academy/pathway-beginner.jpg";

export const Route = createFileRoute("/academy/pathways/")({
  head: () => ({
    meta: [
      { title: "Learning Pathways — Academy — BARUNA" },
      {
        name: "description",
        content:
          "Choose your structured learning journey — from Beginner to Professional Certification in marine and fisheries.",
      },
      { property: "og:title", content: "Learning Pathways — Academy — BARUNA" },
      {
        property: "og:description",
        content: "Beginner, Intermediate, Advanced, and Professional Certification pathways.",
      },
      { property: "og:image", content: pathwayBeginner },
      { property: "og:url", content: "/academy/pathways" },
    ],
    links: [{ rel: "canonical", href: "/academy/pathways" }],
  }),
  component: PathwaysOverview,
});

const toneStyles: Record<
  string,
  { ring: string; iconBg: string; chip: string; bar: string }
> = {
  beginner: {
    ring: "hover:border-marine focus-visible:border-marine",
    iconBg: "bg-marine/10 text-marine",
    chip: "bg-marine/10 text-marine",
    bar: "from-marine/15 to-transparent",
  },
  intermediate: {
    ring: "hover:border-marine focus-visible:border-marine",
    iconBg: "bg-marine/10 text-marine",
    chip: "bg-marine/10 text-marine",
    bar: "from-marine/15 to-transparent",
  },
  advanced: {
    ring: "hover:border-navy focus-visible:border-navy",
    iconBg: "bg-navy/10 text-navy",
    chip: "bg-navy/10 text-navy",
    bar: "from-navy/15 to-transparent",
  },
  certification: {
    ring: "hover:border-accent focus-visible:border-accent",
    iconBg: "bg-accent/15 text-accent",
    chip: "bg-accent/15 text-accent",
    bar: "from-accent/15 to-transparent",
  },
};

function PathwaysOverview() {
  return (
    <AcademyShell active="pathways">
      <div className="space-y-6">
        <AcademyHeader
          crumb="Learning Pathways"
          title="Learning Pathways"
          description="Follow a structured journey from foundational knowledge to professional certification in marine and fisheries."
          searchPlaceholder="Search pathways, modules, or topics..."
        />

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {pathways.map((p) => {
            const Icon = p.icon;
            const tone = toneStyles[p.tone];
            const hours = p.stats.find((s) => s.label.toLowerCase().includes("hours"))?.value;
            const courseStat = p.stats[0];
            const learnerStat = p.stats[p.stats.length - 1];
            return (
              <Link
                key={p.slug}
                to="/academy/pathways/$slug"
                params={{ slug: p.slug }}
                aria-label={`Open ${p.title}`}
                className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft outline-none transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-hover active:scale-[0.99] data-[status=active]:-translate-y-1 data-[status=active]:border-marine data-[status=active]:shadow-hover data-[status=active]:ring-2 data-[status=active]:ring-marine/40 ${tone.ring}`}
              >
                <div className="relative h-40 overflow-hidden">
                  <img
                    src={p.illustration}
                    alt={p.illustrationAlt}
                    loading="lazy"
                    width={1024}
                    height={640}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card/90 px-3 py-1 text-xs font-bold text-navy shadow-soft backdrop-blur-sm">
                    <Sparkles className="h-3.5 w-3.5 text-accent" />
                    {p.badge}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start gap-3">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone.iconBg}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-display text-lg font-extrabold leading-tight text-navy">
                        {p.title}
                      </h2>
                      <p className="text-xs font-medium text-marine">{p.hero}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.description}</p>

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-marine/70" /> {courseStat.value} {courseStat.label}
                    </span>
                    {hours && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-marine/70" /> {hours} Hours
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-marine/70" /> {learnerStat.value} {learnerStat.label}
                    </span>
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-5">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[0.7rem] font-bold ${tone.chip}`}>
                      {p.stats[2].value} Level
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-marine transition-colors group-hover:text-navy">
                      Explore Pathway
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
                <span className={`h-1 w-full bg-gradient-to-r ${tone.bar}`} />
              </Link>
            );
          })}
        </div>
      </div>
    </AcademyShell>
  );
}
