import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Mic,
  GraduationCap,
  ClipboardCheck,
  UserCheck,
  LifeBuoy,
  Upload,
  FileText,
  X,
  ClipboardList,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import {
  REQUEST_TYPE_CONFIG,
  REQUEST_TYPE_ORDER,
  REQUEST_PIPELINE,
  ACCEPTED_FILE_TYPES,
  MAX_BYTES,
  emptyRequestDraft,
  formatBytes,
  type RequestType,
  type RequestDraft,
  type FieldDef,
  type FileMeta,
} from "@/lib/experts";
import { supabase } from "@/integrations/supabase/client";
import { createExpertServiceRequest } from "@/lib/experts/portal-services.functions";

export const Route = createFileRoute("/experts/request")({
  head: () => ({
    meta: [
      { title: "Request an Expert — BARUNA Experts" },
      {
        name: "description",
        content:
          "Connect with marine and fisheries experts, trainers, reviewers, mentors, and technical specialists from the BARUNA network.",
      },
      { property: "og:title", content: "Request an Expert — BARUNA Experts" },
      {
        property: "og:description",
        content: "Request a speaker, trainer, reviewer, mentor, or technical assistance from BARUNA.",
      },
    ],
    links: [{ rel: "canonical", href: "/experts/request" }],
  }),
  validateSearch: (s: Record<string, unknown>): { type?: RequestType; expert?: string } => {
    const t = typeof s.type === "string" ? s.type : undefined;
    return { type: REQUEST_TYPE_ORDER.includes(t as RequestType) ? (t as RequestType) : undefined, expert: typeof s.expert === "string" ? s.expert : undefined };
  },
  component: RequestExpertPage,
});

const TYPE_ICON: Record<RequestType, LucideIcon> = {
  speaker: Mic,
  trainer: GraduationCap,
  reviewer: ClipboardCheck,
  mentor: UserCheck,
  technical: LifeBuoy,
};

const STEPS = [
  { n: 1, label: "Request Type", icon: Layers },
  { n: 2, label: "Details", icon: FileText },
  { n: 3, label: "Review & Submit", icon: ClipboardList },
];

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-marine focus:ring-1 focus:ring-marine";

function RequestExpertPage() {
  const { type: initialType, expert } = useSearch({ from: Route.id });
  const navigate = useNavigate();
  const createRequest = useServerFn(createExpertServiceRequest);
  const [step, setStep] = useState(initialType ? 2 : 1);
  const [type, setType] = useState<RequestType | null>(initialType ?? null);
  const [draft, setDraft] = useState<RequestDraft>(() =>
    emptyRequestDraft(initialType ?? "speaker"),
  );
  const [submitted, setSubmitted] = useState<null | "draft" | "submitted">(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) void navigate({ to: "/auth", search: { mode: "signin", redirect: `/experts/request${initialType ? `?type=${initialType}` : ""}` }, replace: true });
    });
  }, [initialType, navigate]);

  const config = type ? REQUEST_TYPE_CONFIG[type] : null;

  const setValue = (key: string, value: string) =>
    setDraft((d) => ({ ...d, values: { ...d.values, [key]: value } }));
  const setFile = (key: string, file: FileMeta | null) =>
    setDraft((d) => {
      const files = { ...d.files };
      if (file) files[key] = file;
      else delete files[key];
      return { ...d, files };
    });

  const chooseType = (t: RequestType) => {
    setType(t);
    setDraft((d) => ({ ...d, type: t }));
  };

  const detailsComplete = useMemo(() => {
    if (!config) return false;
    return config.fields.every((f) => {
      if (!f.required) return true;
      if (f.type === "file") return !!draft.files[f.key];
      return !!draft.values[f.key]?.trim();
    });
  }, [config, draft]);

  const goNext = () => {
    if (step === 1 && !type) {
      setError("Please select a request type to continue.");
      return;
    }
    if (step === 2 && !detailsComplete) {
      setError("Please complete all required fields before continuing.");
      return;
    }
    setError(null);
    setStep((s) => Math.min(3, s + 1));
  };
  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const persist = async (status: "draft" | "submitted") => {
    if (!type) return;
    setSaving(true);
    setError(null);
    try {
      await createRequest({ data: { type, status, targetExpertSlug: expert ?? null, payload: { values: draft.values, files: draft.files } } });
      setSubmitted(status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save this request.");
    } finally { setSaving(false); }
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
            {submitted === "draft" ? "Draft saved" : "Request submitted"}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            {submitted === "draft"
              ? "Your request has been saved as a draft. You can finish and submit it any time from My Requests."
              : "Thank you! Your request is now in the workflow: Submitted → Under Review → Expert Matching → Confirmed → Completed. Track its progress in My Requests."}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              to="/experts/my-requests"
              className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
            >
              View My Requests <ArrowRight className="h-4 w-4" />
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
          <h1 className="font-display text-3xl font-extrabold text-navy">Request an Expert</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Connect with marine and fisheries experts, trainers, reviewers, mentors, and technical
            specialists from the BARUNA network.
          </p>
          {expert && <p className="mt-3 inline-flex rounded-full bg-marine/10 px-3 py-1 text-xs font-semibold text-marine">Directed request: {expert.replaceAll("-", " ")}</p>}
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
                {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-border sm:w-6" aria-hidden />}
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
          {step === 1 && (
            <div>
              <h2 className="font-display text-lg font-bold text-navy">Step 1 — Select Request Type</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose the service you need.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {REQUEST_TYPE_ORDER.map((t) => {
                  const c = REQUEST_TYPE_CONFIG[t];
                  const Icon = TYPE_ICON[t];
                  const active = type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => chooseType(t)}
                      className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                        active
                          ? "border-marine bg-marine/10"
                          : "border-border hover:border-marine/40 hover:bg-muted"
                      }`}
                    >
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                          active ? "bg-marine text-marine-foreground" : "bg-marine/10 text-marine"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-display text-sm font-bold text-navy">
                          {c.label}
                          {active && <Check className="h-4 w-4 text-marine" />}
                        </span>
                        <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                          {c.purpose}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && config && (
            <div>
              <h2 className="font-display text-lg font-bold text-navy">
                Step 2 — {config.label} Request
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{config.purpose}</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {config.fields.map((f) => (
                  <Field
                    key={f.key}
                    f={f}
                    value={draft.values[f.key] ?? ""}
                    file={draft.files[f.key] ?? null}
                    onValue={(v) => setValue(f.key, v)}
                    onFile={(file) => setFile(f.key, file)}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 3 && config && (
            <div>
              <h2 className="font-display text-lg font-bold text-navy">Step 3 — Review &amp; Submit</h2>
              <p className="mt-1 text-sm text-muted-foreground">Check your request before submitting.</p>
              <div className="mt-5 divide-y divide-border rounded-xl border border-border p-4">
                <Row label="Request Type" value={config.label} />
                {config.fields.map((f) => (
                  <Row
                    key={f.key}
                    label={f.label.replace(" (optional)", "")}
                    value={
                      f.type === "file"
                        ? draft.files[f.key]
                          ? `${draft.files[f.key].name} (${formatBytes(draft.files[f.key].size)})`
                          : ""
                        : draft.values[f.key]
                    }
                  />
                ))}
              </div>
            </div>
          )}

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
              {type && (
                <button
                  type="button"
                  onClick={() => void persist("draft")}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-marine px-4 py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                >
                  Save Draft
                </button>
              )}
              {step < 3 ? (
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
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
                >
                  {saving ? "Submitting…" : "Submit Request"} <Check className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Workflow note */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Request workflow
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {["Draft", ...REQUEST_PIPELINE].map((stage, i) => (
              <div key={stage} className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-3 py-1 font-semibold text-foreground/70">
                  {stage}
                </span>
                {i < REQUEST_PIPELINE.length && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  f,
  value,
  file,
  onValue,
  onFile,
}: {
  f: FieldDef;
  value: string;
  file: FileMeta | null;
  onValue: (v: string) => void;
  onFile: (file: FileMeta | null) => void;
}) {
  const fullWidth = f.type === "textarea" || f.type === "file";
  return (
    <div className={fullWidth ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {f.label}
        {f.required && <span className="text-destructive"> *</span>}
      </label>
      {f.type === "textarea" ? (
        <textarea
          className={`${inputClass} min-h-[100px] resize-y`}
          value={value}
          maxLength={2000}
          onChange={(e) => onValue(e.target.value)}
          placeholder={f.placeholder}
        />
      ) : f.type === "select" ? (
        <select className={inputClass} value={value} onChange={(e) => onValue(e.target.value)}>
          <option value="">Select…</option>
          {f.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : f.type === "file" ? (
        <FileField file={file} onFile={onFile} />
      ) : (
        <input
          className={inputClass}
          type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          placeholder={f.placeholder}
        />
      )}
    </div>
  );
}

function FileField({ file, onFile }: { file: FileMeta | null; onFile: (f: FileMeta | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  const handle = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setErr("File is too large (max 50 MB).");
      return;
    }
    setErr(null);
    onFile({ name: f.name, size: f.size, type: f.type || "file", uploadedAt: new Date().toISOString() });
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-eco-community/40 bg-eco-community/5 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-eco-community/15 text-eco-community">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-navy">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(file.size)} · Uploaded</p>
        </div>
        <button
          type="button"
          onClick={() => onFile(null)}
          aria-label="Remove file"
          className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-border p-6 text-center">
      <Upload className="mx-auto h-7 w-7 text-marine" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-2 rounded-lg border border-marine px-4 py-2 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
      >
        Choose File
      </button>
      <p className="mt-2 text-xs text-muted-foreground">PDF, DOC, XLS, MP4, images · max 50 MB</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0] ?? null)}
      />
      {err && <p className="mt-2 text-sm font-medium text-destructive">{err}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2">
      <span className="w-44 shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground/90">
        {value || <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}
