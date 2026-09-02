import { useState, type ReactNode } from "react";
import { createFileRoute, notFound, Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronRight,
  CheckCircle2,
  Circle,
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  UserRound,
  Upload,
  FileCheck2,
  PartyPopper,
  Check,
  LayoutDashboard,
  Eye,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { Toaster } from "@/components/baruna/Toaster";
import { DocumentUploadRow } from "@/components/baruna/academy/DocumentUploadRow";
import { barunaToast } from "@/lib/downloads";
import { trainingBySlug, type TrainingProgram } from "@/data/training";
import {
  DOCUMENT_FIELDS,
  ENGLISH_LEVELS,
  type EnglishLevel,
  type PersonalInfo,
  type ProfessionalInfo,
  type DocumentMeta,
  emptyPersonal,
  emptyProfessional,
  createApplication,
} from "@/lib/application";

export const Route = createFileRoute("/academy/apply/$slug")({
  loader: ({ params }) => {
    const program = trainingBySlug[params.slug];
    if (!program) throw notFound();
    return { program };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.program;
    return {
      meta: [
        { title: `Apply — ${p?.title ?? "Training"} — BARUNA` },
        { name: "description", content: "Apply to the BARUNA Academy training program in a few guided steps." },
      ],
    };
  },
  notFoundComponent: () => (
    <AcademyShell active="training">
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">Program not found</h1>
        <Link to="/academy/training" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground">
          Browse training <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </AcademyShell>
  ),
  errorComponent: ({ error }) => (
    <AcademyShell active="training">
      <div role="alert" className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </AcademyShell>
  ),
  component: ApplyPage,
});

const eligibilityCriteria = [
  "Government officials",
  "Fisheries professionals",
  "Researchers",
  "Academics",
  "Extension officers",
  "Development practitioners",
  "Minimum 2 years of relevant experience",
  "Ability to communicate in English",
];

const STEPS = ["Eligibility", "Application", "Documents", "Review"] as const;
const stepIcons = [ClipboardCheck, UserRound, Upload, FileCheck2];

// ── Small form primitives ────────────────────────────────────────────────────
function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-navy">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-marine focus:ring-2 focus:ring-marine/20";

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />;
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputCls} />;
}

function ApplyPage() {
  const { program: p } = Route.useLoaderData() as { program: TrainingProgram };
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0..3 wizard, 4 = submitted

  const [personal, setPersonal] = useState<PersonalInfo>(emptyPersonal);
  const [professional, setProfessional] = useState<ProfessionalInfo>(emptyProfessional);
  const [english, setEnglish] = useState<EnglishLevel | "">("");
  const [motivation, setMotivation] = useState("");
  const [documents, setDocuments] = useState<Record<string, DocumentMeta | null>>(
    Object.fromEntries(DOCUMENT_FIELDS.map((d) => [d.key, null])),
  );
  const [confirmed, setConfirmed] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const setP = (k: keyof PersonalInfo, v: string) => setPersonal((s) => ({ ...s, [k]: v }));
  const setPr = (k: keyof ProfessionalInfo, v: string) => setProfessional((s) => ({ ...s, [k]: v }));

  const personalValid =
    personal.fullName && personal.gender && personal.nationality && personal.email && personal.phone;
  const professionalValid =
    professional.organization && professional.position && professional.country && professional.experience;
  const formValid = personalValid && professionalValid && english && motivation.trim().length > 10;
  const docsCount = Object.values(documents).filter(Boolean).length;
  const allDocsUploaded = docsCount === DOCUMENT_FIELDS.length;

  const onFile = (key: string, file: File | null) => {
    setDocuments((s) => ({
      ...s,
      [key]: file ? { name: file.name, size: file.size, uploadedAt: new Date().toISOString() } : null,
    }));
  };

  const submit = () => {
    if (!confirmed) return;
    const app = createApplication({
      slug: p.slug,
      title: p.title,
      personal,
      professional,
      english: english as EnglishLevel,
      motivation,
      documents,
    });
    setSubmittedId(app.id);
    setStep(4);
    barunaToast("Application submitted successfully");
  };

  const goNext = () => setStep((s) => Math.min(s + 1, 3));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <AcademyShell active="training">
      <Toaster />
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/academy/training" className="font-medium text-foreground/70 hover:text-marine">Training</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/academy/training/$slug" params={{ slug: p.slug }} className="font-medium text-foreground/70 hover:text-marine">
            Program
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy">Apply</span>
        </nav>

        {/* Program banner */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="flex items-center gap-4 p-4">
            <img src={p.hero} alt={p.title} className="h-16 w-24 shrink-0 rounded-xl object-cover" loading="lazy" />
            <div className="min-w-0">
              <span className="inline-flex rounded-md bg-badge-webinar px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-navy-foreground">
                {p.badge}
              </span>
              <h1 className="mt-1 line-clamp-2 font-display text-base font-bold text-navy sm:text-lg">{p.title}</h1>
            </div>
          </div>
        </div>

        {/* Stepper */}
        {step < 4 && (
          <ol className="flex items-center justify-between gap-1">
            {STEPS.map((label, i) => {
              const Icon = stepIcons[i];
              const done = i < step;
              const current = i === step;
              return (
                <li key={label} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-full border-2 transition-colors ${
                        done
                          ? "border-marine bg-marine text-marine-foreground"
                          : current
                            ? "border-marine bg-marine/10 text-marine"
                            : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span className={`text-center text-[0.65rem] font-semibold sm:text-xs ${current || done ? "text-navy" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <span className={`mx-1 h-0.5 flex-1 rounded ${done ? "bg-marine" : "bg-border"}`} aria-hidden />
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {/* ── STEP 1: Eligibility ── */}
        {step === 0 && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
            <h2 className="font-display text-2xl font-bold text-navy">Check Your Eligibility</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              This capacity-building program is designed for fisheries professionals from African countries. Please
              confirm that you meet the eligibility criteria before continuing your application.
            </p>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {eligibilityCriteria.map((c) => (
                <li key={c} className="flex items-start gap-2.5 rounded-xl border border-border bg-background px-3.5 py-3 text-sm font-medium text-navy">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-marine" />
                  {c}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex justify-end">
              <button
                onClick={goNext}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-marine px-6 py-3 text-sm font-semibold text-marine-foreground transition-all hover:-translate-y-0.5 hover:bg-marine/90 hover:shadow-hover"
              >
                Continue Application <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        {/* ── STEP 2: Application Form ── */}
        {step === 1 && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
              <h2 className="font-display text-xl font-bold text-navy">Personal Information</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Full Name" required>
                  <TextInput value={personal.fullName} onChange={(e) => setP("fullName", e.target.value)} placeholder="As shown on passport" />
                </Field>
                <Field label="Gender" required>
                  <SelectInput value={personal.gender} onChange={(e) => setP("gender", e.target.value)}>
                    <option value="">Select gender</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Prefer not to say</option>
                  </SelectInput>
                </Field>
                <Field label="Nationality" required>
                  <TextInput value={personal.nationality} onChange={(e) => setP("nationality", e.target.value)} placeholder="e.g. Nigerian" />
                </Field>
                <Field label="Date of Birth">
                  <TextInput type="date" value={personal.dob} onChange={(e) => setP("dob", e.target.value)} />
                </Field>
                <Field label="Passport Number">
                  <TextInput value={personal.passportNumber} onChange={(e) => setP("passportNumber", e.target.value)} placeholder="Passport no." />
                </Field>
                <Field label="Email Address" required>
                  <TextInput type="email" value={personal.email} onChange={(e) => setP("email", e.target.value)} placeholder="you@example.com" />
                </Field>
                <Field label="Phone Number" required>
                  <TextInput value={personal.phone} onChange={(e) => setP("phone", e.target.value)} placeholder="+234 ..." />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
              <h2 className="font-display text-xl font-bold text-navy">Professional Information</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Organization" required>
                  <TextInput value={professional.organization} onChange={(e) => setPr("organization", e.target.value)} placeholder="Your organization" />
                </Field>
                <Field label="Position" required>
                  <TextInput value={professional.position} onChange={(e) => setPr("position", e.target.value)} placeholder="Your role" />
                </Field>
                <Field label="Country" required>
                  <TextInput value={professional.country} onChange={(e) => setPr("country", e.target.value)} placeholder="Country of work" />
                </Field>
                <Field label="Years of Experience" required>
                  <SelectInput value={professional.experience} onChange={(e) => setPr("experience", e.target.value)}>
                    <option value="">Select experience</option>
                    <option>2–5 years</option>
                    <option>6–10 years</option>
                    <option>11–15 years</option>
                    <option>16+ years</option>
                  </SelectInput>
                </Field>
                <Field label="Sector of Expertise">
                  <TextInput value={professional.sector} onChange={(e) => setPr("sector", e.target.value)} placeholder="e.g. Aquaculture, Hatchery" />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
              <h2 className="font-display text-xl font-bold text-navy">English Proficiency</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {ENGLISH_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setEnglish(lvl)}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      english === lvl
                        ? "border-marine bg-marine/10 text-marine"
                        : "border-border bg-background text-navy hover:border-marine/40"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
              <h2 className="font-display text-xl font-bold text-navy">Motivation Statement</h2>
              <Field label="Why do you want to join this training?" required>
                <textarea
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  rows={5}
                  placeholder="Tell us about your goals and how this training will benefit your work and community..."
                  className={`${inputCls} resize-y`}
                />
              </Field>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button onClick={goBack} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-navy transition-colors hover:border-marine/40">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <div className="flex flex-col items-end gap-1.5">
                {!formValid && (
                  <p className="text-xs font-medium text-muted-foreground">
                    Complete all required fields (*), choose an English level, and write a short motivation to continue.
                  </p>
                )}
                <button
                  onClick={goNext}
                  disabled={!formValid}
                  className="inline-flex items-center gap-2 rounded-xl bg-marine px-6 py-3 text-sm font-semibold text-marine-foreground transition-all hover:-translate-y-0.5 hover:bg-marine/90 hover:shadow-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── STEP 3: Documents ── */}
        {step === 2 && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
              <h2 className="font-display text-xl font-bold text-navy">Document Upload</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload all required documents to continue. {docsCount} of {DOCUMENT_FIELDS.length} uploaded.
              </p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-marine transition-all"
                  style={{ width: `${(docsCount / DOCUMENT_FIELDS.length) * 100}%` }}
                />
              </div>
              <div className="mt-5 space-y-3">
                {DOCUMENT_FIELDS.map((d) => (
                  <DocumentUploadRow
                    key={d.key}
                    field={d}
                    meta={documents[d.key]}
                    onChange={(file) => onFile(d.key, file)}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button onClick={goBack} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-navy transition-colors hover:border-marine/40">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <div className="flex flex-col items-end gap-1.5">
                {!allDocsUploaded && (
                  <p className="text-xs font-medium text-muted-foreground">
                    Upload all {DOCUMENT_FIELDS.length} documents to continue.
                  </p>
                )}
                <button
                  onClick={goNext}
                  disabled={!allDocsUploaded}
                  className="inline-flex items-center gap-2 rounded-xl bg-marine px-6 py-3 text-sm font-semibold text-marine-foreground transition-all hover:-translate-y-0.5 hover:bg-marine/90 hover:shadow-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── STEP 4: Review & Submit ── */}
        {step === 3 && (
          <section className="space-y-6">
            <ReviewBlock title="Personal Information" rows={[
              ["Full Name", personal.fullName],
              ["Gender", personal.gender],
              ["Nationality", personal.nationality],
              ["Date of Birth", personal.dob || "—"],
              ["Passport Number", personal.passportNumber || "—"],
              ["Email Address", personal.email],
              ["Phone Number", personal.phone],
            ]} onEdit={() => setStep(1)} />

            <ReviewBlock title="Professional Information" rows={[
              ["Organization", professional.organization],
              ["Position", professional.position],
              ["Country", professional.country],
              ["Years of Experience", professional.experience],
              ["Sector of Expertise", professional.sector || "—"],
              ["English Proficiency", english || "—"],
            ]} onEdit={() => setStep(1)} />

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-navy">Motivation Statement</h2>
                <button onClick={() => setStep(1)} className="text-xs font-semibold text-marine hover:text-navy">Edit</button>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{motivation}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-navy">Uploaded Documents</h2>
                <button onClick={() => setStep(2)} className="text-xs font-semibold text-marine hover:text-navy">Edit</button>
              </div>
              <ul className="mt-3 space-y-2">
                {DOCUMENT_FIELDS.map((d) => {
                  const meta = documents[d.key];
                  return (
                    <li key={d.key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-navy">{d.label}</span>
                      {meta ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-marine">
                          <CheckCircle2 className="h-4 w-4" /> {meta.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Circle className="h-4 w-4" /> Not uploaded
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-marine" />
              <span className="text-navy">I confirm that all information provided is accurate.</span>
            </label>

            <div className="flex items-center justify-between gap-3">
              <button onClick={goBack} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-navy transition-colors hover:border-marine/40">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={submit}
                disabled={!confirmed}
                className="inline-flex items-center gap-2 rounded-xl bg-marine px-6 py-3 text-sm font-semibold text-marine-foreground transition-all hover:-translate-y-0.5 hover:bg-marine/90 hover:shadow-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                Submit Application <CheckCircle2 className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        {/* ── STEP 5: Submitted ── */}
        {step === 4 && submittedId && (
          <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft sm:p-10">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-marine/10 text-marine">
              <PartyPopper className="h-8 w-8" />
            </span>
            <h2 className="mt-5 font-display text-2xl font-bold text-navy">Application Submitted Successfully</h2>
            <p className="mt-2 text-sm text-muted-foreground">Thank you for applying to</p>
            <p className="mt-1 font-display text-base font-bold text-navy">{p.title}</p>

            <div className="mx-auto mt-6 grid max-w-sm gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Application ID</p>
                <p className="mt-1 font-display text-lg font-bold text-marine">{submittedId}</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Current Status</p>
                <p className="mt-1 font-display text-lg font-bold text-navy">Submitted</p>
              </div>
            </div>

            {/* Journey */}
            <div className="mx-auto mt-7 max-w-md">
              <p className="mb-3 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Application Journey</p>
              <ol className="space-y-3 text-left">
                {[
                  { label: "Submitted", done: true },
                  { label: "Under Review", done: false },
                  { label: "Shortlisted", done: false },
                  { label: "Accepted", done: false },
                ].map((s) => (
                  <li key={s.label} className="flex items-center gap-3">
                    {s.done ? (
                      <CheckCircle2 className="h-5 w-5 text-marine" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40" />
                    )}
                    <span className={`text-sm font-semibold ${s.done ? "text-navy" : "text-muted-foreground"}`}>{s.label}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                onClick={() => navigate({ to: "/academy/applications" })}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-marine px-6 py-3 text-sm font-semibold text-marine-foreground transition-all hover:-translate-y-0.5 hover:bg-marine/90 hover:shadow-hover"
              >
                <LayoutDashboard className="h-4 w-4" /> Go to Dashboard
              </button>
              <button
                onClick={() => navigate({ to: "/academy/applications/$id", params: { id: submittedId } })}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-marine bg-card px-6 py-3 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
              >
                <Eye className="h-4 w-4" /> View Application Status
              </button>
            </div>
          </section>
        )}
      </div>
    </AcademyShell>
  );
}

function ReviewBlock({ title, rows, onEdit }: { title: string; rows: [string, string][]; onEdit: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-navy">{title}</h2>
        <button onClick={onEdit} className="text-xs font-semibold text-marine hover:text-navy">Edit</button>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-sm font-semibold text-navy">{v || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
