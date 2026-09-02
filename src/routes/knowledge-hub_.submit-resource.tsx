import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
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
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import {
  RESOURCE_TYPE_GROUPS,
  TOPIC_CATEGORIES,
  LANGUAGES,
  ACCESS_LEVELS,
  ACCEPTED_FILE_TYPES,
  emptyResourceDraft,
  createResource,
  updateResource,
  getResource,
  formatBytes,
  groupForType,
  type ResourceDraft,
  type AccessLevel,
} from "@/lib/resources";

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
  validateSearch: (s: Record<string, unknown>): { edit?: string } => ({
    edit: typeof s.edit === "string" ? s.edit : undefined,
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
  const { edit } = useSearch({ from: Route.id });
  const existing = useMemo(() => (edit ? getResource(edit) : undefined), [edit]);

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
          externalUrl: existing.externalUrl,
          accessLevel: existing.accessLevel,
          declaration: existing.declaration,
        }
      : { ...emptyResourceDraft },
  );
  const [submitted, setSubmitted] = useState<null | "draft" | "submitted">(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ResourceDraft>(key: K, value: ResourceDraft[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canNext = useMemo(() => {
    if (step === 1) return !!form.type;
    if (step === 2)
      return (
        form.title.trim() &&
        form.description.trim() &&
        form.author.trim() &&
        form.institution.trim() &&
        form.country.trim() &&
        form.year.trim() &&
        form.language.trim() &&
        form.keywords.trim() &&
        form.topicCategory.trim()
      );
    if (step === 3) return !!form.file || !!form.externalUrl.trim();
    if (step === 4) return form.declaration;
    return true;
  }, [step, form]);

  const goNext = () => {
    if (!canNext) {
      setError("Please complete the required fields before continuing.");
      return;
    }
    setError(null);
    setStep((s) => Math.min(5, s + 1));
  };
  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const persist = (status: "draft" | "submitted") => {
    const draft = { ...form, typeGroup: groupForType(form.type) };
    if (existing) {
      updateResource(existing.id, {
        ...draft,
        status: status === "draft" ? "Draft" : "Submitted",
      });
    } else {
      createResource(draft, status === "draft" ? "Draft" : "Submitted");
    }
    setSubmitted(status);
  };

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

        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
          {step === 1 && <StepType form={form} set={set} />}
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
              <button
                type="button"
                onClick={() => persist("draft")}
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
                  onClick={() => persist("submitted")}
                  disabled={!form.declaration}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
                >
                  Submit Resource <Check className="h-4 w-4" />
                </button>
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

function StepType({ form, set }: { form: ResourceDraft; set: SetFn }) {
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
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("type", t)}
                    className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all ${
                      active
                        ? "border-marine bg-marine/10 text-marine"
                        : "border-border text-foreground/80 hover:border-marine/40 hover:bg-muted"
                    }`}
                  >
                    {active && <Check className="mb-1 h-4 w-4" />}
                    {t}
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
    </div>
  );
}

function StepFile({ form, set }: { form: ResourceDraft; set: SetFn }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File | null) => {
    if (!file) return;
    setErr(null);
    if (file.size > MAX_BYTES) {
      setErr("File is too large (max 50 MB).");
      return;
    }
    setProgress(0);
    let pct = 0;
    const timer = setInterval(() => {
      pct += Math.random() * 20 + 8;
      if (pct >= 100) {
        clearInterval(timer);
        setProgress(100);
        setTimeout(() => {
          setProgress(null);
          set("file", { name: file.name, size: file.size, type: file.type || "file", uploadedAt: new Date().toISOString() });
        }, 250);
      } else {
        setProgress(Math.round(pct));
      }
    }, 120);
  };

  return (
    <div>
      <h2 className="font-display text-lg font-bold text-navy">Step 3 — File Upload</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload your file (PDF, PPT, DOC, XLS, MP4, image) or provide an external URL.
      </p>

      {form.file ? (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-eco-community/40 bg-eco-community/5 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-eco-community/15 text-eco-community">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-navy">{form.file.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(form.file.size)} · Uploaded</p>
          </div>
          <button type="button" onClick={() => set("file", null)} aria-label="Remove file" className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0] ?? null); }}
          className={`mt-5 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragging ? "border-marine bg-marine/5" : "border-border"
          }`}
        >
          {progress !== null ? (
            <div>
              <p className="text-sm font-semibold text-navy">Uploading… {progress}%</p>
              <div className="mx-auto mt-3 h-2 w-64 max-w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-marine transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <>
              <Upload className="mx-auto h-8 w-8 text-marine" />
              <p className="mt-3 text-sm font-semibold text-navy">Drag & drop your file here</p>
              <p className="text-xs text-muted-foreground">or</p>
              <button type="button" onClick={() => inputRef.current?.click()} className="mt-2 rounded-lg border border-marine px-4 py-2 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground">
                Choose File
              </button>
              <p className="mt-3 text-xs text-muted-foreground">PDF, PPT/PPTX, DOC/DOCX, XLS/XLSX, MP4, images · max 50 MB</p>
            </>
          )}
          <input ref={inputRef} type="file" accept={ACCEPTED_FILE_TYPES} className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
        </div>
      )}
      {err && <p className="mt-3 text-sm font-medium text-destructive">{err}</p>}

      <div className="mt-5">
        <FieldLabel>External URL (optional)</FieldLabel>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <input className="w-full bg-transparent py-2.5 text-sm outline-none" value={form.externalUrl} onChange={(e) => set("externalUrl", e.target.value)} placeholder="https://…" />
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
        <Row label="File" value={form.file ? `${form.file.name} (${formatBytes(form.file.size)})` : form.externalUrl || ""} />
        <Row label="Access Level" value={form.accessLevel} />
        <Row label="Declaration" value={form.declaration ? "Confirmed" : "Not confirmed"} />
      </div>
      {!form.declaration && (
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-destructive">
          <Globe className="h-4 w-4" /> Please confirm the rights declaration in Step 4 before submitting.
        </p>
      )}
    </div>
  );
}
