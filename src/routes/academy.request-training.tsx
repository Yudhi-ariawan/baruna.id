import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Info,
  User,
  BookOpen,
  Users,
  Sparkles,
  Truck,
  ClipboardCheck,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import { supabase } from "@/integrations/supabase/client";
import {
  REQUESTER_TYPES,
  LEARNING_APPROACHES,
  PREFERRED_DELIVERY_OPTIONS,
  ATTENDANCE_FORMATS,
  URGENCY_LEVELS,
  ORGANIZATION_TYPES,
  TRAINING_CATEGORIES,
  COMPETENCY_LEVELS,
  TARGET_AUDIENCES,
  PARTICIPANT_COUNTS,
  DURATIONS,
  LANGUAGES,
  FUNDING_PREFERENCES,
  SUPPORT_OPTIONS,
  emptyTrainingDraft,
  demoTrainingDraft,
  createRequest,
  formatDate,
  type LearningApproach,
  type TrainingRequestDraft,
  type TrainingRequest,
} from "@/lib/trainingRequests";
import { submitTrainingNeedRequest } from "@/lib/trainingNeeds.functions";
import { usePresentationMode } from "@/lib/demoMode";

const BARUNA_VENUE = "Denpasar, Bali, Indonesia";
const DRAFT_STORAGE_KEY = "baruna:training-request-draft-v1";
const STEP_STORAGE_KEY = "baruna:training-request-step-v1";

/** Human-readable summary of where the training is physically held, if anywhere. */
function trainingLocationSummary(approach: LearningApproach | "", attendance: string): string {
  if (approach === "self_paced") return "Not Applicable";

  // Facilitated
  if (attendance === "Online") return "Delivery Location: Online";
  if (attendance === "In-Person") return `Training Location: ${BARUNA_VENUE}`;
  if (attendance === "Blended")
    return `Online Component: Online · In-Person Component: ${BARUNA_VENUE}`;
  if (attendance === "Flexible") return `To be confirmed (in-person components: ${BARUNA_VENUE})`;
  return "To be confirmed";
}

/** Review-step location rows, labelled per learning approach / attendance format. */
function trainingLocationRows(
  approach: LearningApproach | "",
  attendance: string,
): [string, string][] {
  if (approach === "self_paced") return [["Training Location", "Not Applicable"]];
  if (attendance === "Online") return [["Delivery Location", "Online"]];
  if (attendance === "In-Person") return [["Training Location", BARUNA_VENUE]];
  if (attendance === "Blended")
    return [
      ["Online Component", "Online"],
      ["In-Person Component", BARUNA_VENUE],
    ];
  if (attendance === "Flexible")
    return [["Training Location", `To be confirmed (in-person components: ${BARUNA_VENUE})`]];
  return [["Training Location", "To be confirmed"]];
}

/** Whether the request involves any in-person component held at the BARUNA venue. */
function hasInPersonComponent(approach: LearningApproach | "", attendance: string): boolean {
  return (
    approach === "facilitated" &&
    (attendance === "In-Person" || attendance === "Blended" || attendance === "Flexible")
  );
}



export const Route = createFileRoute("/academy/request-training")({
  head: () => ({
    meta: [
      { title: "Request a Training — Academy — BARUNA" },
      {
        name: "description",
        content:
          "Tell BARUNA about your learning needs. We will help identify, recommend, or develop the most suitable capacity building program.",
      },
      { property: "og:title", content: "Request a Training — Academy — BARUNA" },
      {
        property: "og:description",
        content:
          "Submit a training request and BARUNA will match it with existing programs, partner institutions, or new training initiatives.",
      },
    ],
    links: [{ rel: "canonical", href: "/academy/request-training" }],
  }),
  component: RequestTrainingPage,
});

const STEPS: { n: number; label: string; icon: LucideIcon }[] = [
  { n: 1, label: "Requester", icon: User },
  { n: 2, label: "Training Need", icon: BookOpen },
  { n: 3, label: "Participants", icon: Users },
  { n: 4, label: "Learning Approach", icon: Sparkles },
  { n: 5, label: "Delivery & Funding", icon: Truck },
  { n: 6, label: "Review", icon: ClipboardCheck },
];

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-marine focus:ring-1 focus:ring-marine";
const labelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-navy";

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[0.7rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function RequestTrainingPage() {
  const [presentation] = usePresentationMode();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<TrainingRequestDraft>(
    presentation ? demoTrainingDraft : emptyTrainingDraft,
  );
  const [submitted, setSubmitted] = useState<
    { request: TrainingRequest; subjectId: string | null } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoredFromAuth, setRestoredFromAuth] = useState(false);
  const submitInFlight = useRef(false);

  const submitToBackend = useServerFn(submitTrainingNeedRequest);

  // Restore a draft saved before an auth redirect (once, on mount).
  useEffect(() => {
    if (typeof window === "undefined" || presentation) return;
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      const s = sessionStorage.getItem(STEP_STORAGE_KEY);
      if (raw) {
        setDraft(JSON.parse(raw) as TrainingRequestDraft);
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        setRestoredFromAuth(true);
      }
      if (s) {
        const parsed = Number(s);
        if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 6) setStep(parsed);
        sessionStorage.removeItem(STEP_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [presentation]);

  const set = <K extends keyof TrainingRequestDraft>(key: K, value: TrainingRequestDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleSupport = (option: string) =>
    setDraft((d) => ({
      ...d,
      supportRequested: d.supportRequested.includes(option)
        ? d.supportRequested.filter((s) => s !== option)
        : [...d.supportRequested, option],
    }));

  const approach: LearningApproach | "" = draft.preferredLearningApproach;
  const showFacilitatedFields = approach === "facilitated";
  const locationSummary = trainingLocationSummary(approach, draft.attendanceFormat);
  const locationRows = trainingLocationRows(approach, draft.attendanceFormat);
  const showVenueNotice = hasInPersonComponent(approach, draft.attendanceFormat);

  // Individual self-paced learners always have exactly one participant.
  useEffect(() => {
    if (draft.requesterType === "Individual" && approach === "self_paced" && draft.participantCount !== "1") {
      setDraft((d) => ({ ...d, participantCount: "1" }));
    }
  }, [draft.requesterType, approach, draft.participantCount]);


  const stepComplete = useMemo(() => {
    switch (step) {
      case 1:
        return !!(
          draft.requesterType &&
          draft.fullName.trim() &&
          draft.email.trim() &&
          draft.country.trim() &&
          (draft.requesterType === "Individual" ||
            (draft.organization.trim() && draft.organizationType))
        );
      case 2:
        return !!(
          draft.trainingTopic.trim() &&
          draft.trainingCategory &&
          draft.objectives.trim() &&
          draft.needs.trim() &&
          draft.currentCompetencyLevel &&
          draft.desiredCompetencyLevel
        );
      case 3:
        if (draft.requesterType === "Individual") return true;
        return !!draft.targetAudience;
      case 4:
        return !!draft.preferredLearningApproach;
      case 5:
        if (!showFacilitatedFields) return true;
        return !!draft.fundingPreference;
      default:
        return true;
    }
  }, [step, draft, showFacilitatedFields]);

  const goNext = () => {
    if (!stepComplete) {
      setError("Please complete all required fields before continuing.");
      return;
    }
    setError(null);
    setStep((s) => Math.min(6, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    if (busy || submitInFlight.current) return;
    submitInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      // Presentation Mode: never writes to the backend.
      if (presentation) {
        const created = createRequest(draft);
        setSubmitted({ request: created, subjectId: null });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // Public wizard: sign-in is required before the submission is recorded.
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        try {
          sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
          sessionStorage.setItem(STEP_STORAGE_KEY, String(step));
        } catch {
          /* ignore quota */
        }
        navigate({ to: "/auth", search: { redirect: "/academy/request-training" } });
        return;
      }

      // Backend is the source of truth — only mark submitted after it succeeds.
      const result = await submitToBackend({
        data: {
          requesterType: draft.requesterType,
          fullName: draft.fullName,
          position: draft.position,
          organization: draft.organization,
          organizationType: draft.organizationType,
          country: draft.country,
          email: draft.email,
          phone: draft.phone,
          website: draft.website,
          trainingTopic: draft.trainingTopic,
          trainingCategory: draft.trainingCategory,
          objectives: draft.objectives,
          needs: draft.needs,
          outcomes: draft.outcomes,
          challenges: draft.challenges,
          currentCompetencyLevel: draft.currentCompetencyLevel,
          desiredCompetencyLevel: draft.desiredCompetencyLevel,
          urgency: draft.urgency,
          supportingExplanation: draft.supportingExplanation,
          targetAudience: draft.targetAudience,
          participantCount: draft.participantCount,
          participantProfile: draft.participantProfile,
          organizationalLevel: draft.organizationalLevel,
          geographicContext: draft.geographicContext,
          preferredLearningApproach:
            draft.preferredLearningApproach === "facilitated" ? "facilitated" : "self_paced",
          participantChargePreference: draft.participantChargePreference,

          deliveryPreference: draft.deliveryPreference,
          attendanceFormat: draft.attendanceFormat,
          duration: draft.duration,
          trainingPeriod: draft.trainingPeriod,
          language: draft.language,
          location:
            approach !== "facilitated"
              ? ""
              : draft.attendanceFormat === "Online"
                ? "Online"
                : draft.attendanceFormat
                  ? BARUNA_VENUE
                  : "",
          fundingPreference: draft.fundingPreference,
          supportRequested: draft.supportRequested,
          existingPartners: draft.existingPartners,
          remarks: draft.remarks,
        },
      });

      // Mirror to local tracker so "My Training Requests" continues to work.
      const created = createRequest(draft);
      setSubmitted({ request: created, subjectId: result?.subjectId ?? null });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Submission failed. Please try again in a moment.",
      );
    } finally {
      setBusy(false);
      submitInFlight.current = false;
    }
  };

  // ── Confirmation page ──────────────────────────────────────────────────────
  if (submitted) {
    const req = submitted.request;
    const approachLabel =
      LEARNING_APPROACHES.find((a) => a.key === req.preferredLearningApproach)?.label ??
      "Self-Paced Learning";

    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-eco-community/15 text-eco-community">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h1 className="mt-6 font-display text-2xl font-extrabold text-navy">
              Your training request has been submitted for Training Needs Analysis
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Thank you, {req.fullName}. BARUNA has received your request. It will proceed through
              Training Needs Analysis together with the requesting organization or partner network.
              You will receive updates by email as the analysis progresses.

            </p>

            {presentation && (
              <div className="mx-auto mt-4 max-w-md rounded-xl border border-marine/30 bg-marine/10 p-4 text-left">
                <p className="text-sm font-bold text-navy">Presentation Mode</p>
                <p className="mt-1 text-xs text-foreground/80">
                  This request is a demonstration only. No information has been saved to the
                  backend.
                </p>
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { label: "Reference Number", value: req.reference },
                { label: "Submission Date", value: formatDate(req.createdAt) },
                { label: "Preferred Learning Approach", value: approachLabel },
                { label: "Current Status", value: req.status },
              ].map((b) => (
                <div key={b.label} className="rounded-xl border border-border bg-background p-4 text-left">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">
                    {b.label}
                  </p>
                  <p className="mt-1 font-display text-sm font-bold text-navy">{b.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-border bg-background p-5 text-left">
              <p className="font-display text-sm font-bold text-navy">What happens next</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {[
                  "BARUNA reviews your request through Training Needs Analysis and matches it against existing programs where possible.",
                  "If no suitable program exists, BARUNA may coordinate with partner institutions and experts to explore a new training.",
                  "Any schedule, participant, or cost arrangements will be discussed and mutually agreed before the training is confirmed.",
                  "You will be notified by email at every stage of Training Needs Analysis.",
                ].map((t) => (

                  <li key={t} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-marine" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              {submitted.subjectId ? (
                <Link
                  to="/my-submissions"
                  className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
                >
                  View My Submission <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  to="/academy/training-requests/$id"
                  params={{ id: req.id }}
                  className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
                >
                  Track My Request <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link
                to="/academy/training"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-navy transition-colors hover:bg-muted"
              >
                Browse Available Training
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }


  const isIndividual = draft.requesterType === "Individual";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          to="/academy/training"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-marine transition-colors hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> Training
        </Link>

        <div className="mt-4">
          <h1 className="font-display text-3xl font-extrabold text-navy">Request a Training</h1>
          <p className="mt-2 font-display text-base font-bold text-marine">
            Can't find the right training?
          </p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Tell us about your learning needs and BARUNA will help identify, recommend, or develop
            the most suitable capacity building program.
          </p>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-marine/20 bg-marine/5 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-marine" />
          <p className="text-sm text-foreground/80">
            Training requests are reviewed by the BARUNA team and may be connected with existing
            programs, partner institutions, or developed as new training initiatives.
          </p>
        </div>


        {restoredFromAuth && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-eco-community/30 bg-eco-community/5 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-eco-community" />
            <p className="text-sm text-foreground/80">
              Welcome back — we restored the training request you started before signing in. Please
              review it, then continue to submission.
            </p>
          </div>
        )}


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
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
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
                  <span className="mx-0.5 h-px w-3 bg-border sm:w-5" aria-hidden />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
          {/* STEP 1 — Requester */}
          {step === 1 && (
            <div>
              <h2 className="font-display text-lg font-bold text-navy">
                Step 1 — Requester Information
              </h2>
              <div className="mt-5 grid gap-4">
                <Field label="Requester Type" required>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {REQUESTER_TYPES.map((t) => {
                      const active = draft.requesterType === t;
                      return (
                        <button
                          type="button"
                          key={t}
                          onClick={() => set("requesterType", t)}
                          className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
                            active
                              ? "border-marine bg-marine/10 text-navy shadow-soft"
                              : "border-border bg-background hover:bg-muted"
                          }`}
                        >
                          <span className="font-display font-bold">{t}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Full Name" required>
                  <input
                    className={inputClass}
                    value={draft.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                  />
                </Field>
                <Field label={isIndividual ? "Occupation" : "Position / Job Title"}>
                  <input
                    className={inputClass}
                    value={draft.position}
                    onChange={(e) => set("position", e.target.value)}
                  />
                </Field>
                <Field
                  label={isIndividual ? "Affiliation (optional)" : "Organization"}
                  required={!isIndividual}
                >
                  <input
                    className={inputClass}
                    value={draft.organization}
                    onChange={(e) => set("organization", e.target.value)}
                  />
                </Field>
                <Field label="Organization Type" required={!isIndividual}>
                  <select
                    className={inputClass}
                    value={draft.organizationType}
                    onChange={(e) => set("organizationType", e.target.value)}
                  >
                    <option value="">Select type…</option>
                    {ORGANIZATION_TYPES.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Country" required>
                  <input
                    className={inputClass}
                    value={draft.country}
                    onChange={(e) => set("country", e.target.value)}
                  />
                </Field>
                <Field label="Email" required>
                  <input
                    type="email"
                    className={inputClass}
                    value={draft.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </Field>
                <Field label="Phone Number">
                  <input
                    className={inputClass}
                    value={draft.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </Field>
                <Field label="Website (optional)">
                  <input
                    className={inputClass}
                    placeholder="https://"
                    value={draft.website}
                    onChange={(e) => set("website", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* STEP 2 — Training Need */}
          {step === 2 && (
            <div>
              <h2 className="font-display text-lg font-bold text-navy">Step 2 — Training Need</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Training Topic" required>
                  <input
                    className={inputClass}
                    value={draft.trainingTopic}
                    onChange={(e) => set("trainingTopic", e.target.value)}
                  />
                </Field>
                <Field label="Training Category" required>
                  <select
                    className={inputClass}
                    value={draft.trainingCategory}
                    onChange={(e) => set("trainingCategory", e.target.value)}
                  >
                    <option value="">Select category…</option>
                    {TRAINING_CATEGORIES.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="mt-4 grid gap-4">
                <Field label="Training Objectives" required>
                  <textarea
                    rows={2}
                    className={inputClass}
                    value={draft.objectives}
                    onChange={(e) => set("objectives", e.target.value)}
                  />
                </Field>
                <Field label="Describe your learning need / competency gap" required>
                  <textarea
                    rows={3}
                    className={inputClass}
                    value={draft.needs}
                    onChange={(e) => set("needs", e.target.value)}
                  />
                </Field>
                <Field label="Expected Learning Outcomes">
                  <textarea
                    rows={2}
                    className={inputClass}
                    value={draft.outcomes}
                    onChange={(e) => set("outcomes", e.target.value)}
                  />
                </Field>
                <Field label="Current challenges you or your organization face">
                  <textarea
                    rows={2}
                    className={inputClass}
                    value={draft.challenges}
                    onChange={(e) => set("challenges", e.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Current Competency" required>
                  <select
                    className={inputClass}
                    value={draft.currentCompetencyLevel}
                    onChange={(e) => set("currentCompetencyLevel", e.target.value)}
                  >
                    <option value="">Select…</option>
                    {COMPETENCY_LEVELS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Desired Competency" required>
                  <select
                    className={inputClass}
                    value={draft.desiredCompetencyLevel}
                    onChange={(e) => set("desiredCompetencyLevel", e.target.value)}
                  >
                    <option value="">Select…</option>
                    {COMPETENCY_LEVELS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Urgency">
                  <select
                    className={inputClass}
                    value={draft.urgency}
                    onChange={(e) => set("urgency", e.target.value)}
                  >
                    {URGENCY_LEVELS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="mt-4">
                <Field
                  label="Supporting explanation (optional)"
                  hint="Add any context that helps BARUNA understand the significance of this need."
                >
                  <textarea
                    rows={2}
                    className={inputClass}
                    value={draft.supportingExplanation}
                    onChange={(e) => set("supportingExplanation", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* STEP 3 — Learner / Participants */}
          {step === 3 && (
            <div>
              <h2 className="font-display text-lg font-bold text-navy">
                Step 3 — {isIndividual ? "Learner Profile" : "Target Participants"}
              </h2>
              {isIndividual ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  We already captured your requester information. You can optionally add more
                  context about yourself as a learner.
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Describe who the training is intended for.
                </p>
              )}

              <div className="mt-5 grid gap-4">
                {!isIndividual && (
                  <Field label="Who is this training intended for?" required>
                    <select
                      className={inputClass}
                      value={draft.targetAudience}
                      onChange={(e) => set("targetAudience", e.target.value)}
                    >
                      <option value="">Select audience…</option>
                      {TARGET_AUDIENCES.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {!isIndividual && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Estimated number of participants">
                      <select
                        className={inputClass}
                        value={draft.participantCount}
                        onChange={(e) => set("participantCount", e.target.value)}
                      >
                        <option value="">Select range…</option>
                        {PARTICIPANT_COUNTS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Organizational level">
                      <input
                        className={inputClass}
                        placeholder="e.g. national, provincial, community"
                        value={draft.organizationalLevel}
                        onChange={(e) => set("organizationalLevel", e.target.value)}
                      />
                    </Field>
                  </div>
                )}
                <Field
                  label={isIndividual ? "About you as a learner" : "Participant profile"}
                  hint="Background, roles, prior experience, motivation."
                >
                  <textarea
                    rows={3}
                    className={inputClass}
                    value={draft.participantProfile}
                    onChange={(e) => set("participantProfile", e.target.value)}
                  />
                </Field>
                <Field label="Geographic context (optional)">
                  <input
                    className={inputClass}
                    placeholder="e.g. Coastal East Africa, West African EEZ"
                    value={draft.geographicContext}
                    onChange={(e) => set("geographicContext", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* STEP 4 — Preferred Learning Approach */}
          {step === 4 && (
            <div>
              <h2 className="font-display text-lg font-bold text-navy">
                Step 4 — Preferred Learning Approach
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose your preferred learning approach. BARUNA may recommend adjustments based on
                the Training Needs Analysis.
              </p>
              <div className="mt-5 grid gap-3">
                {LEARNING_APPROACHES.map((a) => {
                  const active = draft.preferredLearningApproach === a.key;
                  return (
                    <button
                      type="button"
                      key={a.key}
                      onClick={() => set("preferredLearningApproach", a.key)}
                      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                        active
                          ? "border-marine bg-marine/10 shadow-soft"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                          active ? "border-marine bg-marine text-marine-foreground" : "border-border"
                        }`}
                      >
                        {active && <Check className="h-3 w-3" />}
                      </span>
                      <span>
                        <span className="block font-display text-sm font-bold text-navy">
                          {a.label}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {a.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}


          {/* STEP 5 — Delivery, Funding & Support (conditional) */}
          {step === 5 && (
            <div>
              <h2 className="font-display text-lg font-bold text-navy">
                Step 5 — Delivery, Funding & Support
              </h2>

              {!showFacilitatedFields ? (
                <div className="mt-5 rounded-xl border border-eco-community/30 bg-eco-community/5 p-5">
                  <p className="font-display text-sm font-bold text-navy">
                    Self-Paced Learning selected
                  </p>
                  <p className="mt-2 text-sm text-foreground/80">
                    Because you chose Self-Paced Learning, no trainer, venue, travel,
                    accommodation, logistics, or facilitated-training funding details are required.
                    Your request may be submitted even when no matching Self-Paced Course currently
                    exists — it will be used as Training Needs Analysis input for future course
                    development. You may indicate a preference for No Participant Charge learning
                    in your remarks; final arrangements are confirmed after review.
                  </p>
                </div>

              ) : (
                <div className="mt-5 grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Preferred delivery">
                      <select
                        className={inputClass}
                        value={draft.deliveryPreference}
                        onChange={(e) => set("deliveryPreference", e.target.value)}
                      >
                        <option value="">Select…</option>
                        {PREFERRED_DELIVERY_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Attendance format">
                      <select
                        className={inputClass}
                        value={draft.attendanceFormat}
                        onChange={(e) => set("attendanceFormat", e.target.value)}
                      >
                        <option value="">Select…</option>
                        {ATTENDANCE_FORMATS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Preferred duration">
                      <select
                        className={inputClass}
                        value={draft.duration}
                        onChange={(e) => set("duration", e.target.value)}
                      >
                        <option value="">Select duration…</option>
                        {DURATIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Preferred training period">
                      <input
                        className={inputClass}
                        placeholder="e.g. September 2026"
                        value={draft.trainingPeriod}
                        onChange={(e) => set("trainingPeriod", e.target.value)}
                      />
                    </Field>
                    <Field label="Preferred language">
                      <select
                        className={inputClass}
                        value={draft.language}
                        onChange={(e) => set("language", e.target.value)}
                      >
                        {LANGUAGES.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Training Location" hint="Set automatically from the attendance format above.">
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground/80">
                        <MapPin className="h-4 w-4 shrink-0 text-marine" />
                        <span>{locationSummary}</span>
                      </div>
                    </Field>
                  </div>


                  <Field
                    label="Proposed Funding Source"
                    required
                    hint="Indicate how the requester expects the proposed training to be financed. This information is for analysis only and does not create a funding commitment by BARUNA."
                  >
                    <select
                      className={inputClass}
                      value={draft.fundingPreference}
                      onChange={(e) => set("fundingPreference", e.target.value)}
                    >
                      <option value="">Select…</option>
                      {FUNDING_PREFERENCES.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </Field>


                  <div>
                    <p className={labelClass}>Support requested from BARUNA</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {SUPPORT_OPTIONS.map((o) => {
                        const checked = draft.supportRequested.includes(o);
                        return (
                          <label
                            key={o}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                              checked
                                ? "border-marine bg-marine/10 text-navy"
                                : "border-border hover:bg-muted"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-marine"
                              checked={checked}
                              onChange={() => toggleSupport(o)}
                            />
                            {o}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <Field
                    label="Requester's Existing or Proposed Partners"
                    hint="Optional. List institutions or partners that are already involved or proposed by the requester."
                  >
                    <input
                      className={inputClass}
                      value={draft.existingPartners}
                      onChange={(e) => set("existingPartners", e.target.value)}
                    />
                  </Field>

                  <Field label="Additional remarks">
                    <textarea
                      rows={3}
                      className={inputClass}
                      value={draft.remarks}
                      onChange={(e) => set("remarks", e.target.value)}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          {/* STEP 6 — Review */}
          {step === 6 && (
            <div>
              <h2 className="font-display text-lg font-bold text-navy">Step 6 — Review & Submit</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Please review your training request before submitting.
              </p>
              <div className="mt-5 space-y-5">
                <ReviewBlock
                  title="Requester"
                  rows={[
                    ["Requester Type", draft.requesterType],
                    ["Full Name", draft.fullName],
                    ["Position", draft.position],
                    ["Organization", draft.organization],
                    ["Organization Type", draft.organizationType],
                    ["Country", draft.country],
                    ["Email", draft.email],
                    ["Phone", draft.phone],
                    ["Website", draft.website],
                  ]}
                />
                <ReviewBlock
                  title="Training Need"
                  rows={[
                    ["Training Topic", draft.trainingTopic],
                    ["Category", draft.trainingCategory],
                    ["Objectives", draft.objectives],
                    ["Learning Need / Gap", draft.needs],
                    ["Expected Outcomes", draft.outcomes],
                    ["Current Challenges", draft.challenges],
                    ["Current Competency", draft.currentCompetencyLevel],
                    ["Desired Competency", draft.desiredCompetencyLevel],
                    ["Urgency", draft.urgency],
                  ]}
                />
                <ReviewBlock
                  title={isIndividual ? "Learner Profile" : "Participants"}
                  rows={[
                    ...(isIndividual
                      ? ([] as [string, string][])
                      : ([
                          ["Intended For", draft.targetAudience],
                          ["Estimated Number", draft.participantCount],
                          ["Organizational Level", draft.organizationalLevel],
                        ] as [string, string][])),
                    ["Profile", draft.participantProfile],
                    ["Geographic Context", draft.geographicContext],
                  ]}
                />
                <ReviewBlock
                  title="Preferred Learning Approach"
                  rows={[
                    [
                      "Approach",
                      LEARNING_APPROACHES.find((a) => a.key === draft.preferredLearningApproach)
                        ?.label ?? "",
                    ],
                  ]}
                />
                {showFacilitatedFields && (
                  <ReviewBlock
                    title="Delivery, Funding & Support"
                    rows={[
                      ["Preferred Delivery", draft.deliveryPreference],
                      ["Attendance Format", draft.attendanceFormat],
                      ["Duration", draft.duration],
                      ["Training Period", draft.trainingPeriod],
                      ["Language", draft.language],
                      ...locationRows,
                      ["Proposed Funding Source", draft.fundingPreference],
                      ["Support Requested", draft.supportRequested.join(", ")],
                      ["Requester's Existing or Proposed Partners", draft.existingPartners],
                      ["Additional Remarks", draft.remarks],
                    ]}
                  />
                )}
                {approach === "self_paced" && (
                  <ReviewBlock
                    title="Delivery, Funding & Support"
                    rows={[
                      ["Training Location", "Not Applicable"],
                      ["Facilitated Training Details", "Not Required"],
                    ]}
                  />
                )}
              </div>

              {/* Training Location notice — only when an in-person component applies */}
              {showVenueNotice && (
                <div className="mt-6 rounded-xl border border-marine/20 bg-marine/5 p-4">
                  <div className="flex items-start gap-3">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-marine" />
                    <div>
                      <p className="font-display text-sm font-bold text-navy">
                        Training Location Information
                      </p>
                      <p className="mt-1 text-sm text-foreground/80">
                        Classroom, technical-practice, and other in-person components of BARUNA
                        training are conducted in <strong>Denpasar, Bali, Indonesia</strong>.
                        Schedule, participant arrangements, travel, accommodation, and applicable
                        funding arrangements will be confirmed after the request has been reviewed.
                      </p>
                    </div>
                  </div>
                </div>
              )}


            </div>
          )}


          {error && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}

          {/* Nav buttons */}
          <div className="mt-7 flex items-center justify-between border-t border-border pt-5">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 1 || busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            {step < 6 ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Submitting…" : "Submit Training Request"} <Check className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ReviewBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="font-display text-sm font-bold text-navy">{title}</p>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">
              {label}
            </dt>
            <dd className="text-sm text-foreground/90">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
