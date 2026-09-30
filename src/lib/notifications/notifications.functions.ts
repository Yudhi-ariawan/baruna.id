import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InAppNotification = {
  id: string;
  type: "revision_requested" | "approved" | "rejected" | "info";
  title: string;
  body: string;
  subjectKind: "expert" | "module" | "knowledge_resource" | "other";
  subjectTitle: string;
  targetUrl: string;
  createdAt: string;
  actorName: string;
};

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InAppNotification[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch review_subjects submitted by the current user
    const { data: mySubjects, error: subjErr } = await supabaseAdmin
      .from("review_subjects")
      .select("id, kind, title, current_status, created_at, updated_at")
      .eq("submitted_by", context.userId)
      .order("updated_at", { ascending: false });

    if (subjErr || !mySubjects || mySubjects.length === 0) {
      return [];
    }

    const subjectIds = mySubjects.map((s) => s.id);
    const subjectMap = new Map(mySubjects.map((s) => [s.id, s]));

    // 2. Fetch all review_decisions for these subjects
    const { data: decisions, error: decErr } = await supabaseAdmin
      .from("review_decisions")
      .select("id, subject_id, decision, rationale, decided_by, decided_at, created_at")
      .in("subject_id", subjectIds)
      .order("created_at", { ascending: false });

    if (decErr || !decisions) {
      return [];
    }

    // 3. Fetch linked drafts to generate precise edit URLs
    const { data: drafts } = await supabaseAdmin
      .from("review_drafts")
      .select("id, linked_subject_id, subject_kind")
      .in("linked_subject_id", subjectIds);

    const draftMap = new Map<string, string>();
    (drafts ?? []).forEach((d) => {
      if (d.linked_subject_id) {
        draftMap.set(d.linked_subject_id, d.id);
      }
    });

    const notifications: InAppNotification[] = decisions.map((dec) => {
      const subject = subjectMap.get(dec.subject_id);
      const kind = subject?.kind ?? "other";
      const subjectTitle = subject?.title || "Pengajuan Anda";
      const draftId = draftMap.get(dec.subject_id);

      let type: InAppNotification["type"] = "info";
      let title = `Pembaruan Evaluasi: ${subjectTitle}`;
      let targetUrl = "/dashboard";

      if (dec.decision === "return_for_revision") {
        type = "revision_requested";
        if (kind === "expert") {
          title = `Permintaan Revisi Dokumen: Calon Expert BARUNA`;
          targetUrl = `/experts/join`;
        } else if (kind === "module") {
          title = `Permintaan Revisi Modul: "${subjectTitle}"`;
          targetUrl = draftId
            ? `/experts/portal/submit-module?draftId=${draftId}`
            : `/experts/portal/review-status`;
        } else {
          title = `Permintaan Revisi Berkas: ${subjectTitle}`;
          targetUrl = `/my-submissions`;
        }
      } else if (dec.decision === "approve") {
        type = "approved";
        if (kind === "expert") {
          title = `Selamat! Pengajuan Expert Anda Telah Disetujui`;
          targetUrl = `/experts/profile`;
        } else if (kind === "module") {
          title = `Selamat! Modul "${subjectTitle}" Telah Disetujui & Tayang`;
          targetUrl = `/experts/portal/review-status`;
        } else {
          title = `Pengajuan Disetujui: ${subjectTitle}`;
          targetUrl = `/my-submissions`;
        }
      } else if (dec.decision === "reject") {
        type = "rejected";
        title = `Pengajuan Ditolak: ${subjectTitle}`;
        targetUrl = kind === "expert" ? `/experts/join` : `/experts/portal/review-status`;
      }

      const body =
        dec.rationale?.trim() ||
        (type === "revision_requested"
          ? "Verifikator meminta Anda memperbarui berkas dokumen atau data pengajuan sebelum dapat disetujui."
          : type === "approved"
            ? "Pengajuan Anda telah diverifikasi dan memenuhi standar tata kelola BARUNA."
            : "Pengajuan Anda belum memenuhi kriteria kualifikasi yang dipersyaratkan.");

      return {
        id: dec.id,
        type,
        title,
        body,
        subjectKind: (kind as InAppNotification["subjectKind"]) || "other",
        subjectTitle,
        targetUrl,
        createdAt: dec.decided_at || dec.created_at,
        actorName: "Tim Verifikator BARUNA",
      };
    });

    return notifications;
  });

