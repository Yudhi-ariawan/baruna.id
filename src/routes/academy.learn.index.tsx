import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronRight,
  ArrowRight,
  GraduationCap,
  PlayCircle,
  BookOpen,
  CheckCircle2,
  Award,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import {
  useApplications,
  getLms,
  moduleQuizzesPassed,
  isCourseComplete,
  formatDate,
  type Application,
} from "@/lib/application";
import { LMS_MODULES } from "@/data/lms";
import { useAza, overallProgress as azaOverallProgress, accessDaysRemaining } from "@/lib/aza";
import { AZA_META, AZA_MODULES, AZA_PASS_MARK } from "@/data/aza";

export const Route = createFileRoute("/academy/learn/")({
  head: () => ({
    meta: [
      { title: "My Learning — Academy — BARUNA" },
      { name: "description", content: "Access your enrolled BARUNA Academy training programs and learning activities." },
    ],
  }),
  component: MyLearning,
});

function learningProgress(app: Application): number {
  const lms = getLms(app);
  const totalSteps = LMS_MODULES.length + 3; // modules + pre-test, post-test, final exam
  let done = moduleQuizzesPassed(app);
  if (lms.preTest) done += 1;
  if (lms.postTest) done += 1;
  if (lms.finalExam) done += 1;
  return Math.min(100, Math.round((done / totalSteps) * 100));
}

function MyLearning() {
  const apps = useApplications();
  const enrolled = apps.filter((a) => a.status === "Accepted");
  const [aza] = useAza();
  const azaEnrolled = aza.enrolled;
  const azaProgress = azaOverallProgress(aza);
  const azaDaysLeft = accessDaysRemaining(aza);
  const azaComplete = aza.certificate.status === "Issued";
  const azaCurrentModule =
    AZA_MODULES.filter((m) => m.no > 0).find(
      (m) => (aza.quizzes[m.no]?.percent ?? 0) < AZA_PASS_MARK,
    ) ?? null;
  const hasAny = enrolled.length > 0 || azaEnrolled;

  return (
    <AcademyShell active="my-learning">
      <div className="space-y-6">
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy">My Learning</span>
        </nav>

        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">My Learning</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your enrolled and accepted training programs. Continue your learning activities, modules and assessments here.
          </p>
        </div>

        {!hasAny ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-soft">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
              <GraduationCap className="h-7 w-7" />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-navy">No enrolled programs yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Once a training application is accepted, the program will appear here so you can start learning.
            </p>
            <Link
              to="/academy/applications"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90"
            >
              View My Applications <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {enrolled.map((app) => {
              const progress = learningProgress(app);
              const complete = isCourseComplete(app);
              return (
                <article key={app.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
                        <BookOpen className="h-5 w-5" />
                      </span>
                      <div>
                        <Link
                          to="/academy/learn/$id"
                          params={{ id: app.id }}
                          className="font-display text-lg font-bold text-navy transition-colors hover:text-marine"
                        >
                          {app.title}
                        </Link>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">Enrolled {formatDate(app.createdAt)}</span>
                          {complete ? (
                            <span className="inline-flex items-center gap-1.5 font-semibold text-badge-training">
                              <Award className="h-3.5 w-3.5" /> Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-semibold text-marine">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Enrolled
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">Course progress</span>
                      <span className="text-marine">{progress}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-marine transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Link
                      to="/academy/learn/$id"
                      params={{ id: app.id }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90"
                    >
                      <PlayCircle className="h-4 w-4" /> {complete ? "Review Training" : "Continue Learning"}
                    </Link>
                  </div>
                </article>
              );
            })}

            {azaEnrolled && (
              <article className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
                      <BookOpen className="h-5 w-5" />
                    </span>
                    <div>
                      <Link
                        to="/academy/learn/allocated-zones-for-aquaculture"
                        className="font-display text-lg font-bold text-navy transition-colors hover:text-marine"
                      >
                        {AZA_META.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        <span>
                          Enrolled {aza.enrolledAt ? formatDate(aza.enrolledAt) : "—"}
                        </span>
                        {azaDaysLeft !== null && (
                          <span>{azaDaysLeft} days access left</span>
                        )}
                        {azaComplete ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-badge-training">
                            <Award className="h-3.5 w-3.5" /> Completed · Certificate {aza.certificate.number}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-marine">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Self-Paced
                          </span>
                        )}
                      </div>
                      {!azaComplete && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Current:{" "}
                          <span className="font-semibold text-navy">
                            {azaCurrentModule
                              ? `Module ${azaCurrentModule.no} — ${azaCurrentModule.title}`
                              : "Final project & post-test"}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Course progress</span>
                    <span className="text-marine">{azaProgress}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-marine transition-all"
                      style={{ width: `${azaProgress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Link
                    to="/academy/learn/allocated-zones-for-aquaculture"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90"
                  >
                    <PlayCircle className="h-4 w-4" /> {azaComplete ? "Review Training" : "Continue Learning"}
                  </Link>
                </div>
              </article>
            )}
          </div>
        )}
      </div>
    </AcademyShell>
  );
}
