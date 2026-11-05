// Data for the temporary certificate sheet (lembar sertifikat sementara).
// Everything comes from the database and is read as the signed-in participant
// (RLS: a participant can only read their own certificate and profile), so the
// sheet shows exactly what the verification page confirms.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CertificateSheetData = {
  certificateNumber: string;
  certificateType: string;
  issueDate: string;
  verificationPath: string;
  participantName: string;
  courseTitle: string;
  offeringTitle: string;
  cohortName: string | null;
  moduleCount: number;
  totalHours: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const getMyCertificateSheet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ certificateNumber: z.string().trim().min(5).max(120) }).parse(d))
  .handler(async ({ data, context }): Promise<CertificateSheetData> => {
    const db = context.supabase as Db;
    const { data: cert, error } = await db
      .from("certificates")
      .select("certificate_number, certificate_type, issue_date, verification_reference, certificate_status, course_offering_id")
      .eq("certificate_number", data.certificateNumber)
      .eq("learner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cert || cert.certificate_status !== "issued") throw new Error("Sertifikat tidak ditemukan.");

    const [{ data: offering }, { data: profile }] = await Promise.all([
      db.from("course_offerings")
        .select("offering_title, cohort_name, master_courses(title, master_modules(learning_hours))")
        .eq("id", cert.course_offering_id)
        .maybeSingle(),
      db.from("profiles").select("display_name").eq("id", context.userId).maybeSingle(),
    ]);
    const course = Array.isArray(offering?.master_courses) ? offering.master_courses[0] : offering?.master_courses;
    const modules: { learning_hours: number | string | null }[] = course?.master_modules ?? [];
    const totalHours = modules.reduce((n, m) => n + (Number(m.learning_hours) || 0), 0);

    return {
      certificateNumber: cert.certificate_number,
      certificateType: cert.certificate_type,
      issueDate: cert.issue_date,
      verificationPath: cert.verification_reference,
      participantName: (profile?.display_name ?? "").trim() || "Peserta BARUNA",
      courseTitle: course?.title ?? "-",
      offeringTitle: offering?.offering_title ?? "",
      cohortName: offering?.cohort_name ?? null,
      moduleCount: modules.length,
      totalHours: Math.round(totalHours * 10) / 10,
    };
  });
