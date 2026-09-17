import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  User,
  Layers,
  ClipboardCheck,
  BookOpen,
  Upload,
  FileText,
  X,
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import { supabase } from "@/integrations/supabase/client";
import {
  getExpertApplicationBootstrap,
  saveExpertApplicationDraft,
  submitExpertApplication,
} from "@/lib/experts/application.functions";
import {
  EXPERT_APPLICATION_BUCKET,
  type ExpertApplicationDocument,
  type ExpertDocumentCategory,
} from "@/lib/experts/application.types";
import {
  EXPERTISE_AREAS,
  EXPERT_ROLES,
  EXPERT_PIPELINE,
  MAX_BYTES,
  emptyExpertApplication,
  formatBytes,
  type ExpertApplicationDraft,
  type ExpertRole,
} from "@/lib/experts";

const EXPERT_APPLICATION_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp";

export const Route = createFileRoute("/experts/join")({
  head: () => ({
    meta: [
      { title: "Join as an Expert — BARUNA Experts" },
      {
        name: "description",
        content:
          "Register as a marine and fisheries expert and contribute to the BARUNA global expert network.",
      },
      { property: "og:title", content: "Join as an Expert — BARUNA Experts" },
      {
        property: "og:description",
        content: "Become a speaker, trainer, reviewer, mentor, or technical expert with BARUNA.",
      },
    ],
    links: [{ rel: "canonical", href: "/experts/join" }],
  }),
  component: JoinExpertPage,
});

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-marine focus:ring-1 focus:ring-marine";

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

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
      {children}
      {required && <span className="text-destructive"> *</span>}
    </label>
  );
}

function JoinExpertPage() {
  const navigate = useNavigate();
  const bootstrapFn = useServerFn(getExpertApplicationBootstrap);
  const saveDraftFn = useServerFn(saveExpertApplicationDraft);
  const submitFn = useServerFn(submitExpertApplication);
  const [form, setForm] = useState<ExpertApplicationDraft>({ ...emptyExpertApplication });
  const [submitted, setSubmitted] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draftId, setDraftId] = useState<string | undefined>();
  const [userId, setUserId] = useState("");
  const [documents, setDocuments] = useState<ExpertApplicationDocument[]>([]);
  const [files, setFiles] = useState<Partial<Record<ExpertDocumentCategory, File>>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (!data.user) {
        navigate({
          to: "/auth",
          search: { mode: "signin", redirect: "/experts/join" },
          replace: true,
        });
        return;
      }
      try {
        const bootstrap = await bootstrapFn();
        if (!active) return;
        setUserId(bootstrap.userId);
        if (bootstrap.editableDraft) {
          const payload = bootstrap.editableDraft.payload;
          setDraftId(bootstrap.editableDraft.draftId);
          setDocuments(payload.documents ?? []);
          setForm({ ...emptyExpertApplication, ...payload });
          setNotice("Your existing draft has been restored.");
        } else {
          setForm((current) => ({
            ...current,
            fullName: bootstrap.profile.fullName,
            email: bootstrap.profile.email,
            institution: bootstrap.profile.institution,
            title: bootstrap.profile.title,
            phone: bootstrap.profile.phone,
          }));
        }
        setReady(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load your account profile.");
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, [bootstrapFn, navigate]);

  const set = <K extends keyof ExpertApplicationDraft>(key: K, value: ExpertApplicationDraft[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleExpertise = (area: string) =>
    setForm((f) => ({
      ...f,
      expertise: f.expertise.includes(area)
        ? f.expertise.filter((x) => x !== area)
        : [...f.expertise, area],
    }));

  const toggleRole = (role: ExpertRole) =>
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((x) => x !== role) : [...f.roles, role],
    }));

  const validate = () => {
    if (
      !form.fullName.trim() ||
      !form.title.trim() ||
      !form.institution.trim() ||
      !form.country.trim() ||
      !form.email.trim()
    ) {
      setError("Please complete the required personal information fields.");
      return false;
    }
    if (form.expertise.length === 0) {
      setError("Please select at least one area of expertise.");
      return false;
    }
    if (form.roles.length === 0) {
      setError("Please select at least one available role.");
      return false;
    }
    if (!form.biography.trim()) {
      setError("Please provide a professional biography.");
      return false;
    }
    return true;
  };

  const uploadSelectedFiles = async (id: string) => {
    const uploaded = [...documents];
    for (const [category, file] of Object.entries(files) as [ExpertDocumentCategory, File][]) {
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
      const path = `users/${userId}/${id}/${category}-${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(EXPERT_APPLICATION_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const document: ExpertApplicationDocument = {
        category,
        path,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
      };
      const existingIndex = uploaded.findIndex((item) => item.category === category);
      if (existingIndex >= 0) uploaded[existingIndex] = document;
      else uploaded.push(document);
    }
    setDocuments(uploaded);
    setFiles({});
    return uploaded;
  };

  const persist = async (shouldSubmit: boolean) => {
    if (shouldSubmit && !validate()) return;
    if (!form.fullName.trim()) {
      setError("Full name is required before saving a draft.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const initial = await saveDraftFn({
        data: {
          draftId,
          displayName: form.fullName,
          payload: { ...form, documents, schemaVersion: 1 },
        },
      });
      setDraftId(initial.draftId);
      const uploaded = await uploadSelectedFiles(initial.draftId);
      await saveDraftFn({
        data: {
          draftId: initial.draftId,
          displayName: form.fullName,
          payload: { ...form, documents: uploaded, schemaVersion: 1 },
        },
      });
      if (shouldSubmit) {
        await submitFn({ data: { draftId: initial.draftId } });
        setSubmitted(true);
      } else {
        setNotice("Draft saved securely to your BARUNA account.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the application.");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-16 text-sm text-muted-foreground sm:px-6">
          Loading your expert application…
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
            Application submitted
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Thank you for applying to the BARUNA Expert Network. Your application now follows the
            approval workflow: Applied → Under Review → Approved Expert → Published. Only approved
            experts appear in the public directory.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              to="/experts/profile"
              className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
            >
              View My Expert Profile <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/experts"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-navy transition-colors hover:bg-muted"
            >
              Back to Experts
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
          to="/experts"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-marine transition-colors hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> Experts
        </Link>

        <div className="mt-4">
          <h1 className="font-display text-3xl font-extrabold text-navy">Join as an Expert</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Register your profile to share knowledge, build capacity, and create impact as part of
            the BARUNA global marine and fisheries expert network.
          </p>
        </div>

        {/* Approval workflow */}
        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4 text-xs shadow-soft">
          <span className="font-bold uppercase tracking-wide text-muted-foreground">Approval:</span>
          {EXPERT_PIPELINE.map((stage, i) => (
            <div key={stage} className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-3 py-1 font-semibold text-foreground/70">
                {stage}
              </span>
              {i < EXPERT_PIPELINE.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-5">
          <SectionCard icon={User} n={1} title="Personal Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel required>Full Name</FieldLabel>
                <input
                  className={inputClass}
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                />
              </div>
              <div>
                <FieldLabel required>Professional Title</FieldLabel>
                <input
                  className={inputClass}
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                />
              </div>
              <div>
                <FieldLabel required>Institution</FieldLabel>
                <input
                  className={inputClass}
                  value={form.institution}
                  onChange={(e) => set("institution", e.target.value)}
                />
              </div>
              <div>
                <FieldLabel required>Country</FieldLabel>
                <input
                  className={inputClass}
                  value={form.country}
                  onChange={(e) => set("country", e.target.value)}
                />
              </div>
              <div>
                <FieldLabel required>Email</FieldLabel>
                <input
                  className={inputClass}
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Phone Number</FieldLabel>
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>LinkedIn</FieldLabel>
                <input
                  className={inputClass}
                  value={form.linkedin}
                  onChange={(e) => set("linkedin", e.target.value)}
                  placeholder="https://linkedin.com/in/…"
                />
              </div>
              <div>
                <FieldLabel>Personal Website</FieldLabel>
                <input
                  className={inputClass}
                  value={form.website}
                  onChange={(e) => set("website", e.target.value)}
                  placeholder="https://…"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={Layers} n={2} title="Areas of Expertise">
            <p className="mb-3 text-sm text-muted-foreground">Select all that apply.</p>
            <div className="flex flex-wrap gap-2">
              {EXPERTISE_AREAS.map((area) => {
                const active = form.expertise.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleExpertise(area)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? "bg-marine text-marine-foreground"
                        : "bg-muted text-foreground/75 hover:bg-marine/15 hover:text-marine"
                    }`}
                  >
                    {active && <Check className="mr-1 inline h-3 w-3" />}
                    {area}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard icon={ClipboardCheck} n={3} title="Available Roles">
            <p className="mb-3 text-sm text-muted-foreground">You may select multiple roles.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {EXPERT_ROLES.map((role) => {
                const active = form.roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-semibold transition-all ${
                      active
                        ? "border-marine bg-marine/10 text-marine"
                        : "border-border text-foreground/80 hover:border-marine/40 hover:bg-muted"
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 place-items-center rounded border ${
                        active
                          ? "border-marine bg-marine text-marine-foreground"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {active && <Check className="h-3.5 w-3.5" />}
                    </span>
                    {role}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard icon={BookOpen} n={4} title="Professional Profile">
            <div className="grid gap-4">
              <div>
                <FieldLabel required>Professional Biography</FieldLabel>
                <textarea
                  className={`${inputClass} min-h-[120px] resize-y`}
                  value={form.biography}
                  maxLength={2500}
                  onChange={(e) => set("biography", e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Years of Experience</FieldLabel>
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    value={form.yearsExperience}
                    onChange={(e) => set("yearsExperience", e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel>Languages Spoken</FieldLabel>
                  <input
                    className={inputClass}
                    value={form.languages}
                    onChange={(e) => set("languages", e.target.value)}
                    placeholder="e.g. English, French"
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Key Projects</FieldLabel>
                <textarea
                  className={`${inputClass} min-h-[80px] resize-y`}
                  value={form.keyProjects}
                  onChange={(e) => set("keyProjects", e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Publications</FieldLabel>
                <textarea
                  className={`${inputClass} min-h-[80px] resize-y`}
                  value={form.publications}
                  onChange={(e) => set("publications", e.target.value)}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={Upload} n={5} title="Upload Documents">
            <div className="grid gap-4 sm:grid-cols-2">
              <FileUpload
                label="CV / Resume"
                file={files.cv ?? null}
                stored={documents.find((item) => item.category === "cv") ?? null}
                onFile={(file) => setFiles((current) => ({ ...current, cv: file ?? undefined }))}
              />
              <FileUpload
                label="Professional Photo"
                file={files.photo ?? null}
                stored={documents.find((item) => item.category === "photo") ?? null}
                onFile={(file) => setFiles((current) => ({ ...current, photo: file ?? undefined }))}
              />
              <FileUpload
                label="Certifications"
                file={files.certifications ?? null}
                stored={documents.find((item) => item.category === "certifications") ?? null}
                onFile={(file) =>
                  setFiles((current) => ({ ...current, certifications: file ?? undefined }))
                }
              />
              <FileUpload
                label="Supporting Documents"
                file={files.supporting ?? null}
                stored={documents.find((item) => item.category === "supporting") ?? null}
                onFile={(file) =>
                  setFiles((current) => ({ ...current, supporting: file ?? undefined }))
                }
              />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Files are stored in a private bucket and are visible only to you and authorized BARUNA
              reviewers.
            </p>
          </SectionCard>

          {notice && (
            <p className="rounded-lg bg-eco-community/10 px-4 py-2.5 text-sm font-medium text-eco-community">
              {notice}
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <Link
              to="/experts"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-navy transition-colors hover:bg-muted"
            >
              Cancel
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => void persist(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-marine px-6 py-3 text-sm font-semibold text-marine transition-colors hover:bg-marine/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save Draft"} <FileText className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void persist(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
            >
              {busy ? "Submitting…" : "Submit Application"} <Check className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function FileUpload({
  label,
  file,
  stored,
  onFile,
}: {
  label: string;
  file: File | null;
  stored: ExpertApplicationDocument | null;
  onFile: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  const handle = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setErr("File is too large (max 50 MB).");
      return;
    }
    setErr(null);
    onFile(f);
  };

  const shown = file
    ? { name: file.name, size: file.size }
    : stored
      ? { name: stored.name, size: stored.size }
      : null;

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {shown ? (
        <div className="flex items-center gap-3 rounded-xl border border-eco-community/40 bg-eco-community/5 p-3">
          <FileText className="h-5 w-5 shrink-0 text-eco-community" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-navy">{shown.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(shown.size)}</p>
          </div>
          {file ? (
            <button
              type="button"
              onClick={() => onFile(null)}
              aria-label="Remove file"
              className="grid h-7 w-7 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="text-[0.65rem] font-semibold uppercase text-eco-community">
              Stored
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-3 py-3 text-sm font-semibold text-marine transition-colors hover:border-marine/50 hover:bg-muted"
        >
          <Upload className="h-4 w-4" /> Upload {label}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={EXPERT_APPLICATION_ACCEPT}
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0] ?? null)}
      />
      {err && <p className="mt-1 text-xs font-medium text-destructive">{err}</p>}
    </div>
  );
}
