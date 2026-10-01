export type Language = "en" | "id";

export interface LanguageOption {
  code: Language;
  label: string;
  shortLabel: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", shortLabel: "EN", flag: "🇬🇧" },
  { code: "id", label: "Bahasa Indonesia", shortLabel: "ID", flag: "🇮🇩" },
];

export const DEFAULT_LANGUAGE: Language = "en";
export const LANGUAGE_STORAGE_KEY = "baruna_locale";

