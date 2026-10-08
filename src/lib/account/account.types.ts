export type AccountProfile = {
  id: string;
  email: string;
  displayName: string;
  organization: string;
  jobTitle: string;
  phone: string;
  avatarUrl: string | null;
  country?: string | null;
  linkedin?: string | null;
  website?: string | null;
  bio?: string | null;
  roles?: string[];
  createdAt?: string | null;
  // Participant biodata fields
  nip?: string | null;
  tempatLahir?: string | null;
  tanggalLahir?: string | null;
  jenisKelamin?: string | null;
  agama?: string | null;
  pangkatGolongan?: string | null;
  pendidikanTerakhir?: string | null;
  unitEselon1?: string | null;
  instansiUnitKerja?: string | null;
  alamatKantor?: string | null;
  provinsi?: string | null;
  kabupatenKota?: string | null;
  fotoUrl?: string | null;
  isParticipantRegistered?: boolean;
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
