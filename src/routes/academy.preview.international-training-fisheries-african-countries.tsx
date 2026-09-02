import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronRight,
  CheckCircle2,
  Circle,
  Check,
  Eye,
  GraduationCap,
  CalendarDays,
  Hash,
  ArrowLeft,
  PlayCircle,
  BookOpen,
  Flag,
  ClipboardList,
  Layers,
  Award,
  Download,
  Share2,
  Lock,
  Star,
  FileText,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { TravelVisaPrep } from "@/components/baruna/academy/TravelVisaPrep";
import { InPersonTraining } from "@/components/baruna/academy/InPersonTraining";
import { buildPreviewApplication, PREVIEW_SLUG } from "@/lib/previewApplication";
import {
  APP_STATUSES,
  LEARNING_SECTIONS,
  DOCUMENT_FIELDS,
  formatDate,
  getLms,
  getQuizRecord,
} from "@/lib/application";
import { LMS_MODULES } from "@/data/lms";

export const Route = createFileRoute(
  "/academy/preview/international-training-fisheries-african-countries",
)({
  head: () => ({
    meta: [
      { title: "Executive Preview — International Training on Fisheries — BARUNA" },
      {
        name: "description",
        content:
          "Executive Preview Mode — explore the complete participant journey of the International Training on Fisheries for African Countries in read-only mode.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExecutivePreview,
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

const learningIcons = [PlayCircle, BookOpen, Flag, ClipboardList, Layers];

/** Disabled overlay button used across the read-only preview. */
function PreviewButton({
  icon: Icon,
  children,
  primary,
}: {
  icon?: typeof Download;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled
      title="Disabled in Executive Preview"
      className={`inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold opacity-60 ${
        primary
          ? "bg-marine text-marine-foreground"
          : "border border-marine bg-card text-marine"
      }`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

/** Wrapper that makes any reused interactive component non-interactive. */
function ReadOnly({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none select-none" aria-label="Read-only preview content">
      {children}
    </div>
  );
}

function ExecutivePreview() {
  const app = useMemo(() => buildPreviewApplication(), []);
  const [tab, setTab] = useState<Tab>("Status");
  const lms = getLms(app);

  const moduleStars = (id: string) => getQuizRecord(app, id).bestScore;

  return (
    <AcademyShell active="training">
      <div className="space-y-6">
        {/* Executive Preview banner */}
        <div className="flex flex-col gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/20 text-accent">
              <Eye className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-navy">Executive Preview Mode</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-accent-foreground">
                  <Eye className="h-3 w-3" /> Executive Preview
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Read-only walkthrough of the complete participant journey with sample data. No data
                can be changed — this does not affect any real user, application or record.
              </p>
            </div>
          </div>
          <Link
            to="/academy/training/$slug"
            params={{ slug: PREVIEW_SLUG }}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-marine bg-card px-4 py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Exit Preview
          </Link>
        </div>

        {/* Breadcrumb */}
        <nav
          className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
          aria-label="Breadcrumb"
        >
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">
            Academy
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            to="/academy/training/$slug"
            params={{ slug: PREVIEW_SLUG }}
            className="font-medium text-foreground/70 hover:text-marine"
          >
            Training
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy">Executive Preview</span>
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
                    <CalendarDays className="h-3.5 w-3.5 text-marine/70" /> Sample participant ·{" "}
                    {app.personal.fullName}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-marine/70" /> {app.id}
                  </span>
                </div>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full bg-badge-training/20 px-3 py-1 text-xs font-bold text-badge-training">
              {app.status}
            </span>
          </div>
        </div>

        {/* Tabs — all accessible immediately */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t
                  ? "border-marine bg-marine/5 text-marine"
                  : "border-border bg-card text-navy hover:border-marine/40"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── STATUS ── */}
        {tab === "Status" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold text-navy">Status Progress Tracker</h2>
              <ol className="mt-5 space-y-0">
                {APP_STATUSES.map((s, i) => (
                  <li key={s} className="relative flex gap-3 pb-6 last:pb-0">
                    {i < APP_STATUSES.length - 1 && (
                      <span
                        className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-marine"
                        aria-hidden
                      />
                    )}
                    <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-marine text-marine-foreground">
                      <Check className="h-4 w-4" />
                    </span>
                    <div className="pt-1">
                      <p className="text-sm font-bold text-navy">{s}</p>
                      {s === "Accepted" && (
                        <p className="text-xs font-medium text-marine">Current status</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border border-badge-training/30 bg-badge-training/10 p-5">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-badge-training" />
                <p className="text-sm font-semibold text-navy">
                  Participation confirmed. All learning, travel, in-person and post-course phases are
                  complete.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold text-navy">Submitted Documents</h2>
              <ul className="mt-3 space-y-2">
                {DOCUMENT_FIELDS.map((d) => {
                  const meta = app.documents[d.key];
                  return (
                    <li key={d.key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-navy">{d.label}</span>
                      <span className="inline-flex items-center gap-1.5 font-medium text-marine">
                        <CheckCircle2 className="h-4 w-4" /> {meta?.name}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* ── MY LEARNING ── */}
        {tab === "My Learning" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold text-navy">Course Progress</h2>
                <span className="text-sm font-semibold text-marine">100% completed</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-full rounded-full bg-marine" />
              </div>
            </div>

            {/* Pre-course sections */}
            <div className="space-y-3">
              {LEARNING_SECTIONS.map((s, i) => {
                const Icon = learningIcons[i] ?? BookOpen;
                return (
                  <div
                    key={s.key}
                    className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-navy">{s.label}</p>
                      <p className="text-xs text-muted-foreground">{s.desc}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-badge-training/15 px-3 py-1 text-xs font-semibold text-badge-training">
                      <Check className="h-3.5 w-3.5" /> Completed
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Assessments */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold text-navy">Assessments</h2>
              <ul className="mt-3 space-y-2">
                {[
                  { label: "Pre-Test", score: getQuizRecord(app, "preTest").bestScore },
                  { label: "Post-Test", score: getQuizRecord(app, "postTest").bestScore },
                  { label: "Final Examination", score: getQuizRecord(app, "finalExam").bestScore },
                ].map((a) => (
                  <li
                    key={a.label}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
                  >
                    <span className="font-semibold text-navy">{a.label}</span>
                    <span className="inline-flex items-center gap-2 font-medium text-badge-training">
                      <CheckCircle2 className="h-4 w-4" /> Passed · {a.score}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Completed modules + quizzes */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold text-navy">
                Completed Modules &amp; Quizzes
              </h2>
              <ul className="mt-3 divide-y divide-border">
                {LMS_MODULES.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-badge-training" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy">
                        {m.no}. {m.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.category}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-badge-training/15 px-3 py-1 text-xs font-bold text-badge-training">
                      Quiz {moduleStars(m.id)}%
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                {LMS_MODULES.length} of {LMS_MODULES.length} modules complete · all module quizzes
                passed.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <PreviewButton icon={PlayCircle} primary>
                Continue Learning
              </PreviewButton>
              <PreviewButton icon={Download}>Download Materials</PreviewButton>
            </div>
          </div>
        )}

        {/* ── TRAVEL ── (reused component, read-only) */}
        {tab === "Travel, Logistics & Participant Information" && (
          <ReadOnly>
            <TravelVisaPrep app={app} id={app.id} />
          </ReadOnly>
        )}

        {/* ── IN-PERSON TRAINING ── (reused component, read-only) */}
        {tab === "In-Person Training" && (
          <ReadOnly>
            <InPersonTraining app={app} id={app.id} />
          </ReadOnly>
        )}

        {/* ── POST-COURSE ── */}
        {tab === "Post-Course" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold text-navy">Post-Course Progress</h2>
                <span className="text-sm font-semibold text-marine">3/3 completed</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-full rounded-full bg-marine" />
              </div>
            </div>

            {[
              {
                label: "Action Plan",
                detail: lms.actionPlan.status,
                body: "A practical plan to introduce biofloc catfish production and value-added processing to cooperatives in Nigeria.",
              },
              {
                label: "Reflection Paper",
                detail: lms.reflection.status,
                body: lms.reflection.text,
              },
              {
                label: "Knowledge Sharing Report",
                detail: lms.knowledgeSharing.status,
                body: "Documented two community workshops delivered to 38 smallholder farmers on biofloc water-quality management.",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border bg-card p-5 shadow-soft"
              >
                <div className="flex items-start gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-badge-training/15 text-badge-training">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-navy">{item.label}</p>
                      <span className="shrink-0 rounded-full bg-badge-training/15 px-3 py-1 text-xs font-bold text-badge-training">
                        {item.detail}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-badge-training/30 bg-badge-training/10 p-5">
              <p className="flex items-center gap-2.5 text-sm font-semibold text-navy">
                <CheckCircle2 className="h-5 w-5 text-badge-training" /> All post-course assignments
                submitted and approved.
              </p>
            </div>
          </div>
        )}

        {/* ── CERTIFICATE ── */}
        {tab === "Certificate" && (
          <div className="space-y-6">
            {/* Certificate preview */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              <div className="border-b-4 border-double border-marine/40 bg-gradient-to-b from-marine/5 to-card p-8 text-center sm:p-12">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-marine/10 text-marine">
                  <Award className="h-7 w-7" />
                </span>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.3em] text-marine">
                  BARUNA Academy
                </p>
                <h2 className="mt-3 font-display text-2xl font-extrabold text-navy">
                  Certificate of Completion
                </h2>
                <p className="mt-4 text-sm text-muted-foreground">This is to certify that</p>
                <p className="mt-1 font-display text-xl font-bold text-navy">
                  {app.personal.fullName}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  has successfully completed the blended training program
                </p>
                <p className="mt-1 font-display text-base font-bold text-navy">{app.title}</p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <span>Blended Training · September–October 2026</span>
                  <span>Certificate ID: {app.id}</span>
                </div>
                <div className="mt-2 flex items-center justify-center gap-1 text-star">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-4 w-4 fill-current text-accent" />
                  ))}
                </div>
              </div>
              <div className="p-6 text-center">
                <h3 className="font-display text-lg font-bold text-navy">Course Completed</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  In the live experience, participants download their certificate, transcript and
                  share a verified digital badge here.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <PreviewButton icon={Download} primary>
                    Download Certificate
                  </PreviewButton>
                  <PreviewButton icon={Download}>Download Transcript</PreviewButton>
                  <PreviewButton icon={Share2}>Share Digital Badge</PreviewButton>
                </div>
                <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> Certificate generation is disabled in Executive
                  Preview.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AcademyShell>
  );
}
