import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ecosystem } from "@/data/baruna";
import { useLanguage } from "@/lib/i18n";

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
  const { t } = useLanguage();

  const ecoMeta: Record<string, { title: string; desc: string }> = {
    Academy: { title: t("nav.academy"), desc: t("ecosystem.academyDesc") },
    "Knowledge Hub": { title: t("nav.knowledgeHub"), desc: t("ecosystem.knowledgeDesc") },
    Experts: { title: t("nav.experts"), desc: t("ecosystem.expertsDesc") },
    "Fellowship & Exchange": {
      title: t("nav.fellowship"),
      desc: t("ecosystem.fellowshipDesc"),
    },
    Community: { title: t("nav.community"), desc: t("ecosystem.communityDesc") },
    Events: { title: t("nav.events"), desc: t("ecosystem.eventsDesc") },
    Partnership: { title: t("nav.partnership"), desc: t("ecosystem.partnershipDesc") },
  };

  return (
    <section className="mx-auto max-w-[1500px] px-3 sm:px-6 py-6 sm:py-8 w-full overflow-hidden">
      <div className="mb-6 text-center">
        <h2 className="font-display text-xl xs:text-2xl sm:text-3xl font-extrabold text-navy">
          {t("ecosystem.sectionTitle")}
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
          {t("ecosystem.sectionSubtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full">
        {ecosystem.map(({ title, description, icon: Icon, color, href }) => {
          const item = ecoMeta[title];
          const displayTitle = item?.title ?? title;
          const displayDesc = item?.desc ?? description;

          return (
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
              <h3 className="mt-4 font-display text-base font-bold text-navy">{displayTitle}</h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                {displayDesc}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-marine">
                {t("ecosystem.explore")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
