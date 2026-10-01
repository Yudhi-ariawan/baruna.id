import { footerStats } from "@/data/baruna";
import { Fish } from "lucide-react";
import { Logo } from "./Logo";
import { useLanguage } from "@/lib/i18n";

export function StatsBar() {
  const { t } = useLanguage();

  const translatedStats = [
    { value: "15,000+", label: t("footer.learners"), icon: footerStats[0].icon },
    { value: "120+", label: t("footer.programs"), icon: footerStats[1].icon },
    { value: "45+", label: t("footer.countries"), icon: footerStats[2].icon },
    { value: "80+", label: t("footer.partners"), icon: footerStats[3].icon },
    { value: "500+", label: t("footer.learningResources"), icon: footerStats[4].icon },
  ];

  return (
    <footer className="bg-navy text-navy-foreground w-full overflow-hidden">
      <div className="mx-auto max-w-[1500px] px-3 sm:px-6 py-8 sm:py-10 w-full">
        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-center w-full">
          <div className="grid grid-cols-2 gap-4 sm:gap-6 sm:grid-cols-3 lg:grid-cols-5 w-full">
            {translatedStats.map(({ value, label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2.5 sm:gap-3">
                <div className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-full bg-navy-foreground/10">
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-navy-foreground" />
                </div>
                <div className="leading-tight min-w-0">
                  <p className="font-display text-base sm:text-xl font-extrabold truncate">{value}</p>
                  <p className="text-[11px] sm:text-xs text-navy-foreground/75 truncate">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative lg:text-right">
            <Fish className="mb-2 sm:mb-3 h-6 w-6 sm:h-7 sm:w-7 text-marine lg:ml-auto" />
            <p className="text-xs sm:text-sm font-semibold leading-relaxed">
              {t("footer.togetherBuild")}
              <br />
              {t("footer.togetherProtect")}
            </p>
            <p className="mt-1 text-xs sm:text-sm text-navy-foreground/80">
              {t("footer.joinCta")}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 border-t border-navy-foreground/15 pt-8">
          <div className="inline-flex rounded-2xl bg-white px-4 sm:px-6 py-3 sm:py-4 shadow-soft">
            <Logo className="h-10 sm:h-16 md:h-20" />
          </div>
          <p className="text-center text-xs text-navy-foreground/60">
            © {new Date().getFullYear()} BARUNA — {t("footer.copyright")}
          </p>
        </div>
      </div>
    </footer>
  );
}
