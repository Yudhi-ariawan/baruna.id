import { useState } from "react";
import {
  BookOpen,
  Languages as LanguagesIcon,
  FolderGit2,
  ScrollText,
  Plus,
  Trash2,
  Building,
  Calendar,
  ExternalLink,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  genId,
  type ExpertApplicationDraft,
  type ExpertLanguageItem,
  type ExpertProjectItem,
  type ExpertPublicationItem,
  type LanguageProficiency,
} from "@/lib/experts";

interface ProfessionalProfileSectionProps {
  form: ExpertApplicationDraft;
  set: <K extends keyof ExpertApplicationDraft>(key: K, value: ExpertApplicationDraft[K]) => void;
  setForm: React.Dispatch<React.SetStateAction<ExpertApplicationDraft>>;
  inputClass: string;
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
      {children}
      {required && <span className="ml-1 text-destructive">*</span>}
    </label>
  );
}

function SectionCard({
  icon: Icon,
  n,
  title,
  children,
}: {
  icon: LucideIcon;
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="flex items-center gap-2.5 font-display text-lg font-bold text-navy">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-marine/10 text-marine">
          <Icon className="h-4 w-4" />
        </span>
        Section {n} — {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function ProfessionalProfileSection({
  form,
  set,
  setForm,
  inputClass,
}: ProfessionalProfileSectionProps) {
  // --- Languages State & Handlers (Aligned with public.expert_languages) ---
  const [customLanguage, setCustomLanguage] = useState("");
  const [customProficiency, setCustomProficiency] = useState<LanguageProficiency>("fluent");

  const languagesList: ExpertLanguageItem[] = form.structuredLanguages ?? [];

  const updateLanguages = (newItems: ExpertLanguageItem[]) => {
    const summary = newItems.map((item) => `${item.language} (${item.proficiency})`).join(", ");
    setForm((f) => ({
      ...f,
      structuredLanguages: newItems,
      languages: summary,
    }));
  };

  const addLanguage = (lang: string, prof: LanguageProficiency = "fluent") => {
    const clean = lang.trim();
    if (!clean) return;
    if (languagesList.some((l) => l.language.toLowerCase() === clean.toLowerCase())) {
      toast.info(`${clean} sudah ada di daftar bahasa.`);
      return;
    }
    const next = [...languagesList, { id: genId("lang"), language: clean, proficiency: prof }];
    updateLanguages(next);
  };

  const removeLanguage = (langName: string) => {
    const next = languagesList.filter((l) => l.language !== langName);
    updateLanguages(next);
  };

  // --- Projects State & Handlers (Aligned with public.expert_projects) ---
  const projectsList: ExpertProjectItem[] = form.structuredProjects ?? [];
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProject, setNewProject] = useState<Partial<ExpertProjectItem>>({
    name: "",
    institution: "",
    role: "",
    period: "",
    description: "",
    url: "",
  });

  const updateProjects = (newItems: ExpertProjectItem[]) => {
    const summary = newItems
      .map(
        (p) =>
          `• ${p.name}${p.institution ? ` — ${p.institution}` : ""}${p.role ? ` (${p.role})` : ""}${p.period ? ` [${p.period}]` : ""}${p.description ? `\n  ${p.description}` : ""}`,
      )
      .join("\n\n");
    setForm((f) => ({
      ...f,
      structuredProjects: newItems,
      keyProjects: summary,
    }));
  };

  const handleSaveProject = () => {
    if (!newProject.name?.trim()) {
      toast.error("Nama proyek / inisiatif wajib diisi.");
      return;
    }
    const item: ExpertProjectItem = {
      id: genId("proj"),
      name: newProject.name.trim(),
      institution: newProject.institution?.trim() || undefined,
      role: newProject.role?.trim() || undefined,
      period: newProject.period?.trim() || undefined,
      description: newProject.description?.trim() || undefined,
      url: newProject.url?.trim() || undefined,
    };
    updateProjects([...projectsList, item]);
    setNewProject({ name: "", institution: "", role: "", period: "", description: "", url: "" });
    setShowAddProject(false);
    toast.success("Proyek berhasil ditambahkan ke portofolio!");
  };

  const handleRemoveProject = (index: number) => {
    const next = projectsList.filter((_, i) => i !== index);
    updateProjects(next);
  };

  // --- Publications State & Handlers (Aligned with public.expert_publications) ---
  const publicationsList: ExpertPublicationItem[] = form.structuredPublications ?? [];
  const [showAddPublication, setShowAddPublication] = useState(false);
  const [newPublication, setNewPublication] = useState<Partial<ExpertPublicationItem>>({
    title: "",
    venue: "",
    year: "",
    url: "",
  });

  const updatePublications = (newItems: ExpertPublicationItem[]) => {
    const summary = newItems
      .map(
        (p) =>
          `• ${p.title}${p.venue ? ` — ${p.venue}` : ""}${p.year ? ` (${p.year})` : ""}${p.url ? ` [${p.url}]` : ""}`,
      )
      .join("\n");
    setForm((f) => ({
      ...f,
      structuredPublications: newItems,
      publications: summary,
    }));
  };

  const handleSavePublication = () => {
    if (!newPublication.title?.trim()) {
      toast.error("Judul publikasi / karya tulis wajib diisi.");
      return;
    }
    const item: ExpertPublicationItem = {
      id: genId("pub"),
      title: newPublication.title.trim(),
      venue: newPublication.venue?.trim() || undefined,
      year: newPublication.year?.trim() || undefined,
      url: newPublication.url?.trim() || undefined,
    };
    updatePublications([...publicationsList, item]);
    setNewPublication({ title: "", venue: "", year: "", url: "" });
    setShowAddPublication(false);
    toast.success("Publikasi ilmiah berhasil ditambahkan!");
  };

  const handleRemovePublication = (index: number) => {
    const next = publicationsList.filter((_, i) => i !== index);
    updatePublications(next);
  };

  return (
    <SectionCard icon={BookOpen} n={4} title="Professional Profile">
      <div className="grid gap-6">
        {/* Professional Biography */}
        <div>
          <FieldLabel required>Professional Biography</FieldLabel>
          <textarea
            className={`${inputClass} min-h-[120px] resize-y`}
            value={form.biography}
            maxLength={2500}
            placeholder="Ringkasan latar belakang profesional, fokus keahlian maritim & perikanan, serta rekam jejak kepakaran Anda..."
            onChange={(e) => set("biography", e.target.value)}
          />
          <p className="mt-1 text-[11px] text-muted-foreground text-right">
            {form.biography.length} / 2500 karakter
          </p>
        </div>

        {/* Years of Experience */}
        <div className="max-w-xs">
          <FieldLabel>Years of Experience (Tahun Pengalaman)</FieldLabel>
          <input
            className={inputClass}
            type="number"
            min={0}
            placeholder="e.g. 10"
            value={form.yearsExperience}
            onChange={(e) => set("yearsExperience", e.target.value)}
          />
        </div>

        {/* Languages Spoken (Sesuai Skema ERD public.expert_languages) */}
        <div className="rounded-xl border border-border/80 bg-slate-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LanguagesIcon className="h-4 w-4 text-marine" />
              <FieldLabel>Languages Spoken (Kemampuan Bahasa)</FieldLabel>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              ERD: expert_languages (1:N)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Pilih bahasa yang Anda kuasai beserta tingkat kemahirannya untuk fasilitasi pelatihan dan kolaborasi internasional.
          </p>

          {/* Quick Add Language Presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-semibold text-muted-foreground mr-1">Rekomendasi Cepat:</span>
            {[
              { lang: "Bahasa Indonesia", prof: "native" as const },
              { lang: "English", prof: "fluent" as const },
              { lang: "French", prof: "intermediate" as const },
              { lang: "Spanish", prof: "intermediate" as const },
              { lang: "Mandarin", prof: "basic" as const },
              { lang: "Arabic", prof: "basic" as const },
              { lang: "Japanese", prof: "basic" as const },
            ].map((p) => {
              const already = languagesList.some((l) => l.language.toLowerCase() === p.lang.toLowerCase());
              return (
                <button
                  key={p.lang}
                  type="button"
                  disabled={already}
                  onClick={() => addLanguage(p.lang, p.prof)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    already
                      ? "bg-slate-200/60 text-slate-400 cursor-not-allowed"
                      : "bg-white border border-border text-navy hover:border-marine hover:bg-marine/5 cursor-pointer shadow-2xs"
                  }`}
                >
                  <Plus className="h-3 w-3 text-marine" /> {p.lang}
                </button>
              );
            })}
          </div>

          {/* Custom Add Language Form */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <input
              className={`${inputClass} flex-1 min-w-[160px] text-xs h-9`}
              placeholder="Ketik bahasa lain (misal: German, Dutch)..."
              value={customLanguage}
              onChange={(e) => setCustomLanguage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (customLanguage.trim()) {
                    addLanguage(customLanguage, customProficiency);
                    setCustomLanguage("");
                  }
                }
              }}
            />
            <select
              className={`${inputClass} w-auto text-xs h-9 py-1`}
              value={customProficiency}
              onChange={(e) => setCustomProficiency(e.target.value as LanguageProficiency)}
            >
              <option value="native">Native / Bilingual (Bahasa Ibu)</option>
              <option value="fluent">Fluent (Fasih / C1-C2)</option>
              <option value="professional">Professional Working (B2)</option>
              <option value="intermediate">Intermediate (Menengah / B1)</option>
              <option value="basic">Basic (Dasar / A1-A2)</option>
            </select>
            <button
              type="button"
              onClick={() => {
                if (customLanguage.trim()) {
                  addLanguage(customLanguage, customProficiency);
                  setCustomLanguage("");
                }
              }}
              className="inline-flex items-center gap-1 rounded-xl bg-marine px-3.5 py-2 text-xs font-semibold text-white hover:bg-navy transition shadow-2xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah
            </button>
          </div>

          {/* Selected Languages Badges */}
          <div className="pt-2">
            {languagesList.length === 0 ? (
              <p className="text-xs italic text-muted-foreground/80">
                Belum ada bahasa yang ditambahkan. Silakan pilih dari rekomendasi di atas atau ketik bahasa Anda.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {languagesList.map((item) => (
                  <span
                    key={item.language}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-marine/25 bg-white px-3 py-1.5 text-xs shadow-2xs font-medium text-navy"
                  >
                    <span className="font-semibold">{item.language}</span>
                    <span className="rounded-md bg-marine/10 px-1.5 py-0.5 text-[10px] font-bold text-marine capitalize">
                      {item.proficiency}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLanguage(item.language)}
                      className="ml-0.5 text-muted-foreground hover:text-destructive cursor-pointer"
                      title={`Hapus ${item.language}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Key Projects & Portofolio (Sesuai Skema ERD public.expert_projects) */}
        <div className="rounded-xl border border-border/80 bg-slate-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-marine" />
              <FieldLabel>Key Projects &amp; Initiatives (Riwayat Proyek &amp; Riset)</FieldLabel>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              ERD: expert_projects (1:N)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Daftar kegiatan, riset, atau proyek strategis kelautan dan perikanan yang pernah Anda tangani secara terstruktur.
          </p>

          {/* List of Added Projects */}
          {projectsList.length > 0 && (
            <div className="space-y-2.5 pt-1">
              {projectsList.map((proj, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border bg-white p-3.5 shadow-2xs space-y-1.5 transition-all hover:border-marine/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-display text-sm font-bold text-navy truncate">
                        {proj.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {proj.institution && (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                            <Building className="h-3 w-3 text-marine" /> {proj.institution}
                          </span>
                        )}
                        {proj.role && (
                          <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                            {proj.role}
                          </span>
                        )}
                        {proj.period && (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                            <Calendar className="h-3 w-3" /> {proj.period}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveProject(idx)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded-lg hover:bg-destructive/10 transition cursor-pointer"
                      title="Hapus proyek ini"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {proj.description && (
                    <p className="text-xs text-foreground/80 leading-relaxed pt-1 border-t border-border/50">
                      {proj.description}
                    </p>
                  )}
                  {proj.url && (
                    <a
                      href={proj.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-marine hover:underline font-semibold"
                    >
                      Tautan Dokumentasi / Portofolio <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Project Inline Form or Button */}
          {showAddProject ? (
            <div className="rounded-xl border border-marine/30 bg-marine/5 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-marine/15 pb-2">
                <span className="text-xs font-bold text-navy uppercase tracking-wider">
                  Tambah Catatan Proyek Baru
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddProject(false)}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Batal
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Nama Proyek / Kegiatan <span className="text-destructive">*</span>
                  </label>
                  <input
                    className={inputClass}
                    placeholder="e.g. Coral Reef Rehabilitation & Marine Protected Area Zoning"
                    value={newProject.name ?? ""}
                    onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Lembaga / Mitra Pendonor
                  </label>
                  <input
                    className={inputClass}
                    placeholder="e.g. Kementerian Kelautan dan Perikanan & World Bank"
                    value={newProject.institution ?? ""}
                    onChange={(e) => setNewProject((p) => ({ ...p, institution: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Peran Anda dalam Proyek
                  </label>
                  <input
                    className={inputClass}
                    placeholder="e.g. Lead Technical Specialist / Principal Investigator"
                    value={newProject.role ?? ""}
                    onChange={(e) => setNewProject((p) => ({ ...p, role: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Tahun / Periode
                  </label>
                  <input
                    className={inputClass}
                    placeholder="e.g. 2022 - 2024"
                    value={newProject.period ?? ""}
                    onChange={(e) => setNewProject((p) => ({ ...p, period: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Tautan Bukti / Dokumentasi (Opsional)
                  </label>
                  <input
                    className={inputClass}
                    placeholder="https://..."
                    value={newProject.url ?? ""}
                    onChange={(e) => setNewProject((p) => ({ ...p, url: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Deskripsi Singkat Proyek &amp; Hasil Capaian
                  </label>
                  <textarea
                    className={`${inputClass} min-h-[60px] resize-y`}
                    placeholder="Jelaskan kontribusi Anda, cakupan wilayah perairan, dan dampak yang dicapai..."
                    value={newProject.description ?? ""}
                    onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddProject(false)}
                  className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-muted cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveProject}
                  className="rounded-xl bg-marine px-4 py-1.5 text-xs font-semibold text-white hover:bg-navy shadow-2xs cursor-pointer"
                >
                  Simpan Proyek
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddProject(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-marine/40 bg-white px-4 py-2 text-xs font-semibold text-marine hover:bg-marine/5 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah Proyek / Portofolio Baru
            </button>
          )}
        </div>

        {/* Publications & Research (Sesuai Skema ERD public.expert_publications) */}
        <div className="rounded-xl border border-border/80 bg-slate-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-marine" />
              <FieldLabel>Publications &amp; Research (Karya Ilmiah &amp; Buku)</FieldLabel>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              ERD: expert_publications (1:N)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Daftar publikasi artikel jurnal, prosiding konferensi internasional, atau buku yang telah Anda terbitkan.
          </p>

          {/* List of Added Publications */}
          {publicationsList.length > 0 && (
            <div className="space-y-2.5 pt-1">
              {publicationsList.map((pub, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border bg-white p-3.5 shadow-2xs space-y-1 transition-all hover:border-marine/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-display text-sm font-bold text-navy leading-snug">
                        {pub.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                        {pub.venue && (
                          <span className="font-medium text-slate-700 italic">
                            {pub.venue}
                          </span>
                        )}
                        {pub.year && (
                          <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                            Tahun {pub.year}
                          </span>
                        )}
                        {pub.url && (
                          <a
                            href={pub.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-marine hover:underline font-semibold"
                          >
                            Tautan DOI / Web <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePublication(idx)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded-lg hover:bg-destructive/10 transition cursor-pointer"
                      title="Hapus publikasi ini"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Publication Inline Form or Button */}
          {showAddPublication ? (
            <div className="rounded-xl border border-marine/30 bg-marine/5 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-marine/15 pb-2">
                <span className="text-xs font-bold text-navy uppercase tracking-wider">
                  Tambah Publikasi / Karya Tulis Ilmiah
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddPublication(false)}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Batal
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Judul Publikasi / Artikel / Buku <span className="text-destructive">*</span>
                  </label>
                  <input
                    className={inputClass}
                    placeholder="e.g. Sustainable Tuna Fisheries Management in the Coral Triangle"
                    value={newPublication.title ?? ""}
                    onChange={(e) => setNewPublication((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Penerbit / Nama Jurnal / Forum Ilmiah
                  </label>
                  <input
                    className={inputClass}
                    placeholder="e.g. Marine Policy / Jurnal Riset Kelautan"
                    value={newPublication.venue ?? ""}
                    onChange={(e) => setNewPublication((p) => ({ ...p, venue: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Tahun Publikasi
                  </label>
                  <input
                    className={inputClass}
                    placeholder="e.g. 2024"
                    value={newPublication.year ?? ""}
                    onChange={(e) => setNewPublication((p) => ({ ...p, year: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Tautan DOI / URL Online (Opsional)
                  </label>
                  <input
                    className={inputClass}
                    placeholder="https://doi.org/..."
                    value={newPublication.url ?? ""}
                    onChange={(e) => setNewPublication((p) => ({ ...p, url: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddPublication(false)}
                  className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-muted cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSavePublication}
                  className="rounded-xl bg-marine px-4 py-1.5 text-xs font-semibold text-white hover:bg-navy shadow-2xs cursor-pointer"
                >
                  Simpan Publikasi
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddPublication(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-marine/40 bg-white px-4 py-2 text-xs font-semibold text-marine hover:bg-marine/5 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah Publikasi Ilmiah Baru
            </button>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

