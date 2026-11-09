// My Learning: courses taken through Course Offerings (shared learning engine) and
// the certificates issued for them (CATATAN_PERBAIKAN 2aq). Data comes from the
// database through listMyEnrolments / listMyCertificates (own rows only).
import { Link } from "@tanstack/react-router";
import { Award, BookOpen, CheckCircle2, ExternalLink, PlayCircle } from "lucide-react";
import { CertificateSheetActions } from "@/components/baruna/learning/CertificateSheetActions";
import { courseTitle, one, type MyCertificate, type MyEnrolment } from "@/lib/learning/myOfferings";

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });
const fmt = (d: string) => { const t = Date.parse(d); return Number.isNaN(t) ? d : dateFmt.format(t); };

export function MyCourseOfferings({ enrolments, certificates }: { enrolments: MyEnrolment[]; certificates: MyCertificate[] }) {
  if (enrolments.length === 0 && certificates.length === 0) return null;
  return (
    <div className="space-y-6">
      {enrolments.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold text-navy">BARUNA Academy Courses ({enrolments.length})</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Courses you enrolled in on the BARUNA learning platform.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {enrolments.map((e) => {
              const o = one(e.course_offerings)!;
              const done = e.completion_status === "completed";
              return (
                <article key={e.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
                      <BookOpen className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-bold text-navy">{courseTitle(o)}</h3>
                      <p className="text-xs font-medium text-marine">{o.offering_title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Enrolled {fmt(e.enrolment_date)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide ${
                      done ? "bg-success/15 text-success" : "bg-amber-100 text-amber-800"}`}>
                      {done ? <><CheckCircle2 className="h-3 w-3" /> Completed</> : e.review_status === "pending_review" ? "Awaiting approval" : e.review_status === "remedial" ? "Follow-up needed" : "In progress"}
                    </span>
                    <Link to="/academy/course/$offeringId" params={{ offeringId: o.offering_code }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-white hover:bg-marine/90">
                      <PlayCircle className="h-3.5 w-3.5" /> {done ? "Open course" : "Continue learning"}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {certificates.length > 0 ? (
        <section className="space-y-4 border-t border-border pt-4">
          <div>
            <h2 className="font-display text-xl font-bold text-navy">My Certificates ({certificates.length})</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Certificates issued by BARUNA Academy, verifiable by their number.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {certificates.map((c) => {
              const o = one(c.course_offerings);
              return (
                <article key={c.id} className="rounded-2xl border border-marine/30 bg-marine/5 p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marine/15 text-marine">
                      <Award className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-bold text-navy">{courseTitle(o)}</h3>
                      {o?.offering_title ? <p className="text-xs font-medium text-marine">{o.offering_title}</p> : null}
                      <p className="mt-1 break-all font-mono text-xs text-navy">{c.certificate_number}</p>
                      <p className="text-xs text-muted-foreground">Issued {fmt(c.issue_date)}</p>
                      <a href={c.verification_reference} target="_blank" rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-marine hover:underline">
                        Verify <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <CertificateSheetActions certificateNumber={c.certificate_number} />
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
