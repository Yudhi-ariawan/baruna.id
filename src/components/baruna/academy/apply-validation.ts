// Field-level checks for the Full Training application (/academy/apply/$slug).
// The required fields are the form's own rules; the motivation is sent to the server
// as the application note, which keeps at most 1,000 characters
// (submitCourseEnrollmentApplication), so a longer text is flagged instead of being
// cut silently.
import { z } from "zod";
import type { PersonalInfo, ProfessionalInfo } from "@/lib/application";

const EMAIL = z.string().trim().email();
export const MOTIVATION_MIN = 11;
export const MOTIVATION_MAX = 1000;

export const APPLY_LABELS: Record<string, string> = {
  fullName: "Full Name", gender: "Gender", nationality: "Nationality", email: "Email Address", phone: "Phone Number",
  organization: "Organization", position: "Position", country: "Country", experience: "Years of Experience",
  english: "English Proficiency", motivation: "Motivation Statement",
};

export function applyFormErrors(
  personal: PersonalInfo,
  professional: ProfessionalInfo,
  english: string,
  motivation: string,
): Record<string, string> {
  const e: Record<string, string> = {};
  const need = (k: string, v: string, msg: string) => {
    if (!v.trim()) e[k] = msg;
  };
  need("fullName", personal.fullName, "Enter your full name as shown on your passport.");
  need("gender", personal.gender, "Select your gender.");
  need("nationality", personal.nationality, "Enter your nationality.");
  need("email", personal.email, "Enter your e-mail address.");
  if (!e.email && !EMAIL.safeParse(personal.email).success) e.email = "Enter a valid e-mail address, e.g. name@example.org.";
  need("phone", personal.phone, "Enter your phone number.");
  need("organization", professional.organization, "Enter your organization.");
  need("position", professional.position, "Enter your position.");
  need("country", professional.country, "Enter the country where you work.");
  need("experience", professional.experience, "Select your years of experience.");
  if (!english) e.english = "Choose your English level.";
  const m = motivation.trim().length;
  if (m < MOTIVATION_MIN) e.motivation = `Write at least ${MOTIVATION_MIN} characters (now ${m}).`;
  else if (m > MOTIVATION_MAX) e.motivation = `Maximum ${MOTIVATION_MAX.toLocaleString("en")} characters (now ${m.toLocaleString("en")}).`;
  return e;
}
