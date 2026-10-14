import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toFriendlyServiceError } from "@/lib/experts/service-request-errors";
import {
  TRAINER_APPLICATION_BUCKET,
  TRAINER_LEVELS,
  trainerApplicationFilePrefix,
  type TrainerApplicationPayload,
} from "@/lib/experts/trainer-application";

export type AdminTrainerApplication = {
  id: string;
  status: "submitted" | "approved" | "rejected" | "withdrawn";
  payload: TrainerApplicationPayload;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  grantedLevel: string | null;
  previousTrainerStatus: string | null;
  applicantId: string;
  applicantName: string | null;
  applicantEmail: string | null;
  expertId: string;
  expertName: string;
  expertSlug: string;
  expertHeadline: string | null;
  currentTrainerStatus: string | null;
};

export type AdminTrainerApplicationPage = {
  items: AdminTrainerApplication[];
  counts: { submitted: number; approved: number; rejected: number; withdrawn: number };
};

export const listAdminTrainerApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ status: z.enum(["submitted", "approved", "rejected", "withdrawn", "all"]).default("submitted") }).parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<AdminTrainerApplicationPage> => {
    const { data: result, error } = await context.supabase.rpc("admin_trainer_applications_list", { _status: data.status });
    if (error) throw new Error(toFriendlyServiceError(error.message));
    return result as unknown as AdminTrainerApplicationPage;
  });

export const decideTrainerApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        applicationId: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        level: z.enum(TRAINER_LEVELS).default("certified"),
        note: z.string().trim().max(2000).optional(),
      })
      .refine((v) => v.decision !== "reject" || (v.note?.length ?? 0) >= 5, {
        message: "Alasan penolakan wajib diisi (minimal 5 karakter).",
        path: ["note"],
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("admin_trainer_application_decide", {
      _application_id: data.applicationId,
      _decision: data.decision,
      _level: data.level,
      _note: data.note || null,
    });
    if (error) throw new Error(toFriendlyServiceError(error.message));
    return result as { id: string; status: string };
  });

/** Signed URL (10 minutes) for the applicant's sample material. Admin only. */
export const getTrainerApplicationFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ applicationId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("_is_service_admin", {
      _user_id: context.userId,
    });
    if (roleError || !isAdmin) throw new Error("forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: app, error } = await supabaseAdmin
      .from("expert_trainer_applications")
      .select("applicant_id, payload")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!app) throw new Error("Pengajuan tidak ditemukan.");

    const file = (app.payload as { sampleMaterial?: { path?: string; name?: string } | null })?.sampleMaterial;
    if (!file?.path || !file.path.startsWith(trainerApplicationFilePrefix(app.applicant_id)) || file.path.includes("..")) {
      throw new Error("Pengajuan ini tidak memiliki berkas contoh materi.");
    }
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(TRAINER_APPLICATION_BUCKET)
      .createSignedUrl(file.path, 600);
    if (signError || !signed?.signedUrl) throw new Error(signError?.message ?? "Gagal membuat tautan berkas.");
    return { url: signed.signedUrl, name: file.name ?? "contoh-materi" };
  });
