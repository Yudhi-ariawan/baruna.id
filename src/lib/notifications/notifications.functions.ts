import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InAppNotification = {
  id: string;
  type: "revision_requested" | "approved" | "rejected" | "archived" | "info";
  title: string;
  body: string;
  subjectKind: "expert" | "module" | "knowledge_resource" | "other";
  subjectTitle: string;
  targetUrl: string;
  createdAt: string;
  actorName: string;
  isLatestForSubject?: boolean;
};

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InAppNotification[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch review_subjects submitted by the current user
    const { data: mySubjects, error: subjErr } = await supabaseAdmin
      .from("review_subjects")
      .select("id, kind, title, current_status, metadata, created_at, updated_at")
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

    if (decErr) {
      return [];
    }

    // 3. Fetch linked drafts to generate precise edit URLs and check resubmission status
    const { data: drafts } = await supabaseAdmin
      .from("review_drafts")
      .select("id, linked_subject_id, subject_kind, status, updated_at")
      .in("linked_subject_id", subjectIds);

    const draftMap = new Map<string, string>();
    const draftStatusMap = new Map<string, string>();
    (drafts ?? []).forEach((d) => {
      if (d.linked_subject_id) {
        draftMap.set(d.linked_subject_id, d.id);
        draftStatusMap.set(d.linked_subject_id, d.status);
      }
    });

    type RawNotif = InAppNotification & { subjectId: string };
    const rawNotifications: RawNotif[] = [];

    // 4. Generate archive / restore notifications from review_subjects metadata
    for (const subject of mySubjects) {
      const kind = subject.kind ?? "other";
      const subjectTitle = subject.title || "Pengajuan Anda";
      const subjectMeta =
        subject.metadata && typeof subject.metadata === "object"
          ? (subject.metadata as Record<string, unknown>)
          : {};

      const isArchived =
        subject.current_status === "withdrawn" ||
        subject.current_status === "archived" ||
        subjectMeta.review_status === "archived" ||
        subjectMeta.last_decision === "archive";

      if (isArchived) {
        const archivedAt =
          (typeof subjectMeta.archived_at === "string" && subjectMeta.archived_at) ||
          subject.updated_at ||
          subject.created_at;
        const archiveReason =
          (typeof subjectMeta.archived_reason === "string" && subjectMeta.archived_reason.trim()) ||
          (typeof subjectMeta.archive_rationale === "string" && subjectMeta.archive_rationale.trim()) ||
          (typeof subjectMeta.last_rationale === "string" && subjectMeta.last_rationale.trim()) ||
          "Publikasi Anda telah diarsipkan oleh Administrator dan saat ini ditarik dari katalog tayang publik.";

        let title = `Pengajuan Diarsipkan: "${subjectTitle}"`;
        let targetUrl = "/knowledge-hub/my-contributions";
        if (kind === "knowledge_resource") {
          title = `Publikasi Diarsipkan (Ditarik dari Tayang): "${subjectTitle}"`;
          targetUrl = "/knowledge-hub/my-contributions";
        } else if (kind === "module") {
          title = `Modul Pelatihan Diarsipkan (Tarik Tayang): "${subjectTitle}"`;
          targetUrl = "/experts/portal/review-status";
        } else if (kind === "expert") {
          title = `Profil Pakar Diarsipkan dari Direktori Publik`;
          targetUrl = "/experts/portal";
        }

        rawNotifications.push({
          id: `archive-${subject.id}-${archivedAt}`,
          subjectId: subject.id,
          type: "archived",
          title,
          body: archiveReason,
          subjectKind: (kind as InAppNotification["subjectKind"]) || "other",
          subjectTitle,
          targetUrl,
          createdAt: archivedAt,
          actorName: "Tim Administrator BARUNA",
        });
      }
    }

    // 5. Generate notifications from review_decisions
    for (const dec of decisions ?? []) {
      const subject = subjectMap.get(dec.subject_id);
      const kind = subject?.kind ?? "other";
      const subjectTitle = subject?.title || "Pengajuan Anda";
      const draftId = draftMap.get(dec.subject_id);
      const draftStatus = draftStatusMap.get(dec.subject_id);
      const subjectMeta =
        subject?.metadata && typeof subject.metadata === "object"
          ? (subject.metadata as Record<string, unknown>)
          : {};
      const isResubmittedAfterDecision =
        dec.decision === "return_for_revision" &&
        (subjectMeta.review_status === "resubmitted" ||
          draftStatus === "submitted" ||
          (kind === "expert" &&
            subject?.current_status === "submitted" &&
            subject?.updated_at &&
            new Date(subject.updated_at).getTime() >
              new Date(dec.decided_at || dec.created_at).getTime() + 2000));

      let type: InAppNotification["type"] = "info";
      let title = `Pembaruan Evaluasi: ${subjectTitle}`;
      let targetUrl = "/dashboard";

      if (dec.decision === "return_for_revision") {
        type = isResubmittedAfterDecision ? "info" : "revision_requested";
        if (kind === "expert") {
          title = isResubmittedAfterDecision
            ? `Revisi Terkirim — Menunggu Evaluasi Ulang: Calon Expert BARUNA`
            : `Permintaan Revisi Dokumen: Calon Expert BARUNA`;
          targetUrl = `/experts/join`;
        } else if (kind === "module") {
          title = isResubmittedAfterDecision
            ? `Revisi Terkirim — Menunggu Evaluasi Ulang: "${subjectTitle}"`
            : `Permintaan Revisi Modul: "${subjectTitle}"`;
          targetUrl =
            draftId && !isResubmittedAfterDecision
              ? `/experts/portal/submit-module?draftId=${draftId}`
              : `/experts/portal/review-status`;
        } else if (kind === "knowledge_resource") {
          title = isResubmittedAfterDecision
            ? `Revisi Terkirim — Menunggu Evaluasi Ulang: "${subjectTitle}"`
            : `Permintaan Revisi Publikasi: "${subjectTitle}"`;
          targetUrl =
            draftId && !isResubmittedAfterDecision
              ? `/knowledge-hub/submit-resource?edit=${draftId}`
              : `/knowledge-hub/my-contributions`;
        } else {
          title = isResubmittedAfterDecision
            ? `Revisi Terkirim — Menunggu Evaluasi Ulang: ${subjectTitle}`
            : `Permintaan Revisi Berkas: ${subjectTitle}`;
          targetUrl = `/knowledge-hub/my-contributions`;
        }
      } else if (dec.decision === "approve") {
        type = "approved";
        if (kind === "expert") {
          title = `Selamat! Pengajuan Expert Anda Telah Disetujui`;
          targetUrl = `/experts/portal`;
        } else if (kind === "module") {
          title = `Selamat! Modul "${subjectTitle}" Telah Disetujui & Tayang`;
          targetUrl = `/experts/portal/review-status`;
        } else if (kind === "knowledge_resource") {
          title = `Selamat! Publikasi "${subjectTitle}" Telah Disetujui & Tayang`;
          targetUrl = `/knowledge-hub/my-contributions`;
        } else {
          title = `Pengajuan Disetujui: ${subjectTitle}`;
          targetUrl = `/knowledge-hub/my-contributions`;
        }
      } else if (dec.decision === "reject") {
        type = "rejected";
        title = `Pengajuan Ditolak: ${subjectTitle}`;
        targetUrl =
          kind === "expert"
            ? `/experts/join`
            : kind === "module"
              ? `/experts/portal/review-status`
              : `/knowledge-hub/my-contributions`;
      }

      const body =
        dec.rationale?.trim() ||
        (type === "revision_requested"
          ? "Verifikator meminta Anda memperbarui berkas dokumen atau data pengajuan sebelum dapat disetujui."
          : type === "approved"
            ? "Pengajuan Anda telah diverifikasi dan memenuhi standar tata kelola BARUNA."
            : "Pengajuan Anda belum memenuhi kriteria kualifikasi yang dipersyaratkan.");

      rawNotifications.push({
        id: dec.id,
        subjectId: dec.subject_id,
        type,
        title,
        body,
        subjectKind: (kind as InAppNotification["subjectKind"]) || "other",
        subjectTitle,
        targetUrl,
        createdAt: dec.decided_at || dec.created_at,
        actorName: "Tim Verifikator BARUNA",
      });
    }

    // Sort all notifications chronologically descending
    rawNotifications.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const seenSubjects = new Set<string>();
    const notifications: InAppNotification[] = rawNotifications.map(({ subjectId, ...notif }) => {
      const isLatestForSubject = !seenSubjects.has(subjectId);
      seenSubjects.add(subjectId);
      return {
        ...notif,
        isLatestForSubject,
      };
    });

    return notifications;
  });

