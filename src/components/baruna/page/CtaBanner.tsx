import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const ctaMap: Record<string, { titleKey?: string; descKey?: string; btnKey?: string }> = {
  "Share Knowledge. Drive Change.": {
    titleKey: "knowledgeHub.ctaTitle",
    descKey: "knowledgeHub.ctaDesc",
    btnKey: "knowledgeHub.ctaButton",
  },
  "Have a Fellowship Program to Offer?": {
    titleKey: "fellowship.ctaTitle",
    descKey: "fellowship.ctaDesc",
    btnKey: "fellowship.ctaButton",
  },
  "Join the Conversation": {
    titleKey: "community.ctaTitle",
    descKey: "community.ctaDesc",
    btnKey: "community.ctaButton",
  },
  "Become a Strategic Partner": {
    titleKey: "partnership.ctaTitle",
    descKey: "partnership.ctaDesc",
    btnKey: "partnership.ctaButton",
  },
  "Looking for something specific?": {
    titleKey: "search.ctaTitle",
    descKey: "search.ctaDesc",
    btnKey: "search.ctaBtn",
  },
  "Discover more": {
    titleKey: "saved.ctaTitle",
    descKey: "saved.ctaDesc",
    btnKey: "saved.ctaBtn",
  },
  "Still stuck?": {
    titleKey: "help.ctaTitle",
    descKey: "help.ctaDesc",
    btnKey: "help.ctaBtn",
  },
};

export function CtaBanner({
  icon: Icon,
  title = "BARUNA Network",
  description = "Join our marine and fisheries capacity building ecosystem.",
  button = "Learn More",
  href,
}: {
  icon?: LucideIcon | null;
  title?: string;
  description?: string;
  button?: string;
  href?: string;
}) {
  const { t } = useLanguage();
  const mapping = title ? ctaMap[title] : undefined;

  const translatedTitle = mapping?.titleKey ? t(mapping.titleKey, title) : t(title || "", title || "");
  const translatedDescription = mapping?.descKey ? t(mapping.descKey, description) : t(description || "", description || "");
  const translatedButton = mapping?.btnKey ? t(mapping.btnKey, button) : t(button || "", button || "");

  const buttonClass =
    "inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-hover cursor-pointer";

  const RenderIcon = typeof Icon === "function" || (typeof Icon === "object" && Icon !== null) ? Icon : Sparkles;

  return (
    <section className="bg-gradient-to-r from-marine/15 via-marine/10 to-marine/15">
      <div className="mx-auto flex max-w-[1500px] flex-col items-center gap-5 px-4 py-8 sm:px-6 md:flex-row md:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-marine/15 text-marine">
            <RenderIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-extrabold text-navy sm:text-xl">{translatedTitle}</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{translatedDescription}</p>
          </div>
        </div>
        {href ? (
          <Link to={href} className={buttonClass}>
            {translatedButton}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button type="button" className={buttonClass}>
            {translatedButton}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );
}
