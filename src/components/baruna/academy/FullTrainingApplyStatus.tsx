// Top of the Full Training apply page when the server already has an application from
// this account (any device): pending / approved get a short notice instead of a second
// form, and "Minta Perbaikan" gets the revision box with document replacement (2ax).
// Notification links for Full Training decisions open this page.
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, LayoutDashboard } from "lucide-react";
import type { MyCourseEnrollmentDetail } from "@/lib/learning/enrollment-application.functions";
import { FullTrainingRevision } from "@/components/baruna/learning/FullTrainingRevision";

export function FullTrainingApplyStatus({ courseId, courseTitle, status, onDone }: {
  courseId: string;
  courseTitle: string;
  status: MyCourseEnrollmentDetail;
  onDone: () => void;
}) {
  const box = "rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8";
  const toApplications = (
    <Link to="/academy/applications" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-marine px-4 py-2 text-sm font-semibold text-marine hover:bg-marine hover:text-marine-foreground">
      <LayoutDashboard className="h-4 w-4" /> My Applications
    </Link>
  );
  if (status.status === "revision_requested") {
    return (
      <section className={box}>
        <h2 className="font-display text-xl font-bold text-navy">Revise your application</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Replace the documents the committee asked about, add a short answer, and send the application again.
        </p>
        <FullTrainingRevision courseId={courseId} courseTitle={courseTitle} isId={false} onDone={onDone} />
      </section>
    );
  }
  if (status.status === "pending" || status.status === "approved") {
    const approved = status.status === "approved";
    return (
      <section className={box}>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-navy">
          {approved ? <CheckCircle2 className="h-5 w-5 text-badge-training" /> : <Clock className="h-5 w-5 text-amber-600" />}
          {approved ? "Your application was accepted" : "Your application is with the selection committee"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {approved
            ? "You do not need to apply again."
            : "You will be notified when the committee decides. There is no need to apply again."}
        </p>
        {toApplications}
      </section>
    );
  }
  return null;
}
