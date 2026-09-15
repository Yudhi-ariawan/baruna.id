export type AccountProfile = {
  id: string;
  email: string;
  displayName: string;
  organization: string;
  jobTitle: string;
  phone: string;
  avatarUrl: string | null;
};

export const AVATAR_BUCKET = "avatars";

export const AVATAR_PRESETS = [
  { id: "ocean-explorer", label: "Ocean Explorer", path: "presets/ocean-explorer.webp" },
  { id: "coral-guardian", label: "Coral Guardian", path: "presets/coral-guardian.webp" },
  {
    id: "fisheries-professional",
    label: "Fisheries Professional",
    path: "presets/fisheries-professional.webp",
  },
  {
    id: "marine-researcher",
    label: "Marine Researcher",
    path: "presets/marine-researcher.webp",
  },
] as const;

export type AvatarPresetPath = (typeof AVATAR_PRESETS)[number]["path"];
