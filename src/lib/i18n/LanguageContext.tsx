import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, type Language } from "./types";
import { translations, type TranslationSchema } from "./translations";

type TranslationKeyPath<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${K}.${TranslationKeyPath<T[K]>}`
        : `${K}`;
    }[keyof T & string]
  : never;

export type TranslationKey = TranslationKeyPath<TranslationSchema>;

interface LanguageContextValue {
  language: Language;
  isId: boolean;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey | string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): Language {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
    if (saved && (saved === "en" || saved === "id")) {
      return saved;
    }
  } catch {
    // Ignore localStorage errors (e.g. incognito/disabled)
  }
  return DEFAULT_LANGUAGE;
}

function resolveNestedKey(obj: unknown, path: string): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      document.documentElement.lang = language;
    } catch {
      // Ignore storage write issues
    }
  }, [language]);

  const setLanguage = useCallback((newLang: Language) => {
    setLanguageState(newLang);
  }, []);

  const t = useCallback(
    (key: TranslationKey | string, fallback?: string): string => {
      const activeDict = translations[language];
      const translated = resolveNestedKey(activeDict, key);
      if (translated) return translated;

      // Fallback to English if missing in current language
      if (language !== "en") {
        const enTranslated = resolveNestedKey(translations.en, key);
        if (enTranslated) return enTranslated;
      }

      return fallback ?? key;
    },
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      isId: language === "id",
      setLanguage,
      t,
    }),
    [language, setLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}

