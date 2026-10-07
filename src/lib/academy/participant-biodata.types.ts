export interface ParticipantBiodata {
  id?: string;
  userId: string;
  nama: string;
  nip: string;
  tempatLahir: string;
  tanggalLahir: string; // YYYY-MM-DD
  jenisKelamin: string;
  agama: string;
  jabatan: string;
  pangkatGolongan: string;
  pendidikanTerakhir: string;
  noHp: string;
  unitEselon1: string;
  instansiUnitKerja: string;
  alamatKantor: string;
  provinsi: string;
  kabupatenKota: string;
  fotoUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const UNIT_ESELON_1_OPTIONS = [
  "Sekretariat Jenderal",
  "Inspektorat Jenderal",
  "Ditjen. Perikanan Budidaya",
  "Ditjen. Perikanan Tangkap",
  "Ditjen. Pengawasan SDKP",
  "Ditjen. PK",
  "Ditjen. PRL",
  "Ditjen. PDSPKP",
  "BPPMHKP",
  "BPPSDMKP",
  "Instansi Luar KKP",
] as const;

export const PANGKAT_GOLONGAN_OPTIONS = [
  // Golongan I
  "I/a",
  "I/b",
  "I/c",
  "I/d",
  // Golongan II
  "II/a",
  "II/b",
  "II/c",
  "II/d",
  // Golongan III
  "III/a",
  "III/b",
  "III/c",
  "III/d",
  // Golongan IV
  "IV/a",
  "IV/b",
  "IV/c",
  "IV/d",
  "IV/e",
  // PPPK
  "I (PPPK)",
  "IV (PPPK)",
  "V (PPPK)",
  "VI (PPPK)",
  "VII (PPPK)",
  "IX (PPPK)",
  "X (PPPK)",
  "XI (PPPK)",
  // Lainnya
  "Honorer/ PJLP/ Outsourcing",
] as const;

export const JENIS_KELAMIN_OPTIONS = [
  "Laki-laki",
  "Perempuan",
] as const;

export const AGAMA_OPTIONS = [
  "Islam",
  "Kristen Protestan",
  "Katolik",
  "Hindu",
  "Buddha",
  "Khonghucu",
  "Lainnya / Kepercayaan",
] as const;

export const PENDIDIKAN_TERAKHIR_OPTIONS = [
  "SMA / SMK Sederajat",
  "Diploma I (D1)",
  "Diploma II (D2)",
  "Diploma III (D3)",
  "Diploma IV / Sarjana (D4 / S1)",
  "Magister (S2)",
  "Doktor (S3)",
  "Pendidikan Lainnya",
] as const;

export const PROVINSI_INDONESIA_OPTIONS = [
  "Aceh",
  "Sumatera Utara",
  "Sumatera Barat",
  "Riau",
  "Kepulauan Riau",
  "Jambi",
  "Sumatera Selatan",
  "Kepulauan Bangka Belitung",
  "Bengkulu",
  "Lampung",
  "DKI Jakarta",
  "Banten",
  "Jawa Barat",
  "Jawa Tengah",
  "DI Yogyakarta",
  "Jawa Timur",
  "Bali",
  "Nusa Tenggara Barat",
  "Nusa Tenggara Timur",
  "Kalimantan Barat",
  "Kalimantan Tengah",
  "Kalimantan Selatan",
  "Kalimantan Timur",
  "Kalimantan Utara",
  "Sulawesi Utara",
  "Gorontalo",
  "Sulawesi Tengah",
  "Sulawesi Barat",
  "Sulawesi Selatan",
  "Sulawesi Tenggara",
  "Maluku",
  "Maluku Utara",
  "Papua",
  "Papua Barat",
  "Papua Selatan",
  "Papua Tengah",
  "Papua Pegunungan",
  "Papua Barat Daya",
] as const;

