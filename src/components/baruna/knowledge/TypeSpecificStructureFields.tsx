import { FileText, FolderKanban, PieChart, Wrench, CheckCircle2 } from "lucide-react";
import {
  emptyPolicyBriefStructure,
  emptyCaseStudyStructure,
  emptyInfographicStructure,
  emptyToolkitStructure,
  type PolicyBriefStructure,
  type CaseStudyStructure,
  type InfographicStructure,
  type ToolkitStructure,
} from "@/lib/resources";

function hasAnyValue(obj?: Record<string, unknown> | null): boolean {
  if (!obj) return false;
  return Object.values(obj).some((val) => typeof val === "string" && val.trim().length > 0);
}

// ============================================================================
// 1. POLICY BRIEF STRUCTURE
// ============================================================================

const POLICY_BRIEF_FIELDS: {
  key: keyof PolicyBriefStructure;
  label: string;
  sublabel: string;
  placeholder: string;
}[] = [
  {
    key: "policyIssue",
    label: "Isu Kebijakan Utama (Policy Issue)",
    sublabel: "Permasalahan strategis atau celah regulasi yang memerlukan perhatian pengambil kebijakan.",
    placeholder: "Contoh: Kebutuhan harmonisasi tata kelola kuota penangkapan ikan terukur berbasis data spasial di WPP-NRI...",
  },
  {
    key: "keyFindings",
    label: "Temuan Kunci & Bukti Ilmiah (Key Findings)",
    sublabel: "Ringkasan bukti empiris atau hasil kajian lapangan yang mendasari rekomendasi.",
    placeholder: "Contoh: Survei di 6 pelabuhan perikanan menunjukkan integrasi e-Logbook meningkatkan akurasi pendataan stok hingga 34%...",
  },
  {
    key: "recommendedActions",
    label: "Rekomendasi Kebijakan Operasional (Recommended Actions)",
    sublabel: "Langkah kebijakan konkret yang direkomendasikan untuk jangka pendek dan menengah.",
    placeholder: "Contoh: 1. Standarisasi instrumen pemantauan pendaratan ikan 2. Insentif kepatuhan bagi kapal skala kecil...",
  },
  {
    key: "intendedAudience",
    label: "Sasaran Pengambil Kebijakan (Intended Audience)",
    sublabel: "Institusi, direktorat, pemerintah daerah, atau pemangku kepentingan yang dituju.",
    placeholder: "Contoh: Kementerian Kelautan dan Perikanan (KKP), Dinas KP Provinsi, Pengelola WPP-NRI, dan Mitra Pembangunan...",
  },
];

export function PolicyBriefStructureForm({
  value,
  onChange,
}: {
  value?: PolicyBriefStructure;
  onChange: (next: PolicyBriefStructure) => void;
}) {
  const current: PolicyBriefStructure = {
    ...emptyPolicyBriefStructure,
    ...(value ?? {}),
  };

  return (
    <div className="mt-6 rounded-2xl border border-blue-500/30 bg-blue-500/[0.04] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
          <FileText className="h-4.5 w-4.5" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm sm:text-base font-bold text-navy">
              Ringkasan Struktur Risalah Kebijakan (Policy Brief Structure)
            </h3>
            <span className="rounded-full bg-blue-600/15 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-blue-800">
              Direkomendasikan · Policy Brief
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Lengkapi poin-poin inti risalah kebijakan ini agar pengambil keputusan dapat langsung membaca isu utama, temuan bukti, dan rekomendasi tindakan di halaman katalog Knowledge Hub.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {POLICY_BRIEF_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col">
            <label className="text-xs font-bold text-navy">{field.label}</label>
            <span className="mt-0.5 text-[0.7rem] text-muted-foreground">{field.sublabel}</span>
            <textarea
              rows={2}
              value={current[field.key]}
              onChange={(e) => onChange({ ...current, [field.key]: e.target.value })}
              placeholder={field.placeholder}
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm text-navy placeholder:text-muted-foreground/60 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PolicyBriefStructurePreview({ value }: { value?: Partial<PolicyBriefStructure> | null }) {
  if (!hasAnyValue(value)) return null;
  const entries = POLICY_BRIEF_FIELDS.filter((f) => typeof value?.[f.key] === "string" && value[f.key]!.trim().length > 0);

  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/[0.04] p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-800">
        <CheckCircle2 className="h-4 w-4 text-blue-600" />
        Struktur Risalah Kebijakan (Policy Brief Highlights)
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {entries.map((f) => (
          <div key={f.key} className="rounded-lg border border-border/80 bg-card p-3">
            <dt className="text-[0.65rem] font-bold uppercase tracking-wider text-marine">{f.label}</dt>
            <dd className="mt-1 text-xs leading-relaxed text-foreground/85 whitespace-pre-line">{value?.[f.key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ============================================================================
// 2. CASE STUDY STRUCTURE
// ============================================================================

const CASE_STUDY_FIELDS: {
  key: keyof CaseStudyStructure;
  label: string;
  sublabel: string;
  placeholder: string;
}[] = [
  {
    key: "background",
    label: "Latar Belakang Lokasi / Program (Background)",
    sublabel: "Konteks awal lokasi, komoditas, atau program tempat studi kasus berlangsung.",
    placeholder: "Contoh: Program pendampingan kampung budidaya rumput laut berkelanjutan di Kabupaten Wakatobi...",
  },
  {
    key: "problem",
    label: "Permasalahan Utama (Problem Statement)",
    sublabel: "Masalah spesifik yang diangkat dalam studi kasus ini.",
    placeholder: "Contoh: Fluktuasi mutu bibit rumput laut akibat perubahan suhu permukaan laut dan penyakit ice-ice...",
  },
  {
    key: "intervention",
    label: "Intervensi / Pendekatan (Intervention)",
    sublabel: "Solusi teknis atau sosial-kelembagaan yang diuji pada kasus ini.",
    placeholder: "Contoh: Seleksi bibit unggul tahan suhu tinggi dan pembentukan kebun bibit terdesentralisasi...",
  },
  {
    key: "process",
    label: "Tahapan Pelaksanaan (Implementation Process)",
    sublabel: "Alur kegiatan dari awal hingga evaluasi.",
    placeholder: "Contoh: Diagnosa lapangan → Pelatihan kelompok → Uji coba 3 siklus tanam → Evaluasi hasil...",
  },
  {
    key: "results",
    label: "Hasil & Dampak (Results & Impact)",
    sublabel: "Perubahan nyata yang tercatat dari studi kasus.",
    placeholder: "Contoh: Produktivitas panen meningkat 22% dan tingkat gagal panen turun dari 35% menjadi 8%...",
  },
  {
    key: "challenges",
    label: "Tantangan & Kendala (Key Challenges)",
    sublabel: "Hambatan lapangan yang dihadapi selama proses berjalan.",
    placeholder: "Contoh: Keterbatasan akses rantai dingin dan logistik pengangkutan hasil panen antar-pulau...",
  },
  {
    key: "lessons",
    label: "Pelajaran yang Dipetik (Lessons Learned)",
    sublabel: "Pembelajaran penting bagi peneliti maupun praktisi.",
    placeholder: "Contoh: Kemandirian kebun bibit di tingkat desa terbukti mengurangi ketergantungan bibit luar daerah...",
  },
  {
    key: "recommendations",
    label: "Rekomendasi Tindak Lanjut (Recommendations)",
    sublabel: "Saran pengembangan atau pelembagaan ke depan.",
    placeholder: "Contoh: Integrasikan protokol kebun bibit desa ke dalam kurikulum penyuluhan perikanan daerah...",
  },
];

export function CaseStudyStructureForm({
  value,
  onChange,
}: {
  value?: CaseStudyStructure;
  onChange: (next: CaseStudyStructure) => void;
}) {
  const current: CaseStudyStructure = {
    ...emptyCaseStudyStructure,
    ...(value ?? {}),
  };

  return (
    <div className="mt-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.04] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
          <FolderKanban className="h-4.5 w-4.5" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm sm:text-base font-bold text-navy">
              Struktur Studi Kasus (Case Study Structure)
            </h3>
            <span className="rounded-full bg-indigo-600/15 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-indigo-800">
              Direkomendasikan · Case Study
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Jabarkan latar belakang, permasalahan, proses intervensi, hingga pembelajaran dari studi kasus ini agar tampil sistematis di katalog Knowledge Hub.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {CASE_STUDY_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col">
            <label className="text-xs font-bold text-navy">{field.label}</label>
            <span className="mt-0.5 text-[0.7rem] text-muted-foreground">{field.sublabel}</span>
            <textarea
              rows={2}
              value={current[field.key]}
              onChange={(e) => onChange({ ...current, [field.key]: e.target.value })}
              placeholder={field.placeholder}
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm text-navy placeholder:text-muted-foreground/60 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/15"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CaseStudyStructurePreview({ value }: { value?: Partial<CaseStudyStructure> | null }) {
  if (!hasAnyValue(value)) return null;
  const entries = CASE_STUDY_FIELDS.filter((f) => typeof value?.[f.key] === "string" && value[f.key]!.trim().length > 0);

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/[0.04] p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-800">
        <CheckCircle2 className="h-4 w-4 text-indigo-600" />
        Struktur Studi Kasus (Case Study Details)
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {entries.map((f) => (
          <div key={f.key} className="rounded-lg border border-border/80 bg-card p-3">
            <dt className="text-[0.65rem] font-bold uppercase tracking-wider text-marine">{f.label}</dt>
            <dd className="mt-1 text-xs leading-relaxed text-foreground/85 whitespace-pre-line">{value?.[f.key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ============================================================================
// 3. INFOGRAPHIC STRUCTURE
// ============================================================================

const INFOGRAPHIC_FIELDS: {
  key: keyof InfographicStructure;
  label: string;
  sublabel: string;
  placeholder: string;
}[] = [
  {
    key: "keyTakeaways",
    label: "Pesan Kunci / Ringkasan Visual (Key Takeaways)",
    sublabel: "Poin-poin statistik atau informasi utama yang divisualisasikan pada infografik.",
    placeholder: "Contoh: 1. Peta sebaran 11 WPP-NRI 2. Proporsi armada perikanan skala kecil (90%) 3. Alur sertifikasi CPIB...",
  },
  {
    key: "dataSource",
    label: "Sumber Data / Referensi (Data Source)",
    sublabel: "Rujukan data statistik atau laporan resmi yang menjadi dasar visualisasi.",
    placeholder: "Contoh: Statistik Kelautan dan Perikanan KKP 2025 & Hasil Survei Lapangan BPPSDM KP...",
  },
  {
    key: "visualFormat",
    label: "Format & Dimensi Visual (Visual Format)",
    sublabel: "Bentuk sajian visual (Poster A3, Diagram Alir SOP, Peta Tematik, Carousel Edukasi).",
    placeholder: "Contoh: Poster Infografik Resolusi Tinggi (A3 Portrait — Siap Cetak untuk Penyuluhan)...",
  },
  {
    key: "targetAudience",
    label: "Sasaran Pembaca / Pengguna (Target Audience)",
    sublabel: "Kelompok pengguna yang paling terbantu dengan materi visual ini.",
    placeholder: "Contoh: Penyuluh Perikanan Lapangan, Kelompok Pembudidaya Ikan (Pokdakan), dan Pelajar/Taruna KP...",
  },
];

export function InfographicStructureForm({
  value,
  onChange,
}: {
  value?: InfographicStructure;
  onChange: (next: InfographicStructure) => void;
}) {
  const current: InfographicStructure = {
    ...emptyInfographicStructure,
    ...(value ?? {}),
  };

  return (
    <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-xs">
          <PieChart className="h-4.5 w-4.5" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm sm:text-base font-bold text-navy">
              Informasi Ringkasan Infografik / Dokumentasi Visual
            </h3>
            <span className="rounded-full bg-amber-600/15 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-amber-800">
              Direkomendasikan · Infographic
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Tuliskan poin statistik utama dan sumber data agar materi visual ini mudah dicari serta dipahami konteksnya di katalog Infographics.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {INFOGRAPHIC_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col">
            <label className="text-xs font-bold text-navy">{field.label}</label>
            <span className="mt-0.5 text-[0.7rem] text-muted-foreground">{field.sublabel}</span>
            <textarea
              rows={2}
              value={current[field.key]}
              onChange={(e) => onChange({ ...current, [field.key]: e.target.value })}
              placeholder={field.placeholder}
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm text-navy placeholder:text-muted-foreground/60 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/15"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function InfographicStructurePreview({ value }: { value?: Partial<InfographicStructure> | null }) {
  if (!hasAnyValue(value)) return null;
  const entries = INFOGRAPHIC_FIELDS.filter((f) => typeof value?.[f.key] === "string" && value[f.key]!.trim().length > 0);

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
        <CheckCircle2 className="h-4 w-4 text-amber-600" />
        Rincian Infografik &amp; Sumber Data Visual
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {entries.map((f) => (
          <div key={f.key} className="rounded-lg border border-border/80 bg-card p-3">
            <dt className="text-[0.65rem] font-bold uppercase tracking-wider text-marine">{f.label}</dt>
            <dd className="mt-1 text-xs leading-relaxed text-foreground/85 whitespace-pre-line">{value?.[f.key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ============================================================================
// 4. TOOLKIT STRUCTURE
// ============================================================================

const TOOLKIT_FIELDS: {
  key: keyof ToolkitStructure;
  label: string;
  sublabel: string;
  placeholder: string;
}[] = [
  {
    key: "includedTools",
    label: "Daftar Instrumen / Komponen Toolkit (Included Tools)",
    sublabel: "Sebutkan lembar kerja, daftar periksa, atau template yang ada di dalam berkas ini.",
    placeholder: "Contoh: 1. Form Survei Kualitas Air Harian 2. Checklist Biosekuriti Tambak 3. Kalkulator Pakan (FCR)...",
  },
  {
    key: "targetUsers",
    label: "Pengguna Sasaran (Target Practitioners)",
    sublabel: "Siapa yang menggunakan instrumen/template ini di lapangan.",
    placeholder: "Contoh: Teknisi Tambak, Penyuluh Perikanan, Enumerator Data Pesisir, dan Peserta Pelatihan...",
  },
  {
    key: "instructionsForUse",
    label: "Panduan Penggunaan Singkat (Instructions for Use)",
    sublabel: "Cara pengisian atau penerapan instrumen ini di lapangan.",
    placeholder: "Contoh: Cetak lembar checklist atau buka di Excel/Smartphone saat inspeksi mingguan, lalu rekap nilai skor kepatuhan...",
  },
  {
    key: "softwareRequirements",
    label: "Format & Kebutuhan Perangkat (Format / Requirements)",
    sublabel: "Aplikasi yang dibutuhkan untuk membuka/menggunakan toolkit.",
    placeholder: "Contoh: Microsoft Excel / Google Sheets (.xlsx) & Dokumen Panduan Cetak (.pdf)...",
  },
];

export function ToolkitStructureForm({
  value,
  onChange,
}: {
  value?: ToolkitStructure;
  onChange: (next: ToolkitStructure) => void;
}) {
  const current: ToolkitStructure = {
    ...emptyToolkitStructure,
    ...(value ?? {}),
  };

  return (
    <div className="mt-6 rounded-2xl border border-teal-500/30 bg-teal-500/[0.04] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
          <Wrench className="h-4.5 w-4.5" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm sm:text-base font-bold text-navy">
              Rincian Instrumen &amp; Komponen Toolkit (Toolkit Specification)
            </h3>
            <span className="rounded-full bg-teal-600/15 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-teal-800">
              Direkomendasikan · Toolkit &amp; Template
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Jelaskan komponen instrumen yang terdapat di dalam berkas ini serta cara penggunaannya agar praktisi dapat langsung menerapkannya di lapangan.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {TOOLKIT_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col">
            <label className="text-xs font-bold text-navy">{field.label}</label>
            <span className="mt-0.5 text-[0.7rem] text-muted-foreground">{field.sublabel}</span>
            <textarea
              rows={2}
              value={current[field.key]}
              onChange={(e) => onChange({ ...current, [field.key]: e.target.value })}
              placeholder={field.placeholder}
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs sm:text-sm text-navy placeholder:text-muted-foreground/60 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ToolkitStructurePreview({ value }: { value?: Partial<ToolkitStructure> | null }) {
  if (!hasAnyValue(value)) return null;
  const entries = TOOLKIT_FIELDS.filter((f) => typeof value?.[f.key] === "string" && value[f.key]!.trim().length > 0);

  return (
    <div className="rounded-xl border border-teal-500/30 bg-teal-500/[0.04] p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-800">
        <CheckCircle2 className="h-4 w-4 text-teal-600" />
        Spesifikasi Instrumen &amp; Panduan Toolkit
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {entries.map((f) => (
          <div key={f.key} className="rounded-lg border border-border/80 bg-card p-3">
            <dt className="text-[0.65rem] font-bold uppercase tracking-wider text-marine">{f.label}</dt>
            <dd className="mt-1 text-xs leading-relaxed text-foreground/85 whitespace-pre-line">{value?.[f.key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

