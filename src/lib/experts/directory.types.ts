export type PublicExpert = {
  id: string;
  slug: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  avatarUrl: string | null;
  expertiseAreas: string[];
  languages: string[];
  verificationStatus:
    | "unverified"
    | "self_declared"
    | "institutionally_verified"
    | "governance_verified";
  institution: string | null;
  institutionRole: string | null;
  trainerStatus: "candidate" | "active" | "inactive" | "suspended" | "retired";
  trainerLevel: "not_assigned" | "certified" | "advanced" | "senior" | "master";
  uniqueGraduatedParticipants: number | null;
  recognitionMinParticipants: number | null;
  availabilityStatus: "available" | "limited" | "unavailable" | null;
  availableModes: string[];
  nextAvailableFrom: string | null;
};

export const TRAINER_LEVEL_LABEL: Record<PublicExpert["trainerLevel"], string> = {
  not_assigned: "Trainer Candidate",
  certified: "Certified Trainer",
  advanced: "Advanced Trainer",
  senior: "Senior Trainer",
  master: "Master Trainer",
};

export const VERIFICATION_LABEL: Record<PublicExpert["verificationStatus"], string> = {
  unverified: "Unverified",
  self_declared: "Self-declared",
  institutionally_verified: "Institutionally Verified",
  governance_verified: "BARUNA Verified",
};
