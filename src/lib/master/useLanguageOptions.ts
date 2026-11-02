// Languages from Data Master (languages_taxonomy, migration 20261102030000). The
// table is readable by visitors, so this also works on forms opened before login
// (Request a Training). Only active languages are offered; the database still
// recognises a deactivated one, so older data that uses it stays valid.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LanguageOption = { code: string; name: string; nativeName: string | null; active: boolean };

// languages_taxonomy is not in the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useLanguageOptions() {
  return useQuery({
    queryKey: ["master", "language-options"],
    queryFn: async (): Promise<LanguageOption[]> => {
      const { data, error } = await db
        .from("languages_taxonomy")
        .select("code, name, native_name, active, display_order")
        .order("display_order", { ascending: true })
        .order("name", { ascending: true })
        .limit(500);
      if (error) throw new Error(`Gagal memuat daftar bahasa: ${error.message}`);
      return ((data ?? []) as Array<{ code: string; name: string; native_name: string | null; active: boolean }>).map((r) => ({
        code: r.code,
        name: r.name,
        nativeName: r.native_name,
        active: r.active,
      }));
    },
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
  });
}

const norm = (v: string) => v.trim().replace(/\s*\([^)]*\)/g, "").replace(/^bahasa\s+/i, "").replace(/\s+/g, " ").toLowerCase();
// Same common names the database maps (_expert_language_code).
const ALIAS: Record<string, string> = {
  indonesia: "id", indonesian: "id", inggris: "en", melayu: "ms", malaysia: "ms", mandarin: "zh", china: "zh",
  filipino: "tl", tagalog: "tl", jepang: "ja", korea: "ko", jerman: "de", prancis: "fr", perancis: "fr",
  spanyol: "es", arab: "ar", belanda: "nl", rusia: "ru", portugis: "pt", vietnam: "vi", thailand: "th",
};

/** The list entry a stored value refers to (name, native name, code or common name), if any. */
export function matchLanguage(options: LanguageOption[], value: string): LanguageOption | undefined {
  const v = norm(value);
  if (!v) return undefined;
  const code = ALIAS[v] ?? v;
  return options.find(
    (o) => o.code.toLowerCase() === code || norm(o.name) === v || (o.nativeName && norm(o.nativeName) === v)
      || o.name.toLowerCase().replace(/\s*\([^)]*\)/g, "").split(/\s*\/\s*/).includes(v),
  );
}
