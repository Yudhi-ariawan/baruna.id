import { Sparkles, CheckCircle2 } from "lucide-react";
import { emptyBestPracticeStructure, type BestPracticeStructure } from "@/lib/resources";

type BestPracticeStructureFormProps = {
  value?: BestPracticeStructure;
  onChange: (next: BestPracticeStructure) => void;
};

const FIELDS: {
  key: keyof BestPracticeStructure;
  label: string;
  sublabel: string;
  placeholder: string;
  rows?: number;
}[] = [
  {
    key: "challenge",
    label: "Tantangan / Masalah Lapangan (Challenge)",
    sublabel: "Permasalahan utama yang dihadapi sebelum intervensi dilakukan.",
    placeholder: "Contoh: Degradasi padang lamun dan penurunan tangkapan nelayan skala kecil akibat praktik penangkapan tidak ramah lingkungan...",
    rows: 2,
  },
  {
    key: "context",
    label: "Konteks Wilayah & Sasaran (Context)",
    sublabel: "Lokasi geografis, kondisi ekosistem, dan kelompok sasaran.",
    placeholder: "Contoh: Pesisir Kepulauan Derawan, Kalimantan Timur — melibatkan 120 nelayan tradisional dan kelompok masyarakat pengawas (Pokmaswas)...",
    rows: 2,
  },
  {
    key: "intervention",
    label: "Solusi / Intervensi Utama (Intervention)",
    sublabel: "Pendekatan, metode, atau inovasi yang diterapkan untuk mengatasi masalah.",
    placeholder: "Contoh: Penerapan sistem buka-tutup kawasan tangkap berbasis adat (Sasi Laut Modern) yang dipadukan dengan pemantauan partisipatif...",
    rows: 2,
  },
  {
    key: "steps",
    label: "Tahapan Pelaksanaan (Implementation Steps)",
    sublabel: "Urutan langkah kunci pelaksanaan di lapangan.",
    placeholder: "Contoh: 1. Pemetaan partisipatif → 2. Kesepakatan desa → 3. Pelatihan enumerator lokal → 4. Evaluasi triwulanan...",
    rows: 2,
  },
  {
    key: "stakeholders",
    label: "Pemangku Kepentingan Terlibat (Key Stakeholders)",
    sublabel: "Institusi, komunitas, pemerintah daerah, atau mitra yang berkolaborasi.",
    placeholder: "Contoh: Kelompok Nelayan, Dinas Kelautan dan Perikanan Provinsi, Penyuluh Perikanan KKP, Perguruan Tinggi Lokal...",
    rows: 2,
  },
  {
    key: "results",
    label: "Hasil & Dampak Terukur (Measurable Results)",
    sublabel: "Capaian kuantitatif maupun kualitatif setelah praktik diterapkan.",
    placeholder: "Contoh: Peningkatan CPUE sebesar 28% dalam 12 bulan, pemulihan tutupan terumbu/lamun sebesar 15%, dan kepatuhan zona 92%...",
    rows: 2,
  },
  {
    key: "lessons",
    label: "Pelajaran yang Dipetik (Lessons Learned)",
    sublabel: "Faktor kunci keberhasilan maupun kendala yang perlu diantisipasi.",
    placeholder: "Contoh: Keterlibatan tokoh adat dan transparansi data hasil tangkapan menjadi kunci utama kepatuhan masyarakat...",
    rows: 2,
  },
  {
    key: "replication",
    label: "Panduan Replikasi (Replication Potential)",
    sublabel: "Prasyarat dan rekomendasi agar praktik ini dapat direplikasi di wilayah lain.",
    placeholder: "Contoh: Dapat direplikasi di desa pesisir dengan kearifan lokal serupa menggunakan perangkat survei berbiaya rendah...",
    rows: 2,
  },
];

export function hasBestPracticeContent(structure?: Partial<BestPracticeStructure> | null): boolean {
  if (!structure) return false;
  return Object.values(structure).some((val) => typeof val === "string" && val.trim().length > 0);
}

export function BestPracticeStructureForm({ value, onChange }: BestPracticeStructureFormProps) {
  const current: BestPracticeStructure = {
    ...emptyBestPracticeStructure,
    ...(value ?? {}),
  };

  const handleField = (key: keyof BestPracticeStructure, nextVal: string) => {
    onChange({
      ...current,
      [key]: nextVal,
    });
  };

  return (
    <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
          <Sparkles className="h-4.5 w-4.5" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm sm:text-base font-bold text-navy">
              Struktur Praktik Baik (Best Practice Structure)
            </h3>
            <span className="rounded-full bg-emerald-600/15 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-emerald-800">
              Direkomendasikan · PB-KHU-02
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Lengkapi rincian struktur di bawah ini agar pengalaman lapangan, intervensi, dan dampak terukur dari{" "}
            <strong>Best Practice</strong> Anda tampil terstruktur di katalog Knowledge Hub dan mudah direplikasi oleh praktisi lain.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col">
            <label className="text-xs font-bold text-navy">{field.label}</label>
            <span className="mt-0.5 text-[0.7rem] text-muted-foreground">{field.sublabel}</span>
            <textarea
              rows={field.rows ?? 2}
              value={current[field.key]}
              onChange={(e) => handleField(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm text-navy placeholder:text-muted-foreground/60 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BestPracticeStructurePreview({ value }: { value?: Partial<BestPracticeStructure> | null }) {
  if (!hasBestPracticeContent(value)) return null;

  const entries = FIELDS.filter((f) => {
    const v = value?.[f.key];
    return typeof v === "string" && v.trim().length > 0;
  });

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        Struktur Praktik Baik (Best Practice Structure)
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {entries.map((f) => (
          <div key={f.key} className="rounded-lg border border-border/80 bg-card p-3">
            <dt className="text-[0.65rem] font-bold uppercase tracking-wider text-marine">{f.label}</dt>
            <dd className="mt-1 text-xs leading-relaxed text-foreground/85 whitespace-pre-line">
              {value?.[f.key]}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
