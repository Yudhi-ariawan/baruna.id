import { en, type TranslationSchema } from "./en";
import { id } from "./id";
import type { Language } from "../types";

export const translations: Record<Language, TranslationSchema> = {
  en,
  id,
};

export { en, id };
export type { TranslationSchema };

