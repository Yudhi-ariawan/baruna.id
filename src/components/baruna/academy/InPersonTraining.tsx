import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  CheckCircle2,
  Circle,
  XCircle,
  Clock,
  MapPin,
  CalendarDays,
  Users,
  Globe2,
  Languages,
  Building2,
  Plane,
  ClipboardCheck,
  CalendarCheck,
  UserCheck,
  Star,
  AlertTriangle,
  FileText,
  Award,
  Bus,
  type LucideIcon,
} from "lucide-react";
import { DocumentUploadRow } from "@/components/baruna/academy/DocumentUploadRow";
import { barunaToast } from "@/lib/downloads";
import {
  type Application,
  type InPersonPrep,
  type AttendanceStatus,
  type InPersonActionPlanStatus,
  type DocumentMeta,
  getInPerson,
  updateInPerson,
  TRAINING_DAYS,
  TRAINING_INFO,
  PARTICIPANT_DIRECTORY,
  GROUP_ASSIGNMENTS,
  FIELD_VISIT,
  INPERSON_EVALUATIONS,
  ATTENDANCE_STATUSES,
  INPERSON_ACTION_PLAN_STATUSES,
  attendancePresentCount,
  attendanceComplete,
  inPersonActionPlanPresented,
  trainingEvaluationComplete,
  inPersonComplete,
  inPersonPhaseStatus,
} from "@/lib/application";

const phaseTone: Record<string, string> = {
  "Eligible for In-Person Training": "bg-marine/10 text-marine",
  "Attendance Confirmed": "bg-badge-webinar/30 text-navy",
  "In-Person Training Completed": "bg-badge-training/20 text-badge-training",
};

const attendanceTone: Record<AttendanceStatus, string> = {
  Present: "bg-badge-training/15 text-badge-training",
  Absent: "bg-destructive/10 text-destructive",
  Pending: "bg-muted text-muted-foreground",
};

const actionPlanTone: Record<InPersonActionPlanStatus, string> = {
  "Not Started": "bg-muted text-muted-foreground",
  "Draft Submitted": "bg-star/25 text-accent",
  Presented: "bg-badge-webinar/30 text-navy",
  Approved: "bg-badge-training/20 text-badge-training",
};

export function InPersonTraining({ app, id }: { app: Application; id: string }) {
  const [ip, setIp] = useState<InPersonPrep>(() => getInPerson(app));

  useEffect(() => {
    setIp(getInPerson(app));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.id]);

  function commit(next: InPersonPrep) {
    setIp(next);
    updateInPerson(id, next);
  }

  const merged: Application = { ...app, inPerson: ip };
  const phase = inPersonPhaseStatus(merged);
  const presentCount = attendancePresentCount(merged);
  const attComplete = attendanceComplete(merged);
  const planPresented = inPersonActionPlanPresented(merged);
  const evalComplete = trainingEvaluationComplete(merged);
  const complete = inPersonComplete(merged);

  const confirmAttendance = () => {
    commit({ ...ip, attendanceConfirmed: "Confirmed" });
    barunaToast("Attendance confirmed for the In-Person Training in Bali");
  };
  const declineAttendance = () => {
    commit({ ...ip, attendanceConfirmed: "Unable to Attend" });
    barunaToast("We have recorded that you are unable to attend");
  };

  const setDay = (dayKey: string, status: AttendanceStatus) =>
    commit({ ...ip, attendance: { ...ip.attendance, [dayKey]: status } });

  const setPlanStatus = (status: InPersonActionPlanStatus) =>
    commit({ ...ip, actionPlan: { ...ip.actionPlan, status } });

  const onPlanUpload = (file: File | null) => {
    const meta: DocumentMeta | null = file
      ? { name: file.name, size: file.size, uploadedAt: new Date().toISOString() }
      : null;
    commit({
      ...ip,
      actionPlan: {
        meta,
        status: meta
          ? ip.actionPlan.status === "Not Started"
            ? "Draft Submitted"
            : ip.actionPlan.status
          : ip.actionPlan.status,
      },
    });
  };

  const setRating = (key: "course" | "instructor" | "venue", value: number) =>
    commit({ ...ip, evaluations: { ...ip.evaluations, [key]: value } });

  const completionItems = [
    {
      label: "Attendance Complete",
      detail: `${presentCount}/${TRAINING_DAYS.length} days present`,
      done: attComplete,
    },
    { label: "Action Plan Presented", detail: ip.actionPlan.status, done: planPresented },
    {
      label: "Training Evaluation Submitted",
      detail: evalComplete ? "All evaluations submitted" : "Pending",
      done: evalComplete,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="bg-navy p-6 text-navy-foreground">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-navy-foreground/10">
                <Plane className="h-6 w-6" />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">In-Person Training in Bali</h2>
                <p className="mt-1 text-sm text-navy-foreground/80">
                  Research Station for Tuna Fisheries
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-foreground/70">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Denpasar, Bali, Indonesia
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" /> 21–26 September 2026
                  </span>
                </div>
              </div>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${phaseTone[phase]}`}
            >
              {complete ? (
                <Award className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {phase}
            </span>
          </div>
        </div>
      </div>

      {/* Section 1 — Attendance Confirmation */}
      <SectionCard icon={UserCheck} step="1" title="Attendance Confirmation">
        {ip.attendanceConfirmed === "Confirmed" ? (
          <Banner tone="success" icon={CheckCircle2}>
            Attendance Status: Confirmed
          </Banner>
        ) : ip.attendanceConfirmed === "Unable to Attend" ? (
          <Banner tone="danger" icon={XCircle}>
            Attendance Status: Unable to Attend
          </Banner>
        ) : (
          <p className="text-sm text-muted-foreground">
            Please confirm whether you will attend the face-to-face training component in Bali.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={confirmAttendance}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
              ip.attendanceConfirmed === "Confirmed"
                ? "bg-badge-training text-navy-foreground"
                : "bg-marine text-marine-foreground hover:bg-marine/90"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" /> Confirm Attendance
          </button>
          <button
            onClick={declineAttendance}
            className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 bg-card px-5 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            <XCircle className="h-4 w-4" /> Unable to Attend
          </button>
        </div>
      </SectionCard>

      {/* Section 2 — Training Information */}
      <SectionCard icon={ClipboardCheck} step="2" title="Training Information">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          <InfoCell icon={Building2} label="Venue" value={TRAINING_INFO.venue} />
          <InfoCell icon={MapPin} label="Location" value={TRAINING_INFO.location} />
          <InfoCell icon={CalendarDays} label="Training Dates" value={TRAINING_INFO.dates} />
          <InfoCell icon={Clock} label="Duration" value={TRAINING_INFO.duration} />
          <InfoCell icon={Languages} label="Language" value={TRAINING_INFO.language} />
          <InfoCell icon={Users} label="Participants" value={TRAINING_INFO.participants} />
        </div>
      </SectionCard>

      {/* Section 3 — Daily Training Schedule */}
      <SectionCard icon={CalendarCheck} step="3" title="Daily Training Schedule">
        <ol className="space-y-0">
          {TRAINING_DAYS.map((d, i) => (
            <li key={d.day} className="relative flex gap-4 pb-6 last:pb-0">
              {i < TRAINING_DAYS.length - 1 && (
                <span
                  className="absolute left-[19px] top-10 h-[calc(100%-1.5rem)] w-px bg-border"
                  aria-hidden
                />
              )}
              <span className="z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-marine/10 font-display text-sm font-extrabold text-marine">
                {d.day}
              </span>
              <div className="min-w-0 flex-1 rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display text-sm font-bold text-navy">{d.label}</p>
                  <span className="text-xs font-medium text-muted-foreground">{d.date}</span>
                </div>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {d.sessions.map((s) => (
                    <li
                      key={s}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-marine/5 px-2.5 py-1 text-xs font-medium text-navy"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-marine" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </SectionCard>

      {/* Section 4 — Attendance Tracker */}
      <SectionCard icon={CalendarCheck} step="4" title="Attendance Tracker">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm font-semibold text-navy">Daily Attendance</p>
          <span className="font-display text-lg font-extrabold text-marine">
            Attendance: {presentCount}/{TRAINING_DAYS.length} Days
          </span>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-marine transition-all"
            style={{ width: `${(presentCount / TRAINING_DAYS.length) * 100}%` }}
          />
        </div>
        <div className="mt-4 space-y-2.5">
          {TRAINING_DAYS.map((d) => {
            const key = `day${d.day}`;
            const status = ip.attendance[key];
            return (
              <div
                key={key}
                className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${attendanceTone[status]}`}
                  >
                    {status}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-navy">{d.label}</p>
                    <p className="text-xs text-muted-foreground">{d.date}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ATTENDANCE_STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setDay(key, s)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        status === s
                          ? "border-marine bg-marine/5 text-marine"
                          : "border-border bg-card text-foreground/70 hover:border-marine/40"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Section 5 — Participant Directory */}
      <SectionCard icon={Globe2} step="5" title="Participant Directory">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="bg-muted/60 text-left text-xs font-bold uppercase tracking-wide text-foreground/70">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Participant Name</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Organization</th>
              </tr>
            </thead>
            <tbody>
              {PARTICIPANT_DIRECTORY.map((p, i) => (
                <tr key={p.name} className="border-t border-border hover:bg-muted/40">
                  <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold text-navy">{p.name}</td>
                  <td className="px-3 py-2 text-foreground/80">{p.country}</td>
                  <td className="px-3 py-2 text-foreground/80">{p.organization}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Section 6 — Group Assignment */}
      <SectionCard icon={Users} step="6" title="Group Assignment">
        <div className="grid gap-4 md:grid-cols-2">
          {GROUP_ASSIGNMENTS.map((g) => (
            <div key={g.group} className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-base font-bold text-navy">{g.group}</p>
                <span className="rounded-md bg-marine/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-marine">
                  {g.members.length} Members
                </span>
              </div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Facilitator
              </p>
              <p className="text-sm font-medium text-navy">{g.facilitator}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Discussion Topic
              </p>
              <p className="text-sm text-foreground/80">{g.topic}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Assigned Participants
              </p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {g.members.map((m) => (
                  <li
                    key={m}
                    className="rounded-md bg-marine/5 px-2 py-0.5 text-xs font-medium text-navy"
                  >
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Section 7 — Action Plan Presentation */}
      <SectionCard icon={FileText} step="7" title="Action Plan Presentation">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-destructive">
              Mandatory
            </span>
            <p className="text-sm text-muted-foreground">
              Submit and present your country action plan.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${actionPlanTone[ip.actionPlan.status]}`}
          >
            {ip.actionPlan.status}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-1">
          {INPERSON_ACTION_PLAN_STATUSES.map((s, i) => {
            const reached = i <= INPERSON_ACTION_PLAN_STATUSES.indexOf(ip.actionPlan.status);
            return (
              <div key={s} className="flex flex-1 items-center">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs ${reached ? "bg-marine text-marine-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {reached ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </span>
                {i < INPERSON_ACTION_PLAN_STATUSES.length - 1 && (
                  <span
                    className={`h-px flex-1 ${i < INPERSON_ACTION_PLAN_STATUSES.indexOf(ip.actionPlan.status) ? "bg-marine" : "bg-border"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[0.6rem] font-medium text-muted-foreground">
          {INPERSON_ACTION_PLAN_STATUSES.map((s) => (
            <span key={s} className="flex-1 text-center first:text-left last:text-right">
              {s}
            </span>
          ))}
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold text-navy">Upload Action Plan</p>
          <DocumentUploadRow
            field={{
              key: "actionPlan",
              label: "Action Plan",
              accept: ".pdf,.doc,.docx,.ppt,.pptx",
              hint: "PDF, DOCX or PPTX",
            }}
            meta={ip.actionPlan.meta}
            onChange={onPlanUpload}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {INPERSON_ACTION_PLAN_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setPlanStatus(s)}
              disabled={s !== "Not Started" && !ip.actionPlan.meta}
              className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                ip.actionPlan.status === s
                  ? "border-marine bg-marine/5 text-marine"
                  : "border-border bg-card text-foreground/70 hover:border-marine/40"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Section 8 — Field Visit Information */}
      <SectionCard icon={Bus} step="8" title="Field Visit Information">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          <InfoCell icon={MapPin} label="Field Visit Location" value={FIELD_VISIT.location} />
          <InfoCell icon={CalendarDays} label="Date" value={FIELD_VISIT.date} />
          <InfoCell icon={Clock} label="Departure Time" value={FIELD_VISIT.departure} />
          <InfoCell icon={Building2} label="Meeting Point" value={FIELD_VISIT.meetingPoint} />
          <InfoCell
            icon={UserCheck}
            label="Contact Person"
            value={FIELD_VISIT.contactPerson}
            className="sm:col-span-2"
          />
        </div>
      </SectionCard>

      {/* Section 9 — Training Evaluation */}
      <SectionCard icon={Star} step="9" title="Training Evaluation">
        {!evalComplete && (
          <Banner tone="warning" icon={AlertTriangle}>
            Required before training completion.
          </Banner>
        )}
        <div className="mt-4 space-y-3">
          {INPERSON_EVALUATIONS.map((e) => (
            <div
              key={e.key}
              className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-bold text-navy">{e.label}</p>
                <p className="text-xs text-muted-foreground">{e.desc}</p>
              </div>
              <StarRating value={ip.evaluations[e.key]} onChange={(v) => setRating(e.key, v)} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Section 10 — Completion Status */}
      <SectionCard icon={ClipboardCheck} step="10" title="Completion Status">
        <ul className="space-y-2.5">
          {completionItems.map((c) => (
            <li
              key={c.label}
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-4"
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${c.done ? "bg-badge-training/15 text-badge-training" : "bg-muted text-muted-foreground"}`}
              >
                {c.done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-navy">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.detail}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${c.done ? "bg-badge-training/15 text-badge-training" : "bg-muted text-muted-foreground"}`}
              >
                {c.done ? "Complete" : "Pending"}
              </span>
            </li>
          ))}
        </ul>
        {complete ? (
          <Banner tone="success" icon={Award}>
            In-Person Training Completed — the Post-Course phase is now unlocked.
          </Banner>
        ) : (
          <Banner tone="warning" icon={AlertTriangle}>
            Complete attendance, present your action plan and submit all evaluations to finish the
            In-Person Training phase.
          </Banner>
        )}
      </SectionCard>
    </div>
  );
}

/* ---------------- Building blocks ---------------- */

function SectionCard({
  icon: Icon,
  step,
  title,
  children,
}: {
  icon: LucideIcon;
  step: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
            Section {step}
          </p>
          <h3 className="font-display text-base font-bold text-navy">{title}</h3>
        </div>
      </div>
      {children}
    </section>
  );
}

function InfoCell({
  icon: Icon,
  label,
  value,
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-3 bg-card p-4 ${className}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-marine/10 text-marine">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-medium text-navy">{value}</p>
      </div>
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={`h-6 w-6 ${n <= value ? "fill-star text-star" : "text-muted-foreground/40"}`}
          />
        </button>
      ))}
    </div>
  );
}

function Banner({
  tone,
  icon: Icon,
  children,
}: {
  tone: "success" | "warning" | "danger";
  icon: LucideIcon;
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    success: "border-badge-training/30 bg-badge-training/10 text-navy",
    warning: "border-accent/30 bg-accent/10 text-navy",
    danger: "border-destructive/30 bg-destructive/10 text-navy",
  };
  const iconTones: Record<string, string> = {
    success: "text-badge-training",
    warning: "text-accent",
    danger: "text-destructive",
  };
  return (
    <div className={`mt-4 flex items-center gap-2.5 rounded-xl border p-4 ${tones[tone]}`}>
      <Icon className={`h-5 w-5 shrink-0 ${iconTones[tone]}`} />
      <p className="text-sm font-semibold">{children}</p>
    </div>
  );
}
