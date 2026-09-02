// ============================================================================
// BARUNA Shared Learning Dashboard — Phase 1 backend-backed
// ----------------------------------------------------------------------------
// Data source: Lovable Cloud (server functions + RLS).
// LocalStorage is NOT the source of truth for enrolment, progress, evaluation,
// or certificates. Everything reads from and writes to the backend.
// ============================================================================
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Compass,
  FileCheck2,
  FileText,
  Layers,
  ListChecks,
  Lock,
  MessageSquare,
  MonitorPlay,
  PenLine,
  Plane,
  ScrollText,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { menuLabel } from "@/lib/learning/menu";
import type { MenuItemId } from "@/lib/learning/templates";
import {
  useAuthUser,
  useEnrol,
  useEnrolmentDetail,
  useEligibility,
  useIssueCertificate,
  useMarkActivity,
  useRollback,
} from "@/lib/learning/useBackendEnrolment";
import { barunaToast } from "@/lib/downloads";
import { CompletionEvaluationSection } from "@/components/baruna/learning/CompletionEvaluationSection";

const MENU_ICONS: Partial<Record<MenuItemId, LucideIcon>> = {
  overview: Compass,
  journey: ListChecks,
  orientation: Sparkles,
  schedule: CalendarDays,
  announcements: MessageSquare,
  "pre-test": ClipboardCheck,
  modules: BookOpen,
  phases: Layers,
  "guided-practice": PenLine,
  "live-sessions": MonitorPlay,
  assignments: ClipboardList,
  evidence: FileCheck2,
  project: FileText,
  discussion: MessageSquare,
  "post-test": ClipboardCheck,
  "final-assessment": ClipboardCheck,
  "in-person": Users,
  travel: Plane,
  "expert-review": ScrollText,
  "assessor-review": ScrollText,
  resources: BookOpen,
  evaluation: PenLine,
  certificate: Award,
  alumni: Users,
  faq: MessageSquare,
};

const DEFAULT_MENU: MenuItemId[] = [
  "overview",
  "orientation",
  "modules",
  "evaluation",
  "certificate",
];

type OfferingWithModules = {
  id: string;
  offering_code: string;
  offering_title: string;
  learning_engine_version: string;
  cohort_name?: string | null;
  year?: number | null;
  status?: string | null;
  master_courses: { id: string; course_code: string; title: string; description: string | null };
  modules: { id: string; module_code: string; title: string; sequence: number }[];
};

export function LearningDashboard({ offering }: { offering: OfferingWithModules }) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthUser();
  const detailQ = useEnrolmentDetail(offering.offering_code);
  const enrolMut = useEnrol(offering.offering_code);
  const markMut = useMarkActivity(offering.offering_code);
  const certMut = useIssueCertificate();
  const rollbackMut = useRollback();

  const enrolment = detailQ.data?.enrolment ?? null;
  const progress = detailQ.data?.progress ?? [];
  const certificates = detailQ.data?.certificates ?? [];
  const eligibilityQ = useEligibility(enrolment?.id);

  const totalModules = offering.modules.length;
  const completedModuleIds = new Set(
    progress.filter((p) => p.status === "completed").map((p) => p.learning_activity_id),
  );
  const completedModules = offering.modules.filter((m) =>
    completedModuleIds.has(`module:${m.module_code}`),
  ).length;
  const progressPct = totalModules ? Math.round((completedModules / totalModules) * 100) : 0;

  const menu = DEFAULT_MENU;
  const [active, setActive] = useState<MenuItemId>("overview");

  const master = offering.master_courses;

  async function handleEnrol() {
    if (!user) {
      navigate({
        to: "/auth",
        search: { redirect: `/academy/course/${offering.offering_code}` },
      });
      return;
    }
    try {
      await enrolMut.mutateAsync();
      barunaToast("Enrolled — your progress is now saved to your account.");
    } catch (e) {
      barunaToast(e instanceof Error ? e.message : "Enrolment failed");
    }
  }

  async function handleMarkModule(moduleCode: string) {
    if (!enrolment) return;
    try {
      await markMut.mutateAsync({
        enrolmentId: enrolment.id,
        activityId: `module:${moduleCode}`,
        status: "completed",
      });
    } catch (e) {
      barunaToast(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function handleIssueCertificate() {
    if (!enrolment) return;
    try {
      const rec = await certMut.mutateAsync({
        enrolmentId: enrolment.id,
        certificateType: "completion",
      });
      barunaToast(`Certificate issued — ${rec.certificate_number}`);
    } catch (e) {
      barunaToast(e instanceof Error ? e.message : "Not eligible");
    }
  }

  async function handleRollback() {
    if (!enrolment) return;
    if (!window.confirm("Withdraw from this course? Your server records are preserved.")) return;
    try {
      await rollbackMut.mutateAsync({ enrolmentId: enrolment.id, reason: "participant_rollback" });
      barunaToast("Withdrawal recorded. Server data preserved.");
    } catch (e) {
      barunaToast(e instanceof Error ? e.message : "Rollback failed");
    }
  }

  const asideBlock = useMemo(
    () => (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Engine</div>
          <div className="mt-1 text-sm font-semibold text-navy">
            {offering.learning_engine_version === "shared_v1" ? "Shared v1 (backend)" : "Legacy"}
          </div>
          {offering.cohort_name && (
            <>
              <div className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">Cohort</div>
              <div className="mt-1 text-sm font-semibold text-navy">{offering.cohort_name}</div>
            </>
          )}
          {enrolment && (
            <>
              <div className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">Enrolled since</div>
              <div className="mt-1 text-sm font-semibold text-navy">
                {new Date(enrolment.enrolment_date).toLocaleDateString()}
              </div>
              <button
                onClick={handleRollback}
                className="mt-4 w-full rounded-xl border border-destructive/40 bg-card px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
              >
                Withdraw (preserves data)
              </button>
            </>
          )}
        </div>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offering, enrolment?.id, enrolment?.enrolment_date],
  );

  return (
    <AcademyShell active="my-learning" aside={asideBlock}>
      <div className="space-y-6">
        <header className="rounded-3xl border border-border bg-gradient-to-br from-marine/10 via-card to-card p-6 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-marine/15 px-2.5 py-1 font-semibold text-marine">
                  {offering.learning_engine_version === "shared_v1" ? "Shared Learning" : "Legacy"}
                </span>
                {offering.status && (
                  <span className="rounded-full bg-muted px-2.5 py-1 font-semibold text-foreground/70">
                    {offering.status}
                  </span>
                )}
              </div>
              <h1 className="mt-3 font-display text-2xl font-extrabold text-navy sm:text-3xl">
                {master.title}
              </h1>
              <p className="mt-2 text-sm font-medium text-foreground/80">{offering.offering_title}</p>
            </div>
            <div className="min-w-[240px] rounded-2xl border border-border bg-card p-4 text-center shadow-soft">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Progress</div>
              <div className="mt-1 text-3xl font-extrabold text-marine">{progressPct}%</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {completedModules} of {totalModules} modules
              </div>
              {authLoading || detailQ.isLoading ? (
                <div className="mt-3 text-xs text-muted-foreground">Loading…</div>
              ) : !user ? (
                <Link
                  to="/auth"
                  search={{ redirect: `/academy/course/${offering.offering_code}` }}
                  className="mt-3 block w-full rounded-xl bg-marine px-3 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-marine/90"
                >
                  Sign in to enrol
                </Link>
              ) : !enrolment ? (
                <button
                  onClick={handleEnrol}
                  disabled={enrolMut.isPending}
                  className="mt-3 w-full rounded-xl bg-marine px-3 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-marine/90 disabled:opacity-60"
                >
                  {enrolMut.isPending ? "Enrolling…" : "Enrol"}
                </button>
              ) : (
                <div className="mt-3 rounded-xl bg-eco-community/15 px-3 py-2 text-xs font-semibold text-eco-community">
                  Enrolled
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <nav
            aria-label="Course sections"
            className="rounded-2xl border border-border bg-card p-2 shadow-soft"
          >
            <ul className="space-y-1">
              {menu.map((id) => {
                const Icon = MENU_ICONS[id] ?? BookOpen;
                const isActive = id === active;
                return (
                  <li key={id}>
                    <button
                      onClick={() => setActive(id)}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                        isActive
                          ? "bg-marine text-white shadow-soft"
                          : "text-foreground/80 hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{menuLabel(id)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <section className="min-w-0 rounded-2xl border border-border bg-card p-6 shadow-soft">
            {!user ? (
              <SignInPrompt offeringCode={offering.offering_code} />
            ) : !enrolment && active !== "overview" ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Lock className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Enrol to unlock this section.</p>
              </div>
            ) : active === "overview" ? (
              <OverviewSection offering={offering} />
            ) : active === "orientation" ? (
              <SimpleActivity
                title="Orientation"
                body="Welcome. Review the course objectives before starting the first module."
                completed={completedModuleIds.has("orientation")}
                onMark={() => {
                  if (!enrolment) return Promise.resolve();
                  return markMut.mutateAsync({
                    enrolmentId: enrolment.id,
                    activityId: "orientation",
                    status: "completed",
                  });
                }}
              />
            ) : active === "modules" || active === "phases" ? (
              <ModulesSection
                modules={offering.modules}
                completedIds={completedModuleIds}
                onMarkComplete={handleMarkModule}
                busy={markMut.isPending}
              />
            ) : active === "evaluation" ? (
              <CompletionEvaluationSection enrolmentId={enrolment?.id} />

            ) : active === "certificate" ? (
              <div className="space-y-4">
                <h2 className="font-display text-xl font-bold text-navy">Certificate</h2>
                {certificates.length > 0 ? (
                  <div className="rounded-xl border border-marine/40 bg-marine/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-navy">
                      <Award className="h-4 w-4 text-marine" />
                      Certificate of Completion
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">Serial</div>
                    <div className="font-mono text-sm text-navy">
                      {certificates[0].certificate_number}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">Verification</div>
                    <a
                      href={certificates[0].verification_reference}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-marine underline"
                    >
                      {certificates[0].verification_reference}
                    </a>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-border bg-background p-3 text-sm">
                      <div className="font-semibold text-navy">Eligibility check (server-side)</div>
                      {eligibilityQ.data ? (
                        eligibilityQ.data.eligible ? (
                          <div className="mt-1 text-eco-community">✓ Eligible</div>
                        ) : (
                          <div className="mt-1 text-muted-foreground">
                            Not yet eligible — {eligibilityQ.data.reason}
                          </div>
                        )
                      ) : (
                        <div className="mt-1 text-muted-foreground">Checking…</div>
                      )}
                    </div>
                    <button
                      onClick={handleIssueCertificate}
                      disabled={certMut.isPending}
                      className="rounded-xl bg-marine px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-marine/90 disabled:opacity-60"
                    >
                      {certMut.isPending ? "Issuing…" : "Issue certificate"}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                <p className="font-semibold text-navy">{menuLabel(active)}</p>
                <p className="mt-2">Section configured but no content in Phase 1.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </AcademyShell>
  );
}

function SignInPrompt({ offeringCode }: { offeringCode: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Lock className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Your progress is stored securely on your BARUNA account. Sign in to enrol and continue.
      </p>
      <Link
        to="/auth"
        search={{ redirect: `/academy/course/${offeringCode}` }}
        className="rounded-xl bg-marine px-4 py-2 text-sm font-semibold text-white shadow-soft"
      >
        Sign in
      </Link>
    </div>
  );
}

function OverviewSection({ offering }: { offering: OfferingWithModules }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-bold text-navy">About this course</h2>
      <p className="text-sm text-foreground/80">
        {offering.master_courses.description ?? "—"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <MetaCard label="Modules" value={String(offering.modules.length)} />
        <MetaCard label="Engine" value={offering.learning_engine_version} />
      </div>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-navy">{value}</div>
    </div>
  );
}

function SimpleActivity({
  title,
  body,
  completed,
  onMark,
}: {
  title: string;
  body: string;
  completed: boolean;
  onMark: () => Promise<unknown> | undefined;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-bold text-navy">{title}</h2>
      <p className="text-sm text-foreground/80">{body}</p>
      {completed ? (
        <div className="inline-flex items-center gap-2 rounded-xl bg-eco-community/15 px-3 py-2 text-xs font-semibold text-eco-community">
          <CheckCircle2 className="h-4 w-4" /> Completed
        </div>
      ) : (
        <button
          onClick={() => onMark()}
          className="rounded-xl bg-marine px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-marine/90"
        >
          Mark as complete
        </button>
      )}
    </div>
  );
}

function ModulesSection({
  modules,
  completedIds,
  onMarkComplete,
  busy,
}: {
  modules: OfferingWithModules["modules"];
  completedIds: Set<string>;
  onMarkComplete: (moduleCode: string) => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl font-bold text-navy">Learning modules</h2>
      <ul className="space-y-2">
        {modules.map((m) => {
          const done = completedIds.has(`module:${m.module_code}`);
          return (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-navy">
                  {m.sequence}. {m.title}
                </div>
                <div className="text-xs text-muted-foreground">{m.module_code}</div>
              </div>
              {done ? (
                <div className="rounded-xl bg-eco-community/15 px-3 py-1.5 text-xs font-semibold text-eco-community">
                  ✓ Completed
                </div>
              ) : (
                <button
                  onClick={() => onMarkComplete(m.module_code)}
                  disabled={busy}
                  className="rounded-xl border border-marine/40 bg-card px-3 py-1.5 text-xs font-semibold text-marine transition hover:bg-marine hover:text-white disabled:opacity-60"
                >
                  Mark complete
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
