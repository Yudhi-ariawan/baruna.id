// Field-level checks for the Knowledge Hub "Submit a Resource" wizard, per step.
// Required fields are the wizard's own rules plus the database's
// (_kr_payload_problem, migration 20261102030000): title (max 300), a file or an
// http(s) link (max 2000), topic, language, and six Best Practice parts. The
// database stays the authority; this only shows WHICH field to fix.
import type { ResourceDraft } from "@/lib/resources";

export type KhFieldErrors = Record<string, string>;

/** Best Practice parts the database requires (practiceStructure.<key>). */
export const BEST_PRACTICE_REQUIRED = ["challenge", "context", "intervention", "steps", "results", "lessons"] as const;

/** Same pattern as the database check `^https?://[^\s]+$` (case-insensitive). */
export const EXTERNAL_URL = /^https?:\/\/\S+$/i;

export const KH_SUBMIT_LABELS: Record<string, string> = {
  type: "Jenis resource",
  title: "Title", description: "Description", author: "Author", institution: "Institution", country: "Country",
  year: "Year", language: "Language", keywords: "Keywords", topicCategory: "Topic Category",
  "ps.challenge": "Best Practice: Tantangan", "ps.context": "Best Practice: Konteks",
  "ps.intervention": "Best Practice: Intervensi", "ps.steps": "Best Practice: Tahapan",
  "ps.results": "Best Practice: Hasil", "ps.lessons": "Best Practice: Pelajaran",
  file: "Berkas atau tautan", externalUrl: "Tautan eksternal", declaration: "Pernyataan hak",
};

export function khSubmitStepErrors(step: number, f: ResourceDraft): KhFieldErrors {
  const e: KhFieldErrors = {};
  const need = (k: keyof ResourceDraft, msg: string) => {
    const v = f[k];
    if (typeof v !== "string" || !v.trim()) e[k] = msg;
  };
  if (step === 1) {
    if (!f.type) e.type = "Pilih jenis resource.";
  }
  if (step === 2) {
    need("title", "Isi judul.");
    if (!e.title && f.title.trim().length > 300) e.title = `Judul maksimal 300 karakter (sekarang ${f.title.trim().length}).`;
    need("description", "Isi deskripsi singkat.");
    need("author", "Isi nama penulis.");
    need("institution", "Isi institusi.");
    need("country", "Isi negara.");
    need("year", "Isi tahun.");
    if (!e.year) {
      const y = Number(f.year);
      if (!/^\d{4}$/.test(f.year.trim()) || y < 1980 || y > 2100) e.year = "Tahun 4 angka, 1980–2100.";
    }
    need("language", "Pilih bahasa.");
    need("keywords", "Isi kata kunci (pisahkan dengan koma).");
    need("topicCategory", "Pilih satu Topic Category.");
    if (f.type === "Best Practice") {
      const ps = (f.practiceStructure ?? {}) as unknown as Record<string, string | undefined>;
      for (const k of BEST_PRACTICE_REQUIRED) {
        if (!(ps[k] ?? "").trim()) e[`ps.${k}`] = "Wajib diisi untuk Best Practice.";
      }
    }
  }
  if (step === 3) {
    const url = f.externalUrl.trim();
    if (url && (url.length > 2000 || !EXTERNAL_URL.test(url))) {
      e.externalUrl = "Tautan harus diawali http:// atau https:// dan tanpa spasi.";
    }
    if (!f.file && !url) e.file = "Unggah berkas atau isi tautan eksternal (minimal salah satu).";
  }
  if (step === 4) {
    if (!f.declaration) e.declaration = "Centang pernyataan ini sebelum mengirim.";
  }
  const order = Object.keys(KH_SUBMIT_LABELS);
  return Object.fromEntries(Object.entries(e).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b)));
}

/** First step (1-4) that still has a field to fix; null when all are fine. */
export function firstKhStepWithErrors(f: ResourceDraft): { step: number; errors: KhFieldErrors } | null {
  for (let step = 1; step <= 4; step++) {
    const errors = khSubmitStepErrors(step, f);
    if (Object.keys(errors).length) return { step, errors };
  }
  return null;
}
