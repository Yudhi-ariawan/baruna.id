import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SERVICE_REQUEST_FILE_BUCKET, serviceRequestFilePrefix } from "./service-request-files";

/**
 * Opens one attachment of an Expert Service Request. Only the requester, the
 * owner of the targeted expert profile, or an administrator may read it; the
 * file is served as a short-lived signed URL (ENGINEERING_STANDARDS §3.3).
 */
export const getServiceRequestFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ requestId: z.string().uuid(), fileKey: z.string().min(1).max(80) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: request, error } = await supabaseAdmin
      .from("expert_service_requests")
      .select("id, requester_id, target_expert_id, payload")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!request) throw new Error("Permintaan tidak ditemukan.");

    let allowed = request.requester_id === context.userId;
    if (!allowed && request.target_expert_id) {
      const { data: target } = await supabaseAdmin
        .from("experts")
        .select("id")
        .eq("id", request.target_expert_id)
        .or(`original_contributor_id.eq.${context.userId},created_by.eq.${context.userId}`)
        .maybeSingle();
      allowed = Boolean(target);
    }
    if (!allowed) {
      for (const role of ["super_admin", "admin"]) {
        const { data: hasRole } = await context.supabase.rpc("has_rbac_role", {
          _user_id: context.userId,
          _role: role,
        });
        if (hasRole) {
          allowed = true;
          break;
        }
      }
    }
    if (!allowed) throw new Error("forbidden");

    const files = ((request.payload as Record<string, unknown>)?.files ?? {}) as Record<
      string,
      { path?: string; bucket?: string; name?: string }
    >;
    const file = files[data.fileKey];
    if (!file?.path) {
      throw new Error("Berkas ini tidak tersedia (diajukan sebelum fitur unggah aktif).");
    }
    if (
      (file.bucket ?? SERVICE_REQUEST_FILE_BUCKET) !== SERVICE_REQUEST_FILE_BUCKET ||
      !file.path.startsWith(serviceRequestFilePrefix(request.requester_id))
    ) {
      throw new Error("Lampiran tidak valid.");
    }

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(SERVICE_REQUEST_FILE_BUCKET)
      .createSignedUrl(file.path, 600);
    if (signError || !signed?.signedUrl) throw new Error(signError?.message ?? "Gagal membuat tautan berkas.");
    return { url: signed.signedUrl, name: file.name ?? data.fileKey };
  });
