// Field-level checks for the Become an Expert form (/experts/join), per step. The
// required fields are the server's completeness gate (getExpertPayloadIncompleteFields);
// the lengths are ExpertPayloadSchema / SaveInput (name 2-160) and the database
// (at most 20 bidang keahlian, migration 20261023010000). The server stays the
// authority; this only shows WHICH field to fix. The e-mail format is checked here
// only on Next/Submit (a draft may still hold a half-typed address).
import { z } from "zod";
import type { ExpertApplicationDraft } from "@/lib/experts";

export type ExpertFieldErrors = Record<string, string>;

const EMAIL = z.string().trim().email();

export function expertJoinLabels(isId: boolean): Record<string, string> {
  return isId
    ? {
        fullName: "Nama lengkap", title: "Jabatan profesional", institution: "Institusi", country: "Negara",
        email: "Email", phone: "Telepon", linkedin: "LinkedIn", website: "Situs web", expertise: "Bidang keahlian",
        roles: "Peran", biography: "Biografi profesional", yearsExperience: "Tahun pengalaman",
        structuredLanguages: "Bahasa", structuredProjects: "Proyek", structuredPublications: "Publikasi",
      }
    : {
        fullName: "Full name", title: "Professional title", institution: "Institution", country: "Country",
        email: "Email", phone: "Phone", linkedin: "LinkedIn", website: "Website", expertise: "Areas of expertise",
        roles: "Available roles", biography: "Professional biography", yearsExperience: "Years of experience",
        structuredLanguages: "Languages", structuredProjects: "Projects", structuredPublications: "Publications",
      };
}

export function expertJoinStepErrors(step: number, f: ExpertApplicationDraft, isId: boolean): ExpertFieldErrors {
  const e: ExpertFieldErrors = {};
  const t = (id: string, en: string) => (isId ? id : en);
  const need = (k: keyof ExpertApplicationDraft, msg: string) => {
    const v = f[k];
    if (typeof v !== "string" || !v.trim()) e[k] = msg;
  };
  const max = (k: keyof ExpertApplicationDraft, n: number) => {
    const v = f[k];
    if (!e[k] && typeof v === "string" && v.trim().length > n) {
      e[k] = t(`Maksimal ${n.toLocaleString("id")} karakter (sekarang ${v.trim().length.toLocaleString("id")}).`,
        `Maximum ${n.toLocaleString("en")} characters (now ${v.trim().length.toLocaleString("en")}).`);
    }
  };
  const count = (k: keyof ExpertApplicationDraft, n: number, id: string, en: string) => {
    const v = f[k];
    if (Array.isArray(v) && v.length > n) e[k] = t(`Maksimal ${n} ${id} (sekarang ${v.length}).`, `At most ${n} ${en} (now ${v.length}).`);
  };

  if (step === 1) {
    need("fullName", t("Isi nama lengkap.", "Enter your full name."));
    if (!e.fullName && f.fullName.trim().length < 2) e.fullName = t("Nama minimal 2 huruf.", "At least 2 characters.");
    need("title", t("Pilih jabatan profesional (atau tulis sendiri lewat \"Other\").", "Choose a professional title (or write one under \"Other\")."));
    need("institution", t("Isi institusi / organisasi.", "Enter your institution or organization."));
    need("country", t("Pilih negara.", "Choose a country."));
    need("email", t("Isi alamat email.", "Enter your e-mail address."));
    if (!e.email && !EMAIL.safeParse(f.email).success) {
      e.email = t("Format email belum benar, contoh nama@instansi.go.id.", "Enter a valid e-mail address, e.g. name@example.org.");
    }
    max("fullName", 160); max("title", 160); max("institution", 200); max("country", 80); max("email", 254);
    max("phone", 40); max("linkedin", 300); max("website", 300);
  }
  if (step === 2) {
    if (f.expertise.length === 0) e.expertise = t("Pilih minimal satu bidang keahlian.", "Select at least one area of expertise.");
    count("expertise", 20, "bidang keahlian", "areas of expertise");
    if (f.roles.length === 0) e.roles = t("Pilih minimal satu peran.", "Select at least one role.");
    count("roles", 10, "peran", "roles");
  }
  if (step === 3) {
    need("biography", t("Isi ringkasan biografi profesional.", "Write a short professional biography."));
    max("biography", 20000); max("yearsExperience", 20);
    count("structuredLanguages", 20, "bahasa", "languages");
    count("structuredProjects", 30, "proyek", "projects");
    count("structuredPublications", 50, "publikasi", "publications");
  }
  const order = Object.keys(expertJoinLabels(isId));
  return Object.fromEntries(Object.entries(e).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b)));
}

/** First step (1-3) that still has a field to fix; null when all are fine. */
export function firstExpertStepWithErrors(f: ExpertApplicationDraft, isId: boolean): { step: number; errors: ExpertFieldErrors } | null {
  for (let step = 1; step <= 3; step++) {
    const errors = expertJoinStepErrors(step, f, isId);
    if (Object.keys(errors).length) return { step, errors };
  }
  return null;
}
