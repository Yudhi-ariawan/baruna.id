import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ChevronRight,
  CheckCircle2,
  Circle,
  Lock,
  PartyPopper,
  Download,
  PlayCircle,
  BookOpen,
  Flag,
  ClipboardList,
  Layers,
  Award,
  Share2,
  GraduationCap,
  CalendarDays,
  Hash,
  ArrowRight,
  Check,
  ChevronUp,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { Toaster } from "@/components/baruna/Toaster";

import { TravelVisaPrep } from "@/components/baruna/academy/TravelVisaPrep";
import { InPersonTraining } from "@/components/baruna/academy/InPersonTraining";
import { DemoModeBar } from "@/components/baruna/academy/DemoModeBar";
import { useDemoMode } from "@/lib/demoMode";
import { downloadPdf, barunaToast } from "@/lib/downloads";
import { trainingBySlug } from "@/data/training";
import {
  useApplication,
  updateApplication,
  advanceStatus,
  APP_STATUSES,
  type AppStatus,
  LEARNING_SECTIONS,
  DOCUMENT_FIELDS,
  formatDate,
  getLms,
  actionPlanSubmitted,
  reflectionSubmitted,
  knowledgeSharingSubmitted,
  isCourseComplete,
  eLearningComplete,
  inPersonComplete,
} from "@/lib/application";

export const Route = createFileRoute("/academy/applications/$id")({
  loader: ({ params }) => ({ id: params.id }),
  head: () => ({
    meta: [
      { title: "Application Status — Academy — BARUNA" },
      {
        name: "description",
        content: "View your BARUNA Academy training application status and learning journey.",
      },
    ],
  }),
  notFoundComponent: () => (
    <AcademyShell active="my-applications">
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">Application not found</h1>
        <Link
          to="/academy/applications"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground"
        >
          Back to My Applications <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </AcademyShell>
  ),
  component: ApplicationDetail,
});

const TABS = [
  "Status",
  "My Learning",
  "Travel, Logistics & Participant Information",
  "In-Person Training",
  "Post-Course",
  "Certificate",
] as const;
type Tab = (typeof TABS)[number];

const statusTone: Record<AppStatus, string> = {
  Submitted: "bg-marine/10 text-marine",
  "Under Review": "bg-star/25 text-accent",
  Shortlisted: "bg-badge-webinar/30 text-navy",
  Accepted: "bg-badge-training/20 text-badge-training",
  Rejected: "bg-destructive/10 text-destructive",
};

const learningIcons = [PlayCircle, BookOpen, Flag, ClipboardList, Layers];

function ApplicationDetail() {
  const { id } = Route.useLoaderData() as { id: string };
  const app = useApplication(id);
  const [tab, setTab] = useState<Tab>("Status");
  const [demo] = useDemoMode();

  if (!app) {
    // Client-side: not found after store load
    throw notFound();
  }

  const program = trainingBySlug[app.slug];
  const accepted = app.status === "Accepted";
  // Real participant state — used for accurate status display.
  const confirmedReal = app.participationConfirmed;
  // Demo Mode relaxes navigation locks only; it never changes stored progress.
  const confirmed = confirmedReal || demo;
  const learnDone = Object.values(app.learning).filter(Boolean).length;
  const learnTotal = LEARNING_SECTIONS.length;
  const learningComplete = learnDone === learnTotal;
  const postDone =
    (actionPlanSubmitted(app) ? 1 : 0) +
    (reflectionSubmitted(app) ? 1 : 0) +
    (knowledgeSharingSubmitted(app) ? 1 : 0);
  const postTotal = 3;
  const postComplete = postDone === postTotal;
  const certificateUnlocked = isCourseComplete(app) || demo;
  const eLearningDone = eLearningComplete(app) || demo;
  const inPersonDone = inPersonComplete(app) || demo;

  const tabLocked = (t: Tab): boolean => {
    if (demo) return false; // Demo Mode: all phases accessible for presentation
    if (t === "Status") return false;
    if (t === "Certificate") return !certificateUnlocked;
    if (t === "In-Person Training") return !eLearningDone;
    if (t === "Post-Course") return !inPersonDone;
    return !confirmed;
  };

  const confirmParticipation = () => {
    updateApplication(id, { participationConfirmed: true });
    barunaToast("Participation confirmed — pre-course learning unlocked");
    setTab("My Learning");
  };

  const toggleLearning = (key: string) => {
    updateApplication(id, { learning: { ...app.learning, [key]: !app.learning[key] } });
  };

  const lms = getLms(app);
  const postItems = [
    { label: "Action Plan", done: actionPlanSubmitted(app), detail: lms.actionPlan.status },
    { label: "Reflection Paper", done: reflectionSubmitted(app), detail: lms.reflection.status },
    {
      label: "Knowledge Sharing Report",
      done: knowledgeSharingSubmitted(app),
      detail: lms.knowledgeSharing.status,
    },
  ];

  const downloadAcceptance = () =>
    downloadPdf("baruna-acceptance-letter.pdf", "Letter of Acceptance", [
      "BARUNA Academy",
      "",
      `Dear ${app.personal.fullName},`,
      "",
      `We are pleased to inform you that you have been selected to participate in:`,
      app.title,
      "",
      `Application ID: ${app.id}`,
      `Organization: ${app.professional.organization}`,
      `Country: ${app.professional.country}`,
      "",
      "Please confirm your participation through the BARUNA Academy portal.",
      "",
      "Warm regards,",
      "BARUNA Academy Program Office",
    ]);

  const downloadCertificate = () =>
    downloadPdf("baruna-certificate.pdf", "Certificate of Completion", [
      "BARUNA Academy",
      "",
      "This certifies that",
      app.personal.fullName,
      "",
      "has successfully completed",
      app.title,
      "",
      "Blended Training · September–October 2026",
      `Application ID: ${app.id}`,
    ]);

  const downloadTranscript = () =>
    downloadPdf("baruna-transcript.pdf", "Academic Transcript", [
      `Participant: ${app.personal.fullName}`,
      `Program: ${app.title}`,
      "",
      ...(program?.curriculum.map((m) => `${m.no}. ${m.module} — ${m.hours}h — Completed`) ?? []),
    ]);

  return (
    <AcademyShell active="my-applications">
      <Toaster />
      <div className="space-y-6">
        <DemoModeBar />
        <nav
          className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
          aria-label="Breadcrumb"
        >
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">
            Academy
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            to="/academy/applications"
            className="font-medium text-foreground/70 hover:text-marine"
          >
            My Applications
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy">{app.id}</span>
        </nav>

        {/* Header card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
                <GraduationCap className="h-6 w-6" />
              </span>
              <div>
                <h1 className="font-display text-xl font-bold text-navy">{app.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-marine/70" /> Applied{" "}
                    {formatDate(app.createdAt)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-marine/70" /> {app.id}
                  </span>
                </div>
              </div>
            </div>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-bold ${statusTone[app.status]}`}
            >
              {app.status}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => {
            const locked = tabLocked(t);
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === t
                    ? "border-marine bg-marine/5 text-marine"
                    : "border-border bg-card text-navy hover:border-marine/40"
                }`}
              >
                {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                {t}
              </button>
            );
          })}
        </div>

        {/* ── STATUS ── */}
        {tab === "Status" && (
          <div className="space-y-6">
            {/* Progress tracker (vertical) */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold text-navy">Status Progress Tracker</h2>
              {app.status === "Rejected" ? (
                <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-sm font-bold text-destructive">Application Not Selected</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Unfortunately your application was not selected this round. We encourage you to
                    apply to future programs.
                  </p>
                </div>
              ) : (
                <ol className="mt-5 space-y-0">
                  {APP_STATUSES.map((s, i) => {
                    const reached = i <= (APP_STATUSES as readonly string[]).indexOf(app.status);
                    const current = s === app.status;
                    return (
                      <li key={s} className="relative flex gap-3 pb-6 last:pb-0">
                        {i < APP_STATUSES.length - 1 && (
                          <span
                            className={`absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px ${reached ? "bg-marine" : "bg-border"}`}
                            aria-hidden
                          />
                        )}
                        <span
                          className={`z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ${reached ? "bg-marine text-marine-foreground" : "bg-muted text-muted-foreground"}`}
                        >
                          {reached ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Circle className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <div className="pt-1">
                          <p
                            className={`text-sm font-bold ${reached ? "text-navy" : "text-muted-foreground"}`}
                          >
                            {s}
                          </p>
                          {current && (
                            <p className="text-xs font-medium text-marine">Current status</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              {app.status !== "Accepted" && app.status !== "Rejected" && (
                <div className="mt-4 rounded-xl border border-dashed border-border bg-background p-4">
                  <p className="text-xs text-muted-foreground">
                    Your application is being processed by the selection committee. You will be
                    notified when the status changes.
                  </p>
                  <button
                    onClick={() => advanceStatus(app.id)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-marine bg-card px-3.5 py-2 text-xs font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                  >
                    Simulate next status (demo) <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Acceptance stage */}
            {accepted && !confirmedReal && (
              <div className="rounded-2xl border border-marine/30 bg-marine/5 p-6 text-center shadow-soft sm:p-8">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-marine/15 text-marine">
                  <PartyPopper className="h-8 w-8" />
                </span>
                <h2 className="mt-5 font-display text-2xl font-bold text-navy">Congratulations!</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  You have been selected to participate in
                </p>
                <p className="mt-1 font-display text-base font-bold text-navy">{app.title}</p>
                <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    onClick={confirmParticipation}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-marine px-6 py-3 text-sm font-semibold text-marine-foreground transition-all hover:-translate-y-0.5 hover:bg-marine/90 hover:shadow-hover"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Confirm Participation
                  </button>
                  <button
                    onClick={downloadAcceptance}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-marine bg-card px-6 py-3 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                  >
                    <Download className="h-4 w-4" /> Download Acceptance Letter
                  </button>
                </div>
              </div>
            )}

            {accepted && confirmedReal && (
              <div className="rounded-2xl border border-badge-training/30 bg-badge-training/10 p-5">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-badge-training" />
                  <p className="text-sm font-semibold text-navy">
                    Participation confirmed. Your pre-course learning, travel and post-course tabs
                    are now unlocked.
                  </p>
                </div>
              </div>
            )}

            {/* Submitted documents */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold text-navy">Submitted Documents</h2>
              <ul className="mt-3 space-y-2">
                {DOCUMENT_FIELDS.map((d) => {
                  const meta = app.documents[d.key];
                  return (
                    <li key={d.key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-navy">{d.label}</span>
                      {meta ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-marine">
                          <CheckCircle2 className="h-4 w-4" /> {meta.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Circle className="h-4 w-4" /> Not provided
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* ── MY LEARNING ── */}
        {tab === "My Learning" &&
          (confirmed ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-marine/30 bg-marine/5 p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-marine/15 text-marine">
                    <GraduationCap className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="font-display text-base font-bold text-navy">
                      Open your Learning Dashboard
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Access all 13 modules, assessments, assignments and your certificate in the
                      full LMS.
                    </p>
                  </div>
                </div>
                <Link
                  to="/academy/learn/$id"
                  params={{ id }}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-all hover:-translate-y-0.5 hover:bg-marine/90 hover:shadow-hover"
                >
                  Open My Learning <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-bold text-navy">Pre-Course Learning</h2>
                  <span className="text-sm font-semibold text-marine">
                    {learnDone}/{learnTotal} completed
                  </span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-marine transition-all"
                    style={{ width: `${(learnDone / learnTotal) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                {LEARNING_SECTIONS.map((s, i) => {
                  const Icon = learningIcons[i] ?? BookOpen;
                  const done = app.learning[s.key];
                  return (
                    <div
                      key={s.key}
                      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft"
                    >
                      <span
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${done ? "bg-marine/10 text-marine" : "bg-muted text-muted-foreground"}`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-navy">{s.label}</p>
                        <p className="text-xs text-muted-foreground">{s.desc}</p>
                      </div>
                      <button
                        onClick={() => toggleLearning(s.key)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                          done
                            ? "border-marine bg-marine text-marine-foreground"
                            : "border-marine bg-card text-marine hover:bg-marine hover:text-marine-foreground"
                        }`}
                      >
                        {done ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> Completed
                          </>
                        ) : (
                          "Mark complete"
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {learningComplete && (
                <div className="rounded-2xl border border-badge-training/30 bg-badge-training/10 p-5">
                  <p className="flex items-center gap-2.5 text-sm font-semibold text-navy">
                    <CheckCircle2 className="h-5 w-5 text-badge-training" /> Pre-course learning
                    complete. Great work!
                  </p>
                </div>
              )}
            </div>
          ) : (
            <LockedPanel message="Confirm your participation after acceptance to unlock pre-course learning." />
          ))}

        {/* ── TRAVEL, LOGISTICS & PARTICIPANT INFORMATION ── */}
        {tab === "Travel, Logistics & Participant Information" &&
          (confirmed ? (
            <TravelVisaPrep app={app} id={id} />
          ) : (
            <LockedPanel message="Confirm your participation after acceptance to access travel, logistics & participant information." />
          ))}

        {/* ── IN-PERSON TRAINING ── */}
        {tab === "In-Person Training" &&
          (eLearningDone ? (
            <InPersonTraining app={app} id={id} />
          ) : (
            <LockedPanel message="Complete all e-learning requirements to unlock the In-Person Training phase." />
          ))}

        {/* ── POST-COURSE ── */}
        {tab === "Post-Course" &&
          (inPersonDone ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-bold text-navy">Post-Course Progress</h2>
                  <span className="text-sm font-semibold text-marine">
                    {postDone}/{postTotal} completed
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  These assignments are submitted from{" "}
                  <span className="font-semibold text-navy">My Learning → Assignments</span>. This
                  dashboard reflects the same records.
                </p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-marine transition-all"
                    style={{ width: `${(postDone / postTotal) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                {postItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft"
                  >
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${item.done ? "bg-badge-training/15 text-badge-training" : "bg-muted text-muted-foreground"}`}
                    >
                      {item.done ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-navy">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${item.done ? "bg-badge-training/15 text-badge-training" : "bg-muted text-muted-foreground"}`}
                    >
                      {item.done ? "Submitted" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>

              <Link
                to="/academy/learn/$id"
                params={{ id }}
                className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-all hover:-translate-y-0.5 hover:bg-marine/90 hover:shadow-hover"
              >
                Go to Assignments <ArrowRight className="h-4 w-4" />
              </Link>

              {postComplete && (
                <div className="rounded-2xl border border-badge-training/30 bg-badge-training/10 p-5">
                  <p className="flex items-center gap-2.5 text-sm font-semibold text-navy">
                    <CheckCircle2 className="h-5 w-5 text-badge-training" /> All post-course
                    assignments submitted.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <LockedPanel message="Complete the In-Person Training phase in Bali to unlock Post-Course assignments." />
          ))}

        {/* ── CERTIFICATE ── */}
        {tab === "Certificate" &&
          (certificateUnlocked ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft sm:p-10">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-marine/10 text-marine">
                <Award className="h-8 w-8" />
              </span>
              <h2 className="mt-5 font-display text-2xl font-bold text-navy">Course Completed</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Congratulations on completing {app.title}. Download your credentials below.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  onClick={downloadCertificate}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-all hover:-translate-y-0.5 hover:bg-marine/90 hover:shadow-hover"
                >
                  <Download className="h-4 w-4" /> Download Certificate
                </button>
                <button
                  onClick={downloadTranscript}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-marine bg-card px-5 py-3 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                >
                  <Download className="h-4 w-4" /> Download Transcript
                </button>
                <button
                  onClick={() => barunaToast("Digital badge link copied to clipboard")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-navy transition-colors hover:border-marine/40"
                >
                  <Share2 className="h-4 w-4" /> Share Digital Badge
                </button>
              </div>
            </div>
          ) : (
            <LockedPanel message="Complete pre-course learning and submit all post-course assignments to unlock your certificate." />
          ))}
      </div>
    </AcademyShell>
  );
}

function LockedPanel({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-soft">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
        <Lock className="h-7 w-7" />
      </span>
      <h2 className="mt-4 font-display text-lg font-bold text-navy">Locked</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
