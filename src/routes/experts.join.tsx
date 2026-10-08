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
  RotateCcw,
  ExternalLink,
  X,
  Bookmark,
  Eye,
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import { AlreadyExpertNotice } from "@/components/baruna/experts/AlreadyExpertNotice";
import { ApplicationPendingNotice } from "@/components/baruna/experts/ApplicationPendingNotice";
import { ProfessionalProfileSection } from "@/components/baruna/experts/ProfessionalProfileSection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getExpertApplicationBootstrap,
  saveExpertApplicationDraft,
  submitExpertApplication,
  resubmitExpertApplicationRevision,
} from "@/lib/experts/application.functions";
import {
  EXPERT_APPLICATION_BUCKET,
  type ExpertApplicationBootstrap,
  type ExpertApplicationDocument,
  type ExpertDocumentCategory,
} from "@/lib/experts/application.types";
import { resolveFileContentType } from "@/lib/storage/mime";
import {
  EXPERTISE_AREAS,
  EXPERT_ROLES,
  PROFESSIONAL_TITLE_OPTIONS,
  CUSTOM_PROFESSIONAL_TITLE_VALUE,
  EXPERT_PIPELINE,
  MAX_BYTES,
  emptyExpertApplication,
  formatBytes,
  genId,
  type ExpertApplicationDraft,
  type ExpertRole,
  type ExpertLanguageItem,
  type ExpertProjectItem,
  type ExpertPublicationItem,
  type LanguageProficiency,
} from "@/lib/experts";
import { useLanguage } from "@/lib/i18n";
import { CountrySelect } from "@/components/ui/country-select";
import { PhoneInput } from "@/components/ui/phone-input";

const EXPERT_APPLICATION_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp";

const STEPS = [
  {
    n: 1,
    titleEn: "Personal Info",
    titleId: "Data Diri",
    descEn: "Identity & contact details",
    descId: "Identitas & kontak",
    icon: User,
  },
  {
    n: 2,
    titleEn: "Expertise & Roles",
    titleId: "Keahlian & Peran",
    descEn: "Domains & participation",
    descId: "Bidang & peran",
    icon: Layers,
  },
  {
    n: 3,
    titleEn: "Professional Profile",
    titleId: "Profil Profesional",
    descEn: "Bio, languages, projects",
    descId: "Bio, bahasa, proyek",
    icon: BookOpen,
  },
  {
    n: 4,
    titleEn: "Documents",
    titleId: "Dokumen Berkas",
    descEn: "CV, photo & certificates",
    descId: "CV, foto & sertifikat",
    icon: Upload,
  },
  {
    n: 5,
    titleEn: "Review & Submit",
    titleId: "Review & Kirim",
    descEn: "Summary & final submit",
    descId: "Ringkasan & pengajuan",
    icon: ClipboardCheck,
  },
];

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
  const { language } = useLanguage();
  const isId = language === "id";

  const navigate = useNavigate();
  const bootstrapFn = useServerFn(getExpertApplicationBootstrap);
  const saveDraftFn = useServerFn(saveExpertApplicationDraft);
  const submitFn = useServerFn(submitExpertApplication);
  const resubmitRevisionFn = useServerFn(resubmitExpertApplicationRevision);

  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<ExpertApplicationDraft>({ ...emptyExpertApplication });
  const [submitted, setSubmitted] = useState(false);
  const [isRevisionSubmitted, setIsRevisionSubmitted] = useState(false);
  const [ready, setReady] = useState(false);
  const [bootstrapData, setBootstrapData] = useState<ExpertApplicationBootstrap | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftId, setDraftId] = useState<string | undefined>();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [isRevision, setIsRevision] = useState(false);
  const [latestDecision, setLatestDecision] = useState<{
    id?: string;
    decision?: string;
    action?: string;
    rationale: string | null;
    createdAt: string;
  } | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [userId, setUserId] = useState("");
  const [documents, setDocuments] = useState<ExpertApplicationDocument[]>([]);
  const [files, setFiles] = useState<Partial<Record<ExpertDocumentCategory, File>>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedProfessionalTitle = !form.title
    ? ""
    : PROFESSIONAL_TITLE_OPTIONS.includes(form.title as (typeof PROFESSIONAL_TITLE_OPTIONS)[number])
      ? form.title
      : CUSTOM_PROFESSIONAL_TITLE_VALUE;

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
        setBootstrapData(bootstrap);
        if (bootstrap.editableDraft) {
          const draft = bootstrap.editableDraft;
          const payload = draft.payload;
          setDraftId(draft.draftId);
          setSubjectId(draft.subjectId ?? null);
          const revReq = draft.reviewStatus === "revision_requested";
          setIsRevision(revReq);
          setLatestDecision(draft.latestDecision ?? null);
          setDocuments(payload.documents ?? []);

          // Auto-migrate legacy string fields into structured arrays if not yet present
          const rawLangs: ExpertLanguageItem[] =
            Array.isArray(payload.structuredLanguages) && payload.structuredLanguages.length > 0
              ? payload.structuredLanguages
              : typeof payload.languages === "string" && payload.languages.trim()
              ? payload.languages
                  .split(",")
                  .map((l: string) => ({
                    id: genId("lang"),
                    language: l.trim().replace(/\s*\(.*\)$/, ""),
                    proficiency: "fluent" as const,
                  }))
                  .filter((l) => Boolean(l.language))
              : [];

          setForm({
            ...emptyExpertApplication,
            ...payload,
            structuredLanguages: rawLangs,
            structuredProjects: Array.isArray(payload.structuredProjects)
              ? payload.structuredProjects
              : [],
            structuredPublications: Array.isArray(payload.structuredPublications)
              ? payload.structuredPublications
              : [],
          });
          if (revReq) {
            setNotice(
              "Pengajuan ini membutuhkan revisi dokumen sesuai catatan verifikator admin. Silakan periksa berkas, unggah penggantinya, lalu kirim ulang.",
            );
          } else {
            setNotice("Draf pengajuan Anda berhasil dimuat kembali.");
          }
        } else {
          setForm((current) => ({
            ...current,
            fullName: bootstrap.profile.fullName,
            email: bootstrap.profile.email,
            institution: bootstrap.profile.institution,
            title: bootstrap.profile.title,
            phone: bootstrap.profile.phone,
            country: current.country || "Indonesia",
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
      const msg = "Please complete the required personal information fields.";
      setError(msg);
      toast.error(msg);
      return false;
    }
    if (form.expertise.length === 0) {
      const msg = "Please select at least one area of expertise.";
      setError(msg);
      toast.error(msg);
      return false;
    }
    if (form.roles.length === 0) {
      const msg = "Please select at least one available role.";
      setError(msg);
      toast.error(msg);
      return false;
    }
    if (!form.biography.trim()) {
      const msg = "Please provide a professional biography.";
      setError(msg);
      toast.error(msg);
      return false;
    }
    return true;
  };

  const uploadSelectedFiles = async (id: string) => {
    const uploaded = [...documents];
    for (const [category, file] of Object.entries(files) as [ExpertDocumentCategory, File][]) {
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
      const path = `users/${userId}/${id}/${category}-${Date.now()}-${safeName}`;
      const contentType = resolveFileContentType(file.name, file.type);
      const { error: uploadError } = await supabase.storage
        .from(EXPERT_APPLICATION_BUCKET)
        .upload(path, file, { contentType, upsert: true });
      if (uploadError) throw uploadError;
      const document: ExpertApplicationDocument = {
        category,
        path,
        name: file.name,
        size: file.size,
        type: contentType,
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

  const removeStored = (category: ExpertDocumentCategory) => {
    setDocuments((current) => current.filter((item) => item.category !== category));
  };

  const persist = async (shouldSubmit: boolean) => {
    if (shouldSubmit && !validate()) return;
    if (!form.fullName.trim()) {
      const msg = "Full name is required before saving a draft.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      // 1. Revision resubmission flow when admin requested changes
      if (shouldSubmit && isRevision && subjectId && draftId) {
        const uploaded = await uploadSelectedFiles(draftId);
        await resubmitRevisionFn({
          data: {
            draftId,
            subjectId,
            displayName: form.fullName,
            payload: { ...form, documents: uploaded, schemaVersion: 1 },
            notes: revisionNotes.trim() || undefined,
          },
        });
        toast.success("Revisi dokumen berhasil dikirimkan!");
        setIsRevisionSubmitted(true);
        setSubmitted(true);
        return;
      }

      // 2. Standard draft save or initial submission
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
        toast.success("Aplikasi pendaftaran berhasil dikirim!");
        setSubmitted(true);
      } else {
        const msg = "Draft saved securely to your BARUNA account.";
        setNotice(msg);
        toast.success(msg);
      }
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "Unable to save the application.";
      setError(msg);
      toast.error(msg);
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

  if (bootstrapData?.isAlreadyExpert) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <AlreadyExpertNotice
          expertName={bootstrapData.expertName}
          expertSlug={bootstrapData.expertSlug}
        />
      </div>
    );
  }

  if (bootstrapData?.pendingApplication) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <ApplicationPendingNotice application={bootstrapData.pendingApplication} />
      </div>
    );
  }

  if (submitted) {
    if (isRevisionSubmitted) {
      return (
        <div className="min-h-screen bg-background">
          <Navbar />
          <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-500/15 text-amber-600">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h1 className="mt-6 font-display text-2xl font-extrabold text-navy">
              Revisi Dokumen Berhasil Dikirimkan
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Dokumen perbaikan telah diteruskan ke tim kurasi dan verifikator BARUNA. Status
              pengajuan profil Anda kini kembali menjadi <strong>Menunggu Verifikasi (Pending)</strong>.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                to="/experts/profile"
                className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
              >
                Lihat Status Pengajuan Saya <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/notifications"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-navy transition-colors hover:bg-muted"
              >
                Lihat Notifikasi
              </Link>
            </div>
          </main>
        </div>
      );
    }

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

        {/* Banner Revisi jika ada permintaan perbaikan dari verifikator */}
        {isRevision && (
          <div className="mt-6 rounded-2xl border-2 border-amber-400 bg-amber-50/95 p-5 shadow-sm">
            <div className="flex items-start gap-3.5">
              <span className="rounded-xl bg-amber-200 p-2.5 text-amber-900 shrink-0 mt-0.5">
                <RotateCcw className="h-5 w-5 text-amber-800" />
              </span>
              <div className="flex-1 min-w-0">
                <span className="inline-block rounded-full bg-amber-200/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                  Permintaan Revisi Dokumen dari Admin
                </span>
                <h2 className="font-display text-base font-bold text-navy mt-1.5">
                  Pengajuan Profil Expert Memerlukan Perbaikan Dokumen
                </h2>
                {latestDecision?.rationale ? (
                  <div className="mt-2.5 rounded-xl border border-amber-300 bg-white/95 p-3.5 text-xs text-slate-800">
                    <span className="font-bold text-amber-900 block mb-1 uppercase tracking-wide text-[11px]">
                      Catatan / Evaluasi dari Verifikator:
                    </span>
                    <span className="italic leading-relaxed">&quot;{latestDecision.rationale}&quot;</span>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-900">
                    Tim verifikator meminta Anda mengganti atau melengkapi dokumen pendukung pada pengajuan ini.
                  </p>
                )}
                <p className="mt-2.5 text-xs text-amber-900/90 leading-relaxed">
                  Silakan periksa dan perbarui berkas pada <strong>Section 5 (Upload Documents)</strong> di bawah. Anda dapat mengunggah berkas pengganti untuk CV, Sertifikat, atau Dokumen Pendukung lainnya.
                </p>

                {/* Kolom pesan balasan opsional */}
                <div className="mt-3.5 pt-3 border-t border-amber-200">
                  <label className="block text-xs font-bold text-amber-950 mb-1">
                    Catatan Tanggapan untuk Verifikator (Opsional):
                  </label>
                  <input
                    type="text"
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    placeholder="Contoh: Berkas CV dan sertifikasi kompetensi terbaru telah diperbarui..."
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-muted-foreground outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stepper Navigation Bar */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-soft">
          <div className="flex items-center justify-between mb-3 text-xs font-semibold text-muted-foreground">
            <span className="uppercase tracking-wider text-marine font-bold">
              {isId ? `Langkah ${currentStep} dari ${STEPS.length}` : `Step ${currentStep} of ${STEPS.length}`}
            </span>
            <span>
              {Math.round((currentStep / STEPS.length) * 100)}% {isId ? "Selesai" : "Completed"}
            </span>
          </div>

          {/* Step Progress Line */}
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-4">
            <div
              className="h-full rounded-full bg-marine transition-all duration-300"
              style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
            />
          </div>

          {/* Stepper Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {STEPS.map((s) => {
              const active = s.n === currentStep;
              const isDone = s.n < currentStep;
              const Icon = s.icon;

              return (
                <button
                  key={s.n}
                  type="button"
                  onClick={() => {
                    setCurrentStep(s.n);
                    setError(null);
                  }}
                  className={`flex items-start gap-2.5 rounded-xl p-3 text-left transition-all border cursor-pointer ${
                    active
                      ? "border-marine bg-marine/10 shadow-xs ring-1 ring-marine/30"
                      : isDone
                        ? "border-eco-community/40 bg-eco-community/5 hover:bg-eco-community/10"
                        : "border-transparent bg-muted/40 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                      active
                        ? "bg-marine text-white shadow-xs"
                        : isDone
                          ? "bg-eco-community text-white"
                          : "bg-background text-muted-foreground border border-border"
                    }`}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : s.n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-bold truncate ${
                        active ? "text-navy" : isDone ? "text-navy" : "text-muted-foreground"
                      }`}
                    >
                      {isId ? s.titleId : s.titleEn}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate hidden sm:block">
                      {isId ? s.descId : s.descEn}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notice & Error Messages */}
        {notice && (
          <div className="mt-4 rounded-xl border border-eco-community/30 bg-eco-community/10 p-3.5 text-xs font-medium text-eco-community flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-medium text-destructive flex items-center gap-2">
            <X className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 space-y-5">
          {/* STEP 1: Personal Information */}
          {currentStep === 1 && (
            <div className="animate-in fade-in-50 duration-200">
              <SectionCard icon={User} n={1} title={isId ? "Data Diri & Kontak" : "Personal Information"}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel required>{isId ? "Nama Lengkap & Gelar" : "Full Name"}</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.fullName}
                      onChange={(e) => set("fullName", e.target.value)}
                      placeholder={isId ? "Contoh: Dr. Budi Santoso, M.Sc." : "e.g., Dr. Budi Santoso, M.Sc."}
                    />
                  </div>
                  <div>
                    <FieldLabel required>{isId ? "Jabatan / Gelar Profesional" : "Professional Title"}</FieldLabel>
                    <select
                      className={inputClass}
                      value={selectedProfessionalTitle}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === CUSTOM_PROFESSIONAL_TITLE_VALUE) {
                          if (PROFESSIONAL_TITLE_OPTIONS.includes(form.title as (typeof PROFESSIONAL_TITLE_OPTIONS)[number])) {
                            set("title", "");
                          }
                        } else {
                          set("title", value);
                        }
                      }}
                    >
                      <option value="" disabled>{isId ? "Pilih jabatan profesional" : "Select a professional title"}</option>
                      {PROFESSIONAL_TITLE_OPTIONS.map((title) => (
                        <option key={title} value={title}>{title}</option>
                      ))}
                      <option value={CUSTOM_PROFESSIONAL_TITLE_VALUE}>Other / Custom Title</option>
                    </select>
                    {selectedProfessionalTitle === CUSTOM_PROFESSIONAL_TITLE_VALUE && (
                      <input
                        className={`${inputClass} mt-2`}
                        value={form.title}
                        onChange={(e) => set("title", e.target.value)}
                        placeholder={isId ? "Masukkan jabatan fungsional lainnya" : "Enter another functional or professional title"}
                      />
                    )}
                  </div>
                  <div>
                    <FieldLabel required>{isId ? "Institusi / Organisasi" : "Institution / Organization"}</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.institution}
                      onChange={(e) => set("institution", e.target.value)}
                      placeholder={isId ? "Contoh: Badan Riset dan Inovasi Nasional (BRIN)" : "e.g., Marine Research Institute"}
                    />
                  </div>
                  <div>
                    <FieldLabel required>{isId ? "Negara Domisili / Tugas" : "Country"}</FieldLabel>
                    <CountrySelect
                      value={form.country}
                      onChange={(countryName) => set("country", countryName)}
                      isId={isId}
                    />
                  </div>
                  <div>
                    <FieldLabel required>{isId ? "Alamat Email" : "Email Address"}</FieldLabel>
                    <input
                      className={inputClass}
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="name@example.com"
                    />
                  </div>
                  <div>
                    <FieldLabel>{isId ? "Nomor Telepon / WhatsApp" : "Phone Number"}</FieldLabel>
                    <PhoneInput
                      value={form.phone}
                      onChange={(fullPhone) => set("phone", fullPhone)}
                      countryName={form.country || "Indonesia"}
                      isId={isId}
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
                    <FieldLabel>{isId ? "Situs Web Pribadi / Portofolio" : "Personal Website / Portfolio"}</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.website}
                      onChange={(e) => set("website", e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* STEP 2: Areas of Expertise & Available Roles */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <SectionCard icon={Layers} n={2} title={isId ? "Bidang Keahlian Maritim" : "Areas of Expertise"}>
                <p className="mb-3 text-xs sm:text-sm text-muted-foreground">
                  {isId ? "Pilih semua bidang yang sesuai dengan kompetensi Anda." : "Select all domains that apply to your background."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {EXPERTISE_AREAS.map((area) => {
                    const active = form.expertise.includes(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => toggleExpertise(area)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                          active
                            ? "bg-marine text-marine-foreground shadow-xs"
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

              <SectionCard icon={ClipboardCheck} n={3} title={isId ? "Peran yang Diminati" : "Available Roles"}>
                <p className="mb-3 text-xs sm:text-sm text-muted-foreground">
                  {isId ? "Anda dapat memilih lebih dari satu peran kontribusi." : "You may select multiple roles."}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {EXPERT_ROLES.map((role) => {
                    const active = form.roles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-semibold transition-all cursor-pointer ${
                          active
                            ? "border-marine bg-marine/10 text-marine shadow-2xs"
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
            </div>
          )}

          {/* STEP 3: Professional Profile */}
          {currentStep === 3 && (
            <div className="animate-in fade-in-50 duration-200">
              <ProfessionalProfileSection
                form={form}
                set={set}
                setForm={setForm}
                inputClass={inputClass}
              />
            </div>
          )}

          {/* STEP 4: Upload Documents */}
          {currentStep === 4 && (
            <div className="animate-in fade-in-50 duration-200">
              <SectionCard icon={Upload} n={4} title={isId ? "Unggah Dokumen Pendukung" : "Upload Documents"}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FileUpload
                    label={isId ? "CV / Riwayat Hidup" : "CV / Resume"}
                    file={files.cv ?? null}
                    stored={documents.find((item) => item.category === "cv") ?? null}
                    onFile={(file) => setFiles((current) => ({ ...current, cv: file ?? undefined }))}
                    onRemoveStored={() => removeStored("cv")}
                  />
                  <FileUpload
                    label={isId ? "Foto Profil Profesional" : "Professional Photo"}
                    file={files.photo ?? null}
                    stored={documents.find((item) => item.category === "photo") ?? null}
                    onFile={(file) => setFiles((current) => ({ ...current, photo: file ?? undefined }))}
                    onRemoveStored={() => removeStored("photo")}
                    accept=".jpg,.jpeg,.png,.webp,image/*"
                    helperText={isId ? "Format gambar: JPG, PNG, WebP (Maks. 10MB)" : "Image format: JPG, PNG, WebP (Max 10MB)"}
                  />
                  <FileUpload
                    label={isId ? "Sertifikasi Kompetensi" : "Certifications"}
                    file={files.certifications ?? null}
                    stored={documents.find((item) => item.category === "certifications") ?? null}
                    onFile={(file) =>
                      setFiles((current) => ({ ...current, certifications: file ?? undefined }))
                    }
                    onRemoveStored={() => removeStored("certifications")}
                  />
                  <FileUpload
                    label={isId ? "Dokumen Pendukung Lainnya" : "Supporting Documents"}
                    file={files.supporting ?? null}
                    stored={documents.find((item) => item.category === "supporting") ?? null}
                    onFile={(file) =>
                      setFiles((current) => ({ ...current, supporting: file ?? undefined }))
                    }
                    onRemoveStored={() => removeStored("supporting")}
                  />
                </div>
                <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                  {isId
                    ? "Berkas disimpan aman di penyimpanan privat dan hanya dapat diakses oleh Anda dan tim verifikator resmi BARUNA. Dokumen dapat dibuka langsung di tab browser dan diganti kapan saja bila verifikator meminta revisi."
                    : "Files are stored in a private bucket and are visible only to you and authorized BARUNA reviewers. Documents can be previewed or replaced whenever needed."}
                </p>
              </SectionCard>
            </div>
          )}

          {/* STEP 5: Review & Submit */}
          {currentStep === 5 && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              {/* Summary Card Preview */}
              <div className="rounded-2xl border border-marine/30 bg-marine/5 p-5 shadow-soft">
                <div className="flex items-center gap-2 font-display text-sm font-bold text-navy mb-3">
                  <Eye className="h-4 w-4 text-marine" />
                  {isId ? "Pratinjau Ringkasan Profil Pakar" : "Expert Profile Summary Preview"}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl border border-border bg-card p-3">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      {isId ? "Nama & Gelar" : "Name & Title"}
                    </span>
                    <p className="font-semibold text-navy truncate mt-0.5">
                      {form.fullName || "-"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{form.title || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      {isId ? "Institusi & Negara" : "Institution & Country"}
                    </span>
                    <p className="font-semibold text-navy truncate mt-0.5">
                      {form.institution || "-"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{form.country || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      {isId ? "Keahlian & Peran" : "Expertise & Roles"}
                    </span>
                    <p className="font-semibold text-navy truncate mt-0.5">
                      {form.expertise.length} {isId ? "Keahlian" : "Domains"},{" "}
                      {form.roles.length} {isId ? "Peran" : "Roles"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      {isId ? "Dokumen Terlampir" : "Attached Documents"}
                    </span>
                    <p className="font-semibold text-navy truncate mt-0.5">
                      {documents.length + Object.keys(files).length} {isId ? "Dokumen" : "Files"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Revision Response Notes Box (if revising) */}
              {isRevision && (
                <div className="rounded-2xl border-2 border-amber-400 bg-amber-50/95 p-5 shadow-sm">
                  <h3 className="font-display text-sm font-bold text-navy mb-2">
                    {isId ? "Tanggapan untuk Tim Verifikator" : "Response for Review Team"}
                  </h3>
                  <p className="text-xs text-amber-900/90 mb-3">
                    {isId
                      ? "Tuliskan keterangan perbaikan berkas atau klarifikasi data yang telah Anda sesuaikan."
                      : "Provide a brief note explaining the revised documents or updated profile information."}
                  </p>
                  <input
                    type="text"
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    placeholder={
                      isId
                        ? "Contoh: Berkas CV dan sertifikasi kompetensi terbaru telah diperbarui..."
                        : "e.g., Updated CV and latest competency certificate attached..."
                    }
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-muted-foreground outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                </div>
              )}
            </div>
          )}

          {/* Stepper Bottom Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/80">
            <div>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep((s) => Math.max(1, s - 1));
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-navy hover:bg-muted transition shadow-2xs cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {isId ? "Kembali" : "Previous Step"}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Save Draft (always available) */}
              <button
                type="button"
                disabled={busy}
                onClick={() => void persist(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-navy hover:bg-muted transition cursor-pointer shadow-2xs disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Bookmark className="h-3.5 w-3.5" />
                {busy
                  ? isId
                    ? "Menyimpan…"
                    : "Saving…"
                  : isId
                    ? "Simpan sebagai Draf"
                    : "Save Draft"}
              </button>

              {/* Next Step Button (Step 1, 2, 3, 4) */}
              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep === 1) {
                      if (
                        !form.fullName.trim() ||
                        !form.title.trim() ||
                        !form.institution.trim() ||
                        !form.country.trim() ||
                        !form.email.trim()
                      ) {
                        const msg = isId
                          ? "Harap lengkapi semua kolom wajib di Data Diri sebelum melanjutkan."
                          : "Please complete all required personal information fields.";
                        setError(msg);
                        toast.error(msg);
                        return;
                      }
                    }
                    if (currentStep === 2) {
                      if (form.expertise.length === 0) {
                        const msg = isId
                          ? "Pilih minimal satu bidang keahlian."
                          : "Please select at least one area of expertise.";
                        setError(msg);
                        toast.error(msg);
                        return;
                      }
                      if (form.roles.length === 0) {
                        const msg = isId
                          ? "Pilih minimal satu peran yang diminati."
                          : "Please select at least one available role.";
                        setError(msg);
                        toast.error(msg);
                        return;
                      }
                    }
                    if (currentStep === 3) {
                      if (!form.biography.trim()) {
                        const msg = isId
                          ? "Harap isi ringkasan biografi profesional Anda."
                          : "Please provide a professional biography.";
                        setError(msg);
                        toast.error(msg);
                        return;
                      }
                    }
                    setError(null);
                    setCurrentStep((s) => Math.min(5, s + 1));
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-xs font-semibold text-white hover:bg-navy transition shadow-xs cursor-pointer"
                >
                  {isId ? "Lanjut ke Langkah Berikutnya" : "Next Step"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                /* Final Submit (Step 5) */
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void persist(true)}
                  className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer shadow-xs ${
                    isRevision
                      ? "bg-amber-600 text-white hover:bg-amber-700"
                      : "bg-marine text-white hover:bg-navy"
                  }`}
                >
                  {busy ? (
                    isId
                      ? "Memproses…"
                      : "Processing…"
                  ) : isRevision ? (
                    <>
                      <RotateCcw className="h-4 w-4" />{" "}
                      {isId ? "Kirim Ulang Revisi Dokumen" : "Resubmit Revised Application"}
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />{" "}
                      {isId ? "Kirim Pengajuan Pakar" : "Submit Expert Application"}
                    </>
                  )}
                </button>
              )}
            </div>
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
  onRemoveStored,
  accept = EXPERT_APPLICATION_ACCEPT,
  helperText,
}: {
  label: string;
  file: File | null;
  stored: ExpertApplicationDocument | null;
  onFile: (file: File | null) => void;
  onRemoveStored?: () => void;
  accept?: string;
  helperText?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  const handle = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setErr("File is too large (max 50 MB).");
      return;
    }
    if (
      accept.includes("image") &&
      !accept.includes(".pdf") &&
      !f.type.startsWith("image/") &&
      !/\.(jpg|jpeg|png|webp)$/i.test(f.name)
    ) {
      setErr("Harap pilih berkas gambar (JPG, PNG, atau WebP).");
      return;
    }
    setErr(null);
    onFile(f);
  };

  const handleOpenStored = async () => {
    if (!stored?.path) return;
    try {
      const { data, error } = await supabase.storage
        .from(EXPERT_APPLICATION_BUCKET)
        .createSignedUrl(stored.path, 3600);
      if (error || !data?.signedUrl) {
        setErr("Gagal membuat tautan akses berkas.");
        return;
      }
      const viewerUrl = `/document-viewer?url=${encodeURIComponent(data.signedUrl)}&title=${encodeURIComponent(stored.name)}`;
      window.open(viewerUrl, "_blank", "noopener,noreferrer");
    } catch {
      setErr("Gagal membuka dokumen.");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
      <div className="mb-2 flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        {file ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Berkas Baru / Pengganti
          </span>
        ) : stored ? (
          <span className="rounded-full bg-eco-community/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-eco-community">
            Berkas Tersimpan
          </span>
        ) : null}
      </div>

      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50/50 p-2.5">
          <FileText className="h-5 w-5 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-navy">{file.name}</p>
            <p className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => onFile(null)}
            title="Batal ganti berkas"
            className="grid h-7 w-7 place-items-center rounded-full border border-border bg-white text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : stored ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-lg border border-eco-community/30 bg-eco-community/5 p-2.5">
            <FileText className="h-5 w-5 shrink-0 text-eco-community" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-navy">{stored.name}</p>
              <p className="text-[11px] text-muted-foreground">{formatBytes(stored.size)}</p>
            </div>
            {onRemoveStored && (
              <button
                type="button"
                onClick={onRemoveStored}
                title="Hapus berkas tersimpan"
                className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenStored}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-marine transition-colors hover:bg-muted"
            >
              <ExternalLink className="h-3 w-3" /> Buka di Tab
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-500/20"
            >
              <Upload className="h-3 w-3" /> Ganti Berkas
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-3 py-3 text-sm font-semibold text-marine transition-colors hover:border-marine/50 hover:bg-muted"
        >
          <Upload className="h-4 w-4" /> Unggah {label}
        </button>
      )}

      {helperText && !file && !stored && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{helperText}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0] ?? null)}
      />
      {err && <p className="mt-1 text-xs font-medium text-destructive">{err}</p>}
    </div>
  );
}
