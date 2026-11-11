import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Award, CheckCircle2, Clock, GraduationCap, PlayCircle, RotateCcw, XCircle } from "lucide-react";
import {
  getMyLearningOverview,
  type MyApplication,
  type MyCourseProgress,
} from "@/lib/learning/my-learning.functions";
import { RevisionResubmitBox } from "@/components/baruna/learning/RevisionResubmitBox";

/**
 * Participant learning summary, read from the database only:
 * application status (PB-ACA-03), learning progress and quiz (PB-ACA-04),
 * verified passes and certificates (PB-ACA-05).
 */
export function MyLearningOverview({ isId }: { isId: boolean }) {
  const fetchFn = useServerFn(getMyLearningOverview);
  const query = useQuery({
    queryKey: ["dashboard", "my-learning-overview"],
    queryFn: () => fetchFn(),
    staleTime: 30_000,
    gcTime: 300_000,
  });

  if (query.isLoading) {
    return <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">{isId ? "Memuat data pembelajaran…" : "Loading your learning data…"}</p>;
  }
  if (query.isError || !query.data) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {query.error instanceof Error ? query.error.message : isId ? "Data pembelajaran gagal dimuat." : "Learning data could not be loaded."}
      </p>
    );
  }

  const { applications, courses, certificates, counts } = query.data;
  const learning = courses.filter((c) => c.approved && !c.passed);
  const passed = courses.filter((c) => c.passed);
  const waiting = applications.filter((a) => a.status !== "approved");

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={isId ? "Menunggu persetujuan" : "Awaiting approval"}
          value={counts.pending}
          hint={counts.revisionRequested > 0 ? (isId ? `${counts.revisionRequested} perlu perbaikan dari Anda` : `${counts.revisionRequested} need your revision`) : undefined}
        />
        <Stat label={isId ? "Sedang dipelajari" : "In progress"} value={counts.inProgress} />
        <Stat label={isId ? "Lulus (tercatat server)" : "Passed (recorded)"} value={counts.passed} />
        <Stat label={isId ? "Sertifikat resmi" : "Official certificates"} value={counts.certificates} />
      </div>

      <Section icon={PlayCircle} title={isId ? "Lanjutkan Belajar" : "Continue Learning"}>
        {learning.length === 0 ? (
          <Empty text={isId ? "Belum ada kursus yang disetujui dan sedang berjalan." : "No approved course in progress."} cta={{ to: "/academy/self-paced", label: isId ? "Jelajahi kursus" : "Browse courses" }} />
        ) : (
          <ul className="space-y-3">{learning.map((c) => <CourseRow key={c.code} course={c} isId={isId} />)}</ul>
        )}
      </Section>

      {waiting.length > 0 && (
        <Section icon={Clock} title={isId ? "Status Pendaftaran" : "Application Status"}>
          <ul className="space-y-2">{waiting.map((a) => <ApplicationRow key={a.courseId} app={a} isId={isId} />)}</ul>
        </Section>
      )}

      <Section icon={Award} title={isId ? "Kelulusan & Sertifikat" : "Passes & Certificates"}>
        {passed.length === 0 && certificates.length === 0 ? (
          <Empty text={isId ? "Belum ada kelulusan yang tercatat. Kelulusan dicatat server setelah Anda lulus kuis resmi modul." : "No recorded pass yet. A pass is recorded by the server after you pass a module's official quiz."} />
        ) : (
          <ul className="space-y-2">
            {passed.map((c) => (
              <li key={c.code} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
                <span className="flex items-center gap-2 font-semibold text-navy"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> {c.title}</span>
                <span className="text-xs text-muted-foreground">
                  {c.kind === "offering" ? (isId ? "Kelulusan disetujui" : "Completion approved") : `${isId ? "Nilai" : "Score"} ${c.score ?? "-"}%`}
                  {c.completedAt ? ` · ${new Date(c.completedAt).toLocaleDateString(isId ? "id-ID" : "en-GB")}` : ""}
                </span>
              </li>
            ))}
            {certificates.map((cert) => (
              <li key={cert.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background p-3 text-sm">
                <span className="font-semibold text-navy">{cert.number}</span>
                <span className="text-xs text-muted-foreground">{cert.type} · {cert.status} · {new Date(cert.issuedAt).toLocaleDateString(isId ? "id-ID" : "en-GB")}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function offeringNote(c: MyCourseProgress, isId: boolean): string {
  const o = c.offering!;
  const modules = isId ? `${o.completedModules} dari ${o.totalModules} modul selesai` : `${o.completedModules} of ${o.totalModules} modules done`;
  const review =
    o.reviewStatus === "pending_review"
      ? isId ? "menunggu persetujuan kelulusan" : "completion awaiting approval"
      : o.reviewStatus === "remedial"
        ? isId ? "reviewer meminta tindak lanjut" : "reviewer asked for follow-up"
        : null;
  return review ? `${modules} · ${review}` : modules;
}

function CourseRow({ course: c, isId }: { course: MyCourseProgress; isId: boolean }) {
  const quizNote =
    c.kind === "offering"
      ? offeringNote(c, isId)
      : c.hasOfficialQuiz === false
      ? isId ? "Kuis resmi belum disediakan trainer" : "Official quiz not yet provided by the trainer"
      : c.attempts > 0
        ? isId ? `Kuis: ${c.attempts} percobaan, nilai terbaik ${c.bestScore}%` : `Quiz: ${c.attempts} attempt(s), best ${c.bestScore}%`
        : isId ? "Kuis belum dikerjakan" : "Quiz not taken yet";
  return (
    <li className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-navy">{c.title}</p>
        {c.kind === "offering" ? (
          <Link to="/academy/course/$offeringId" params={{ offeringId: c.code }} className="inline-flex items-center gap-1 rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy">
            {isId ? "Lanjutkan" : "Continue"} →
          </Link>
        ) : (
          <Link to="/academy/learn/$id" params={{ id: c.code }} className="inline-flex items-center gap-1 rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy">
            {isId ? "Lanjutkan" : "Continue"} →
          </Link>
        )}
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-marine" style={{ width: `${c.progress}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {c.progress}% · {quizNote}
        {c.legacyCompletion && (isId ? " · status selesai lama belum terverifikasi" : " · old completion not verified")}
      </p>
    </li>
  );
}

/** Page where the application lives: the participant fixes or reapplies there. */
function ApplicationLink({ app, children }: { app: MyApplication; children: React.ReactNode }) {
  const cls = "mt-2 inline-flex items-center gap-1 rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy";
  if (app.kind === "offering") return <Link to="/academy/course/$offeringId" params={{ offeringId: app.courseId }} className={cls}>{children}</Link>;
  if (app.kind === "program") return <Link to="/academy/applications" className={cls}>{children}</Link>;
  return <Link to="/academy/self-paced/$code" params={{ code: app.courseId }} className={cls}>{children}</Link>;
}

function ApplicationRow({ app, isId }: { app: MyApplication; isId: boolean }) {
  const pending = app.status === "pending";
  const revision = app.status === "revision_requested";
  const date = (d: string | null) => (d ? new Date(d).toLocaleDateString(isId ? "id-ID" : "en-GB") : "");
  const tone = pending ? "border-amber-200 bg-amber-50/60" : revision ? "border-orange-300 bg-orange-50/70" : "border-destructive/30 bg-destructive/5";
  return (
    <li className={`rounded-xl border p-3 text-sm ${tone}`}>
      <p className="flex items-center gap-2 font-semibold text-navy">
        {pending ? <Clock className="h-4 w-4 text-amber-600" /> : revision ? <RotateCcw className="h-4 w-4 text-orange-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
        {app.courseTitle}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {pending
          ? isId ? `Diajukan ${date(app.appliedAt)}, menunggu persetujuan admin.` : `Applied ${date(app.appliedAt)}, awaiting approval.`
          : revision
            ? `${isId ? `Admin meminta perbaikan (${date(app.decisionAt)})` : `Revision requested (${date(app.decisionAt)})`}${app.decisionNotes ? `: ${app.decisionNotes}` : "."}`
            : `${isId ? "Ditolak" : "Rejected"}${app.decisionNotes ? `: ${app.decisionNotes}` : "."}`}
      </p>
      {revision && app.kind === "program" ? (
        // Full Training forms live in one browser; answering here works from any device.
        <RevisionResubmitBox courseId={app.courseId} courseTitle={app.courseTitle} decisionNotes={null}
          previousNotes={app.notes} isId={isId} />
      ) : revision ? (
        <ApplicationLink app={app}>{isId ? "Perbaiki dan kirim ulang" : "Fix and resubmit"} →</ApplicationLink>
      ) : !pending ? (
        <ApplicationLink app={app}>{isId ? "Lihat dan ajukan lagi" : "View and reapply"} →</ApplicationLink>
      ) : null}
    </li>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-marine"><Icon className="h-4 w-4" /> {title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground"><GraduationCap className="h-3.5 w-3.5 text-marine" />{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold text-navy">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] font-semibold text-orange-700">{hint}</p> : null}
    </div>
  );
}

function Empty({ text, cta }: { text: string; cta?: { to: string; label: string } }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
      {text}
      {cta && (
        <div className="mt-2">
          <Link to={cta.to} className="text-xs font-semibold text-marine hover:text-navy">{cta.label} →</Link>
        </div>
      )}
    </div>
  );
}
