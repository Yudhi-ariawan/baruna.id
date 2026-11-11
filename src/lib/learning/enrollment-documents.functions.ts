// Required documents of an application (PB-ACA-03, Slide 22: "Unggah Dokumen
// Persyaratan"): Course Offerings (migration 20261110020000) and Full Training
// programs (migration 20261111020000).
// Files go to the private bucket "enrollment-documents" through a signed upload URL.
// The database checks every file again (owner, type, size, really uploaded) when it is
// recorded and when the application is sent, and only the owner and enrolment
// deciders may open a file.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toFriendlyEnrollmentError } from "@/lib/learning/enrollment-errors";
import {
  ENROLLMENT_DOCUMENT_BUCKET,
  ENROLLMENT_DOCUMENT_MAX_BYTES,
  enrollmentContentType,
  enrollmentFileProblem,
} from "@/lib/learning/enrollment-document-rules";

export { ENROLLMENT_DOCUMENT_BUCKET, ENROLLMENT_DOCUMENT_MAX_BYTES };

export const createEnrollmentDocumentUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        courseId: z.string().trim().min(3).max(200),
        fileName: z.string().trim().min(1).max(200),
        size: z.number().int().min(1).max(ENROLLMENT_DOCUMENT_MAX_BYTES),
        contentType: z.string().max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data: offering } = await db
      .from("course_offerings")
      .select("id, enrolment_access_rule, status")
      .eq("offering_code", data.courseId)
      .maybeSingle();
    let allowImages = false;
    if (offering) {
      if (offering.enrolment_access_rule !== "approval_required" || offering.status !== "published") {
        throw new Error("Course ini tidak menerima pengajuan dengan dokumen.");
      }
    } else {
      // Full Training program (missing table before migration 20261111020000 = not supported).
      const { data: program } = await db
        .from("full_training_programs")
        .select("course_id")
        .eq("course_id", data.courseId)
        .eq("active", true)
        .maybeSingle();
      if (!program) throw new Error("Program ini tidak menerima unggahan dokumen.");
      allowImages = true;
    }
    const file = { name: data.fileName, type: data.contentType, size: data.size };
    const problem = enrollmentFileProblem(file, allowImages);
    const contentType = enrollmentContentType(file, allowImages);
    if (problem || !contentType) throw new Error(problem?.id ?? "Jenis dokumen tidak didukung.");
    const ext = contentType === "application/pdf" ? "pdf" : contentType === "image/png" ? "png" : "jpg";
    const { randomUUID } = await import("node:crypto");
    const path = `enrollment/${context.userId}/${randomUUID().replace(/-/g, "")}.${ext}`;
    const { data: signed, error } = await db.storage.from(ENROLLMENT_DOCUMENT_BUCKET).createSignedUploadUrl(path);
    if (error || !signed?.token) {
      throw new Error(
        /not.?found|does not exist/i.test(error?.message ?? "")
          ? "Penyimpanan dokumen pendaftaran belum aktif (migrasi 20261110020000 belum dijalankan)."
          : `Gagal menyiapkan unggahan: ${error?.message ?? "tidak diketahui"}`,
      );
    }
    return { path, token: signed.token as string, contentType };
  });

/**
 * Records an uploaded file as this participant's document for the course (migrations
 * 20261111010000 and 20261111020000), so every device of the account sees it before the
 * application is sent. The database checks owner, type, size, requested document and
 * that the application can still change. Returns supported=false before the
 * migration, so the page keeps the file in the open tab instead (the old behaviour).
 */
export const registerEnrollmentDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        courseId: z.string().trim().min(3).max(200),
        requirement: z.string().trim().min(1).max(120),
        path: z.string().trim().min(1).max(200),
        fileName: z.string().trim().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ supported: boolean }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any).rpc("enrollment_document_register", {
      _course_id: data.courseId,
      _requirement: data.requirement,
      _path: data.path,
      _file_name: data.fileName,
    });
    if (error) {
      if (/enrollment_document_register|schema cache|PGRST202/.test(`${error.message} ${error.code ?? ""}`)) return { supported: false };
      throw new Error(toFriendlyEnrollmentError(error.message));
    }
    return { supported: true };
  });

export const getEnrollmentDocumentUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // The database decides who may open it (owner or enrolment decider).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: path, error } = await (context.supabase as any).rpc("enrollment_document_path", { _document_id: data.documentId });
    if (error) throw new Error(toFriendlyEnrollmentError(error.message));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: signed, error: signErr } = await (supabaseAdmin as any).storage
      .from(ENROLLMENT_DOCUMENT_BUCKET)
      .createSignedUrl(path as string, 600);
    if (signErr || !signed?.signedUrl) throw new Error(`Dokumen tidak bisa dibuka: ${signErr?.message ?? "tidak diketahui"}`);
    return { url: signed.signedUrl as string };
  });
