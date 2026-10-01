import { Globe, Check, ChevronDown } from "lucide-react";
import { useLanguage, SUPPORTED_LANGUAGES, type Language } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  variant?: "dropdown" | "segmented";
  className?: string;
}

export function LanguageSwitcher({ variant = "dropdown", className }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useLanguage();
  const currentOption =
    SUPPORTED_LANGUAGES.find((opt) => opt.code === language) ?? SUPPORTED_LANGUAGES[0];

  if (variant === "segmented") {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-lg border border-border/70 bg-muted/50 p-1 text-xs font-semibold",
          className,
        )}
        role="group"
        aria-label={t("header.language")}
      >
        {SUPPORTED_LANGUAGES.map((opt) => {
          const isSelected = opt.code === language;
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => setLanguage(opt.code)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-all",
                isSelected
                  ? "bg-background text-marine shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={isSelected}
            >
              <span>{opt.flag}</span>
              <span>{opt.shortLabel}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-foreground/75 transition-colors hover:bg-muted hover:text-marine focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            className,
          )}
          aria-label={t("header.language")}
        >
          <Globe className="h-4 w-4" />
          <span className="font-semibold">{currentOption.shortLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {SUPPORTED_LANGUAGES.map((opt) => {
          const isSelected = opt.code === language;
          return (
            <DropdownMenuItem
              key={opt.code}
              onClick={() => setLanguage(opt.code)}
              className="flex items-center justify-between cursor-pointer py-2 text-xs font-medium"
            >
              <span className="flex items-center gap-2">
                <span className="text-sm">{opt.flag}</span>
                <span className={isSelected ? "font-bold text-navy" : "text-foreground"}>
                  {opt.label}
                </span>
              </span>
              {isSelected ? <Check className="h-3.5 w-3.5 text-marine" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

