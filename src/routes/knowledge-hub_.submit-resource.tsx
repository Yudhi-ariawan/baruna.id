import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  Globe,
  Layers,
  Upload,
  X,
  Link2,
  ShieldCheck,
  ClipboardList,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import { useHomeExperience } from "@/components/baruna/home-experience";
import { supabase } from "@/integrations/supabase/client";
import { createKnowledgeResourceUpload, getKnowledgeContributorBootstrap, getKnowledgeResourceDraft, saveKnowledgeResourceDraft } from "@/lib/knowledge-hub/contribution.functions";
import {
  RESOURCE_TYPE_GROUPS,
  TOPIC_CATEGORIES,
  LANGUAGES,
  ACCESS_LEVELS,
  ACCEPTED_FILE_TYPES,
  emptyResourceDraft,
  emptyBestPracticeStructure,
  getResource,
  formatBytes,
  groupForType,
  type ResourceDraft,
  type AccessLevel,
} from "@/lib/resources";
import {
  BestPracticeStructureForm,
  BestPracticeStructurePreview,
} from "@/components/baruna/knowledge/BestPracticeStructureFields";

export const Route = createFileRoute("/knowledge-hub_/submit-resource")({
  head: () => ({
    meta: [
      { title: "Submit a Resource — Knowledge Hub — BARUNA" },
      {
        name: "description",
        content:
          "Share your knowledge, publications, learning materials, and best practices with the global marine and fisheries community.",
      },
      { property: "og:title", content: "Submit a Resource — BARUNA Knowledge Hub" },
      {
        property: "og:description",
        content: "Contribute publications, learning materials, multimedia, and tools to BARUNA.",
      },
    ],
    links: [{ rel: "canonical", href: "/knowledge-hub/submit-resource" }],
  }),
  validateSearch: (s: Record<string, unknown>): { edit?: string; type?: string } => ({
    edit: typeof s.edit === "string" ? s.edit : undefined,
    type: typeof s.type === "string" ? s.type : undefined,
  }),
  component: SubmitResourcePage,
});

const STEPS: { n: number; label: string; icon: LucideIcon }[] = [
  { n: 1, label: "Resource Type", icon: Layers },
  { n: 2, label: "Information", icon: FileText },
  { n: 3, label: "File Upload", icon: Upload },
  { n: 4, label: "Access & License", icon: ShieldCheck },
  { n: 5, label: "Review & Submit", icon: ClipboardList },
];

const MAX_BYTES = 50 * 1024 * 1024;

function SubmitResourcePage() {
  const navigate = useNavigate();
  const { authState, viewer } = useHomeExperience();
  const bootstrapFn = useServerFn(getKnowledgeContributorBootstrap);
  const saveFn = useServerFn(saveKnowledgeResourceDraft);
  const { edit, type: initialType } = useSearch({ from: Route.id });
  const existing = useMemo(() => (edit ? getResource(edit) : undefined), [edit]);

  const getDraftFn = useServerFn(getKnowledgeResourceDraft);
  const isUuid = Boolean(edit && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(edit));

  const dbDraftQuery = useQuery({
    queryKey: ["knowledge-hub", "draft", edit],
    queryFn: () => getDraftFn({ data: { draftId: edit! } }),
    enabled: Boolean(isUuid && authState === "authenticated"),
  });

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ResourceDraft>(() =>
    existing
      ? {
          type: existing.type,
          typeGroup: existing.typeGroup,
          title: existing.title,
          description: existing.description,
          author: existing.author,
          institution: existing.institution,
          country: existing.country,
          year: existing.year,
          language: existing.language,
          keywords: existing.keywords,
          topicCategory: existing.topicCategory,
          file: existing.file,
          coverFile: existing.coverFile ?? null,
          externalUrl: existing.externalUrl,
          accessLevel: existing.accessLevel,
          declaration: existing.declaration,
          practiceStructure: existing.practiceStructure ?? { ...emptyBestPracticeStructure },
        }
      : {
          ...emptyResourceDraft,
          ...(initialType ? { type: initialType, typeGroup: groupForType(initialType) } : {}),
        },
  );
  const [submitted, setSubmitted] = useState<null | "draft" | "submitted">(null);
  const [error, setError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | undefined>(isUuid ? edit : undefined);
  const [saving, setSaving] = useState(false);
  const bootstrap = useQuery({
    queryKey: ["knowledge-hub", "contributor", viewer?.id],
    queryFn: () => bootstrapFn(),
    enabled: authState === "authenticated",
    retry: false,
  });

  useEffect(() => {
    if (authState === "public") {
      void navigate({ to: "/auth", search: { mode: "signin", redirect: "/knowledge-hub/submit-resource" }, replace: true });
    }
  }, [authState, navigate]);

  const isReadOnly = dbDraftQuery.data?.status === "submitted";

  useEffect(() => {
    if (dbDraftQuery.data) {
      const d = dbDraftQuery.data;
      setDraftId(d.draftId);
      if (d.status === "submitted") {
        setStep(5);
      }
      setForm((curr) => ({
        ...curr,
        type: d.type || curr.type,
        typeGroup: d.typeGroup || curr.typeGroup,
        title: d.title || curr.title,
        description: d.description || curr.description,
        author: d.author || curr.author,
        institution: d.institution || curr.institution,
        country: d.country || curr.country,
        year: d.year || curr.year,
        language: d.language || curr.language,
        keywords: d.keywords || curr.keywords,
        topicCategory: d.topicCategory || curr.topicCategory,
        externalUrl: d.externalUrl || curr.externalUrl,
        accessLevel: d.accessLevel || curr.accessLevel,
        declaration: d.declaration || curr.declaration,
        practiceStructure: d.practiceStructure
          ? { ...emptyBestPracticeStructure, ...d.practiceStructure }
          : curr.practiceStructure,
        file: d.fileName
          ? {
              name: d.fileName,
              size: d.fileSize || 0,
              type: d.fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
              uploadedAt: new Date().toISOString(),
              storagePath: d.filePath,
            }
          : curr.file,
        coverFile: d.coverFileName || d.coverFilePath
          ? {
              name: d.coverFileName || "banner-image.jpg",
              size: d.coverFileSize || 0,
              type: (d.coverFileName || "").toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
              uploadedAt: new Date().toISOString(),
              storagePath: d.coverFilePath,
              previewUrl: d.coverPreviewUrl,
            }
          : curr.coverFile,
      }));
    }
  }, [dbDraftQuery.data]);

  useEffect(() => {
    if (!bootstrap.data || existing || dbDraftQuery.data) return;
    setForm((current) => ({
      ...current,
      ...(initialType && !current.type ? { type: initialType, typeGroup: groupForType(initialType) } : {}),
      author: bootstrap.data.author,
      institution: bootstrap.data.institution,
      country: bootstrap.data.country,
      keywords: current.keywords || bootstrap.data.expertiseAreas.join(", "),
    }));
  }, [bootstrap.data, existing, dbDraftQuery.data, initialType]);

  const set = <K extends keyof ResourceDraft>(key: K, value: ResourceDraft[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canNext = useMemo(() => {
    if (step === 1) return !!form.type;
    if (step === 2) {
      const baseOk = Boolean(
        form.title.trim() &&
          form.description.trim() &&
          form.author.trim() &&
          form.institution.trim() &&
          form.country.trim() &&
          form.year.trim() &&
          form.language.trim() &&
          form.keywords.trim() &&
          form.topicCategory.trim(),
      );
      if (!baseOk) return false;
      if (form.type === "Best Practice") {
        const ps = form.practiceStructure ?? emptyBestPracticeStructure;
        return Boolean(
          ps.challenge.trim() &&
            ps.context.trim() &&
            ps.intervention.trim() &&
            ps.steps.trim() &&
            ps.results.trim() &&
            ps.lessons.trim(),
        );
      }
      return true;
    }
    if (step === 3) return !!form.file || !!form.externalUrl.trim();
    if (step === 4) return form.declaration;
    return true;
  }, [step, form]);

  const goNext = () => {
    if (!canNext) {
      setError(
        step === 2 && form.type === "Best Practice"
          ? "Mohon lengkapi seluruh kolom wajib informasi dasar dan Struktur Praktik Terbaik (Best Practice) bertanda * sebelum melanjutkan."
          : "Please complete the required fields before continuing.",
      );
      return;
    }
    setError(null);
    setStep((s) => Math.min(5, s + 1));
  };
  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const persist = async (status: "draft" | "submitted") => {
    setSaving(true);
    setError(null);
    const draft = { ...form, typeGroup: groupForType(form.type) };
    try {
      const result = await saveFn({ data: { draftId, submit: status === "submitted", form: draft } });
      setDraftId(result.draftId);
      setSubmitted(status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save this resource.");
    } finally {
      setSaving(false);
    }
  };

  if (authState === "loading" || (authState === "authenticated" && bootstrap.isLoading)) {
    return <div className="min-h-screen bg-background"><Navbar /><main className="mx-auto max-w-2xl px-4 py-20 text-center text-sm text-muted-foreground">Checking contributor access…</main></div>;
  }
  if (bootstrap.isError) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="font-display text-2xl font-bold text-navy">Kendala Memuat Akses Kontributor</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {bootstrap.error instanceof Error ? bootstrap.error.message : "Terjadi kesalahan saat memeriksa akun kontributor Anda."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/auth"
              search={{ mode: "signin", redirect: "/knowledge-hub/submit-resource" }}
              className="inline-flex rounded-xl bg-marine px-5 py-2.5 text-xs font-bold text-white hover:bg-navy"
            >
              Masuk Kembali
            </Link>
            <Link
              to="/knowledge-hub"
              className="inline-flex rounded-xl border border-border px-5 py-2.5 text-xs font-bold text-navy hover:bg-muted"
            >
              Ke Knowledge Hub
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-eco-community/15 text-eco-community">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-extrabold text-navy">
            {submitted === "draft" ? "Draft saved" : "Resource submitted"}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            {submitted === "draft"
              ? "Your resource has been saved as a draft. You can finish and submit it any time from My Contributions."
              : "Thank you for contributing! Your resource is now in the review pipeline: Submitted → Under Review → Published. Track its progress in My Contributions."}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              to="/knowledge-hub/my-contributions"
              className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
            >
              View My Contributions <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/knowledge-hub"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-navy transition-colors hover:bg-muted"
            >
              Back to Knowledge Hub
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          to="/knowledge-hub"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-marine transition-colors hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> Knowledge Hub
        </Link>

        <div className="mt-4">
          <h1 className="font-display text-3xl font-extrabold text-navy">Submit a Resource</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Share your knowledge, publications, learning materials, and best practices with the
            global marine and fisheries community.
          </p>
        </div>

        {/* Stepper */}
        <div className="mt-7 flex flex-wrap items-center gap-y-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
          {STEPS.map((s, i) => {
            const active = s.n === step;
            const done = s.n < step;
            return (
              <div key={s.n} className="flex items-center">
                <button
                  type="button"
                  onClick={() => s.n < step && setStep(s.n)}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                    done ? "cursor-pointer hover:bg-muted" : "cursor-default"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      active
                        ? "bg-marine text-marine-foreground"
                        : done
                          ? "bg-eco-community text-navy-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : s.n}
                  </span>
                  <span
                    className={`hidden text-xs font-semibold sm:block ${
                      active ? "text-navy" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <span className="mx-1 h-px w-4 bg-border sm:w-6" aria-hidden />
                )}
              </div>
            );
          })}
        </div>

        {isReadOnly && (
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50/90 px-4 py-3 text-xs text-blue-900">
            <strong className="font-bold block mb-0.5">Mode Pratinjau Pengajuan (Baca-Saja)</strong>
            Naskah ini telah dikirimkan ke kurator dan sedang dalam proses peninjauan atau telah disetujui. Anda dapat mengedit kembali apabila kurator meminta revisi.
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
          {step === 1 && <StepType form={form} set={set} isTrainer={bootstrap.data?.isTrainer} />}
          {step === 2 && <StepInfo form={form} set={set} />}
          {step === 3 && <StepFile form={form} set={set} />}
          {step === 4 && <StepAccess form={form} set={set} />}
          {step === 5 && <StepReview form={form} />}

          {error && (
            <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-muted"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {isReadOnly ? (
                <Link
                  to="/knowledge-hub/my-contributions"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
                >
                  Kembali ke My Contributions <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void persist("draft")}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-marine px-4 py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                  >
                    Save Draft
                  </button>
                  {step < 5 ? (
                    <button
                      type="button"
                      onClick={goNext}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
                    >
                      Continue <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void persist("submitted")}
                      disabled={!form.declaration || saving}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
                    >
                      Submit Resource <Check className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Step components ──────────────────────────────────────────────────────────
type SetFn = <K extends keyof ResourceDraft>(key: K, value: ResourceDraft[K]) => void;

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
      {children}
      {required && <span className="text-destructive"> *</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-marine focus:ring-1 focus:ring-marine";

function StepType({ form, set, isTrainer }: { form: ResourceDraft; set: SetFn; isTrainer?: boolean }) {
  const navigate = useNavigate();
  return (
    <div>
      <h2 className="font-display text-lg font-bold text-navy">Step 1 — Resource Type</h2>
      <p className="mt-1 text-sm text-muted-foreground">Choose the category that best fits your resource.</p>
      <div className="mt-5 space-y-6">
        {RESOURCE_TYPE_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 text-sm font-bold text-navy">{group.label}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {group.types.map((t) => {
                const active = form.type === t;
                const isModule = t === "Training Module";
                const disabled = isModule && !isTrainer;
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      if (isModule) {
                        navigate({ to: "/experts/portal/submit-module" });
                        return;
                      }
                      set("type", t);
                    }}
                    title={
                      disabled
                        ? "Pengajuan Modul Pembelajaran membutuhkan kualifikasi Trainer/Pakar resmi"
                        : isModule
                          ? "Akan diarahkan ke Portal Pengajuan Modul Pembelajaran (7 Dokumen Standar)"
                          : undefined
                    }
                    className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all ${
                      disabled
                        ? "opacity-60 bg-muted/50 border-dashed border-border cursor-not-allowed text-muted-foreground"
                        : active
                          ? "border-marine bg-marine/10 text-marine"
                          : "border-border text-foreground/80 hover:border-marine/40 hover:bg-muted"
                    }`}
                  >
                    {active && <Check className="mb-1 h-4 w-4" />}
                    <div className="flex items-center justify-between gap-1">
                      <span>{t}</span>
                      {isModule && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isTrainer
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isTrainer ? "Portal Modul →" : "Khusus Trainer"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepInfo({ form, set }: { form: ResourceDraft; set: SetFn }) {
  return (
    <div>
      <h2 className="font-display text-lg font-bold text-navy">Step 2 — Resource Information</h2>
      <p className="mt-1 text-sm text-muted-foreground">Tell the community about your resource.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldLabel required>Title</FieldLabel>
          <input className={inputClass} value={form.title} maxLength={160} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Tilapia Farming Manual" />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel required>Description</FieldLabel>
          <textarea className={`${inputClass} min-h-[110px] resize-y`} value={form.description} maxLength={1500} onChange={(e) => set("description", e.target.value)} placeholder="Summarise what the resource covers and who it is for." />
        </div>
        <div>
          <FieldLabel required>Author</FieldLabel>
          <input className={inputClass} value={form.author} maxLength={120} onChange={(e) => set("author", e.target.value)} />
        </div>
        <div>
          <FieldLabel required>Institution</FieldLabel>
          <input className={inputClass} value={form.institution} maxLength={120} onChange={(e) => set("institution", e.target.value)} />
        </div>
        <div>
          <FieldLabel required>Country</FieldLabel>
          <input className={inputClass} value={form.country} maxLength={80} onChange={(e) => set("country", e.target.value)} placeholder="Your country" />
        </div>
        <div>
          <FieldLabel required>Year</FieldLabel>
          <input className={inputClass} type="number" min={1980} max={2100} value={form.year} onChange={(e) => set("year", e.target.value)} />
        </div>
        <div>
          <FieldLabel required>Language</FieldLabel>
          <select className={inputClass} value={form.language} onChange={(e) => set("language", e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel required>Resource Category</FieldLabel>
          <input className={`${inputClass} bg-muted/50`} value={form.type ? `${form.type} · ${groupForType(form.type)}` : ""} readOnly placeholder="Selected in Step 1" />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel required>Keywords</FieldLabel>
          <input className={inputClass} value={form.keywords} maxLength={200} onChange={(e) => set("keywords", e.target.value)} placeholder="Comma-separated, e.g. tilapia, hatchery, biofloc" />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel required>Topic Category</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {TOPIC_CATEGORIES.map((t) => {
              const active = form.topicCategory === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("topicCategory", t)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active ? "bg-marine text-marine-foreground" : "bg-muted text-foreground/75 hover:bg-marine/15 hover:text-marine"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {form.type === "Best Practice" && (
        <BestPracticeStructureForm
          value={form.practiceStructure}
          onChange={(next) => set("practiceStructure", next)}
        />
      )}
    </div>
  );
}

function StepFile({ form, set }: { form: ResourceDraft; set: SetFn }) {
  const createUpload = useServerFn(createKnowledgeResourceUpload);
  const inputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [progress, setProgress] = useState<number | null>(null);
  const [coverProgress, setCoverProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [coverErr, setCoverErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [coverDragging, setCoverDragging] = useState(false);

  const handleCoverFile = async (file: File | null) => {
    if (!file) return;
    setCoverErr(null);

    if (!file.type.startsWith("image/")) {
      setCoverErr("Hanya file gambar (JPG, PNG, WEBP) yang diperbolehkan untuk foto banner.");
      return;
    }

    // 2 MB max per AGENTS.md rule 6
    const MAX_COVER_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_COVER_BYTES) {
      setCoverErr("Ukuran foto banner maksimal 2 MB.");
      return;
    }

    setCoverProgress(20);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setCoverErr("Silakan masuk terlebih dahulu sebelum mengunggah banner.");
        setCoverProgress(null);
        return;
      }

      const upload = await createUpload({
        data: {
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
          size: file.size,
        },
      });

      const storagePath = upload.path;
      setCoverProgress(60);

      const { error: uploadError } = await supabase.storage
        .from("knowledge-resource-submissions")
        .uploadToSignedUrl(storagePath, upload.token, file, {
          contentType: file.type || "image/jpeg",
        });

      if (uploadError) {
        setCoverErr(uploadError.message);
        setCoverProgress(null);
        return;
      }

      setCoverProgress(100);
      const previewUrl = URL.createObjectURL(file);

      set("coverFile", {
        name: file.name,
        size: file.size,
        type: file.type || "image/jpeg",
        uploadedAt: new Date().toISOString(),
        storagePath,
        previewUrl,
      });

      setTimeout(() => setCoverProgress(null), 250);
    } catch (cause) {
      setCoverErr(cause instanceof Error ? cause.message : "Terjadi kendala saat mengunggah foto banner.");
      setCoverProgress(null);
    }
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setErr(null);

    const name = file.name.toLowerCase();
    const isPdf = name.endsWith(".pdf");
    const isPpt = name.endsWith(".ppt") || name.endsWith(".pptx");
    const isImg = file.type.startsWith("image/");

    // Validation per AGENTS.md rule 6: PDFs <= 10MB, PPT <= 25MB, Images <= 2MB
    if (isPdf && file.size > 10 * 1024 * 1024) {
      setErr("Ukuran file PDF maksimal 10 MB.");
      return;
    }
    if (isPpt && file.size > 25 * 1024 * 1024) {
      setErr("Ukuran file presentasi (PPT/PPTX) maksimal 25 MB.");
      return;
    }
    if (isImg && file.size > 2 * 1024 * 1024) {
      setErr("Ukuran file gambar dokumen maksimal 2 MB.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setErr("File terlalu besar (maksimal 50 MB).");
      return;
    }

    setProgress(15);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setErr("Please sign in before uploading a file.");
        setProgress(null);
        return;
      }
      const upload = await createUpload({
        data: {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        },
      });
      const storagePath = upload.path;
      setProgress(50);
      const { error: uploadError } = await supabase.storage
        .from("knowledge-resource-submissions")
        .uploadToSignedUrl(storagePath, upload.token, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (uploadError) {
        setErr(uploadError.message);
        setProgress(null);
        return;
      }
      setProgress(100);
      set("file", {
        name: file.name,
        size: file.size,
        type: file.type || "file",
        uploadedAt: new Date().toISOString(),
        storagePath,
      });
      setTimeout(() => setProgress(null), 250);
    } catch (cause) {
      setErr(cause instanceof Error ? cause.message : "Terjadi kendala saat mengunggah dokumen.");
      setProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-navy">Step 3 — Upload Berkas & Media</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Unggah dokumen materi publikasi dan foto banner sampul untuk katalog Knowledge Hub.
        </p>
      </div>

      {/* ── Section A: Foto Sampul / Banner (Cover Image) ── */}
      <div className="rounded-2xl border border-border bg-slate-50/60 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-navy flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4 text-marine" />
              Foto Sampul / Banner (Opsional)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tampil sebagai latar belakang banner halaman publikasi dan kartu katalog. Rekomendasi rasio 16:9 (contoh: 1200x675 px), maks 2 MB.
            </p>
          </div>
          {form.coverFile && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Banner Terpasang
            </span>
          )}
        </div>

        {form.coverFile ? (
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div className="relative h-44 sm:h-52 w-full bg-slate-900/10 overflow-hidden">
              <img
                src={form.coverFile.previewUrl || form.coverFile.storagePath}
                alt="Banner Preview"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/80 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 text-white pointer-events-none">
                <p className="text-xs font-bold truncate max-w-sm">{form.coverFile.name}</p>
                <p className="text-[10px] text-white/80">{formatBytes(form.coverFile.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => set("coverFile", null)}
                className="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-navy/80 text-white shadow-md hover:bg-destructive transition"
                title="Hapus foto banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setCoverDragging(true); }}
            onDragLeave={() => setCoverDragging(false)}
            onDrop={(e) => { e.preventDefault(); setCoverDragging(false); void handleCoverFile(e.dataTransfer.files?.[0] ?? null); }}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors bg-white ${
              coverDragging ? "border-marine bg-marine/5" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            {coverProgress !== null ? (
              <div className="py-2">
                <p className="text-xs font-semibold text-navy">Mengunggah banner… {coverProgress}%</p>
                <div className="mx-auto mt-2 h-1.5 w-48 max-w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-marine transition-all" style={{ width: `${coverProgress}%` }} />
                </div>
              </div>
            ) : (
              <>
                <ImageIcon className="mx-auto h-7 w-7 text-marine/80" />
                <p className="mt-2 text-xs font-semibold text-navy">Tarik & lepas foto banner di sini, atau</p>
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-marine/40 bg-white px-3 py-1.5 text-xs font-semibold text-marine hover:bg-marine hover:text-white transition"
                >
                  <Upload className="h-3.5 w-3.5" /> Pilih Foto Banner
                </button>
                <p className="mt-2 text-[11px] text-muted-foreground">Format JPG, PNG, WEBP · Maksimal 2 MB (opsional, jika kosong menggunakan default)</p>
              </>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void handleCoverFile(e.target.files?.[0] ?? null)}
            />
          </div>
        )}
        {coverErr && <p className="text-xs font-medium text-destructive">{coverErr}</p>}
      </div>

      {/* ── Section B: Dokumen Materi Utama (File Upload) ── */}
      <div className="space-y-2">
        <FieldLabel>Dokumen Materi Publikasi</FieldLabel>
        <p className="text-xs text-muted-foreground">
          Unggah naskah lengkap (PDF maks 10MB, PPT/PPTX maks 25MB, DOC, XLS, MP4).
        </p>

        {form.file ? (
          <div className="flex items-center gap-3 rounded-xl border border-eco-community/40 bg-eco-community/5 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-eco-community/15 text-eco-community">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-navy">{form.file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(form.file.size)} · Siap Dikirim</p>
            </div>
            <button
              type="button"
              onClick={() => set("file", null)}
              aria-label="Remove file"
              className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files?.[0] ?? null); }}
            className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging ? "border-marine bg-marine/5" : "border-border"
            }`}
          >
            {progress !== null ? (
              <div>
                <p className="text-sm font-semibold text-navy">Mengunggah berkas… {progress}%</p>
                <div className="mx-auto mt-3 h-2 w-64 max-w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-marine transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-8 w-8 text-marine" />
                <p className="mt-3 text-sm font-semibold text-navy">Tarik & lepas dokumen utama di sini</p>
                <p className="text-xs text-muted-foreground">atau</p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-2 rounded-lg border border-marine px-4 py-2 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                >
                  Pilih Dokumen
                </button>
                <p className="mt-3 text-xs text-muted-foreground">PDF (≤10MB), PPT/PPTX (≤25MB), DOC, XLS, MP4</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
            />
          </div>
        )}
        {err && <p className="text-sm font-medium text-destructive">{err}</p>}
      </div>

      {/* ── Section C: Tautan Eksternal (Opsional) ── */}
      <div>
        <FieldLabel>Tautan Eksternal / Repositori Online (Opsional)</FieldLabel>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <input
            className="w-full bg-transparent py-2.5 text-sm outline-none"
            value={form.externalUrl}
            onChange={(e) => set("externalUrl", e.target.value)}
            placeholder="https://doi.org/… atau https://…"
          />
        </div>
      </div>
    </div>
  );
}

function StepAccess({ form, set }: { form: ResourceDraft; set: SetFn }) {
  return (
    <div>
      <h2 className="font-display text-lg font-bold text-navy">Step 4 — Access &amp; License</h2>
      <p className="mt-1 text-sm text-muted-foreground">Set who can access this resource.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {ACCESS_LEVELS.map((level) => {
          const active = form.accessLevel === level;
          return (
            <button
              key={level}
              type="button"
              onClick={() => set("accessLevel", level as AccessLevel)}
              className={`rounded-xl border p-4 text-left transition-all ${
                active ? "border-marine bg-marine/10" : "border-border hover:border-marine/40 hover:bg-muted"
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${active ? "border-marine bg-marine text-marine-foreground" : "border-muted-foreground/40"}`}>
                {active && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className="mt-2 block text-sm font-bold text-navy">{level}</span>
            </button>
          );
        })}
      </div>

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
        <input type="checkbox" checked={form.declaration} onChange={(e) => set("declaration", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[hsl(var(--marine))]" />
        <span className="text-sm text-foreground/85">
          I confirm that I own the rights to this material or have permission to share it.
        </span>
      </label>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2">
      <span className="w-40 shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground/90">{value || <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

function StepReview({ form }: { form: ResourceDraft }) {
  return (
    <div>
      <h2 className="font-display text-lg font-bold text-navy">Step 5 — Review &amp; Submit</h2>
      <p className="mt-1 text-sm text-muted-foreground">Check your details before submitting.</p>
      <div className="mt-5 divide-y divide-border rounded-xl border border-border p-4">
        <Row label="Resource Type" value={form.type ? `${form.type} · ${groupForType(form.type)}` : ""} />
        <Row label="Title" value={form.title} />
        <Row label="Description" value={form.description} />
        <Row label="Author" value={form.author} />
        <Row label="Institution" value={form.institution} />
        <Row label="Country" value={form.country} />
        <Row label="Year" value={form.year} />
        <Row label="Language" value={form.language} />
        <Row label="Keywords" value={form.keywords} />
        <Row label="Topic Category" value={form.topicCategory} />
        <Row
          label="Foto Banner"
          value={
            form.coverFile ? (
              <div className="flex items-center gap-3">
                {form.coverFile.previewUrl && (
                  <img
                    src={form.coverFile.previewUrl}
                    alt="Cover preview"
                    className="h-10 w-16 rounded object-cover border border-slate-200"
                  />
                )}
                <span>{form.coverFile.name} ({formatBytes(form.coverFile.size)})</span>
              </div>
            ) : (
              <span className="text-muted-foreground italic">Banner Bawaan (Default BARUNA)</span>
            )
          }
        />
        <Row label="File Dokumen" value={form.file ? `${form.file.name} (${formatBytes(form.file.size)})` : form.externalUrl || ""} />
        <Row label="Access Level" value={form.accessLevel} />
        <Row label="Declaration" value={form.declaration ? "Confirmed" : "Not confirmed"} />
      </div>
      {form.type === "Best Practice" && (
        <div className="mt-4">
          <BestPracticeStructurePreview value={form.practiceStructure} />
        </div>
      )}
      {!form.declaration && (
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-destructive">
          <Globe className="h-4 w-4" /> Please confirm the rights declaration in Step 4 before submitting.
        </p>
      )}
    </div>
  );
}
