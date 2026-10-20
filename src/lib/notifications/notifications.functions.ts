import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EXPERT_OWNER_COLUMN } from "@/lib/experts/ownership";

export type InAppNotification = {
  id: string;
  type: "revision_requested" | "approved" | "rejected" | "archived" | "info";
  title: string;
  body: string;
  subjectKind: "expert" | "module" | "knowledge_resource" | "service_request" | "trainer_application" | "other";
  subjectTitle: string;
  targetUrl: string;
  createdAt: string;
  actorName: string;
  isLatestForSubject?: boolean;
  isRead?: boolean;
};

type RawNotif = InAppNotification & { subjectId: string };

/** Review decisions and archive events for items the user submitted (expert, module, resource). */
async function buildReviewNotifications(userId: string): Promise<{ raw: RawNotif[]; legacyReadIds: string[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Fetch review_subjects submitted by the current user
  const { data: mySubjects, error: subjErr } = await supabaseAdmin
    .from("review_subjects")
    .select("id, kind, title, current_status, metadata, created_at, updated_at")
    .eq("submitted_by", userId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (subjErr || !mySubjects || mySubjects.length === 0) {
    return { raw: [], legacyReadIds: [] };
  }

  const readIdsSet = new Set<string>();
  for (const s of mySubjects) {
    const meta =
      s.metadata && typeof s.metadata === "object"
        ? (s.metadata as Record<string, unknown>)
        : {};
    if (Array.isArray(meta.read_notification_ids)) {
      for (const rid of meta.read_notification_ids) {
        if (typeof rid === "string") readIdsSet.add(rid);
      }
    }
  }

  const subjectIds = mySubjects.map((s) => s.id);
  const subjectMap = new Map(mySubjects.map((s) => [s.id, s]));

  // 2. Fetch all review_decisions for these subjects
  const { data: decisions, error: decErr } = await supabaseAdmin
    .from("review_decisions")
    .select("id, subject_id, decision, rationale, decided_by, decided_at, created_at")
    .in("subject_id", subjectIds)
    .order("created_at", { ascending: false })
    .limit(500);

  if (decErr) {
    return { raw: [], legacyReadIds: Array.from(readIdsSet) };
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

  return { raw: rawNotifications, legacyReadIds: Array.from(readIdsSet) };
}

type EventCopy = { type: InAppNotification["type"]; title: string; body: string };

const REQUESTER_EVENT_COPY: Record<string, EventCopy> = {
  review: { type: "info", title: "Permintaan layanan sedang ditinjau", body: "Tim BARUNA mulai meninjau permintaan Anda." },
  matching: { type: "info", title: "Pencocokan expert dimulai", body: "Tim BARUNA sedang mencarikan expert yang sesuai." },
  assign: { type: "info", title: "Expert telah ditugaskan", body: "Expert yang sesuai sedang dihubungi untuk permintaan Anda." },
  accept: { type: "approved", title: "Expert menerima permintaan Anda", body: "Expert bersedia memenuhi permintaan layanan Anda." },
  request_info: { type: "revision_requested", title: "Diminta informasi tambahan", body: "Mohon balas pertanyaan dari tim/expert agar permintaan dapat dilanjutkan." },
  schedule: { type: "approved", title: "Kegiatan telah dijadwalkan", body: "Jadwal kegiatan untuk permintaan Anda sudah ditetapkan." },
  complete: { type: "approved", title: "Permintaan layanan selesai", body: "Kegiatan untuk permintaan Anda ditandai selesai." },
  decline: { type: "rejected", title: "Permintaan layanan tidak dapat dipenuhi", body: "Permintaan Anda ditolak. Lihat alasannya pada riwayat aktivitas." },
  cancel: { type: "rejected", title: "Permintaan layanan dibatalkan", body: "Permintaan Anda dibatalkan oleh admin. Lihat alasannya pada riwayat aktivitas." },
};

const EXPERT_EVENT_COPY: Record<string, EventCopy> = {
  assign: { type: "revision_requested", title: "Permintaan layanan baru untuk Anda", body: "Admin menugaskan permintaan layanan kepada Anda. Mohon terima, tolak, atau minta informasi." },
  reply: { type: "revision_requested", title: "Pemohon membalas permintaan informasi", body: "Pemohon sudah memberikan informasi tambahan. Mohon tinjau dan tanggapi." },
  cancel: { type: "info", title: "Permintaan layanan dibatalkan", body: "Permintaan yang ditugaskan kepada Anda telah dibatalkan." },
  schedule: { type: "info", title: "Kegiatan dijadwalkan", body: "Admin menjadwalkan kegiatan untuk permintaan layanan Anda." },
  complete: { type: "approved", title: "Permintaan layanan ditandai selesai", body: "Kegiatan Anda dicatat selesai dan masuk riwayat fasilitasi." },
};

/** Service-request activity for the user as requester and, if they have a profile, as the targeted expert. */
async function buildServiceRequestNotifications(userId: string): Promise<RawNotif[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const raw: RawNotif[] = [];

  const { data: expertRows } = await supabaseAdmin
    .from("experts")
    .select("id")
    .eq(EXPERT_OWNER_COLUMN, userId)
    .limit(5);
  const expertIds = (expertRows ?? []).map((e) => e.id);

  const [asRequester, asExpert] = await Promise.all([
    supabaseAdmin
      .from("expert_service_requests")
      .select("id, request_number")
      .eq("requester_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50),
    expertIds.length
      ? supabaseAdmin
          .from("expert_service_requests")
          .select("id, request_number")
          .in("target_expert_id", expertIds)
          .order("updated_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as { id: string; request_number: string }[] }),
  ]);

  const requesterReqs = new Map((asRequester.data ?? []).map((r) => [r.id, r.request_number]));
  const expertReqs = new Map((asExpert.data ?? []).map((r) => [r.id, r.request_number]));
  const allIds = Array.from(new Set([...requesterReqs.keys(), ...expertReqs.keys()]));
  if (allIds.length === 0) return raw;

  const { data: events } = await supabaseAdmin
    .from("expert_service_request_events")
    .select("id, request_id, actor_role, action, message, created_at")
    .in("request_id", allIds)
    .order("created_at", { ascending: false })
    .limit(200);

  for (const ev of events ?? []) {
    const number = requesterReqs.get(ev.request_id) ?? expertReqs.get(ev.request_id) ?? "";
    const message = ev.message?.trim();
    // The requester hears about what admin/expert did; their own actions are not news to them.
    if (requesterReqs.has(ev.request_id) && ev.actor_role !== "requester") {
      const copy = REQUESTER_EVENT_COPY[ev.action];
      if (copy) {
        raw.push({
          id: `sre-req-${ev.id}`,
          subjectId: `sr-${ev.request_id}`,
          type: copy.type,
          title: `${copy.title} (${number})`,
          body: message ? `${copy.body} Pesan: ${message}` : copy.body,
          subjectKind: "service_request",
          subjectTitle: number,
          targetUrl: "/experts/my-requests",
          createdAt: ev.created_at,
          actorName: ev.actor_role === "expert" ? "Expert" : "Tim Administrator BARUNA",
        });
      }
    }
    // The targeted expert hears about assignment and the requester's replies.
    if (expertReqs.has(ev.request_id) && ev.actor_role !== "expert") {
      const copy = EXPERT_EVENT_COPY[ev.action];
      if (copy) {
        raw.push({
          id: `sre-exp-${ev.id}`,
          subjectId: `sr-exp-${ev.request_id}`,
          type: copy.type,
          title: `${copy.title} (${number})`,
          body: message ? `${copy.body} Pesan: ${message}` : copy.body,
          subjectKind: "service_request",
          subjectTitle: number,
          targetUrl: "/experts/portal/service-requests",
          createdAt: ev.created_at,
          actorName: ev.actor_role === "requester" ? "Pemohon" : "Tim Administrator BARUNA",
        });
      }
    }
  }
  return raw;
}

/** Decisions on the user's trainer qualification applications (PB-EXP-01, Slide 39). */
async function buildTrainerApplicationNotifications(userId: string): Promise<RawNotif[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("expert_trainer_applications")
    .select("id, status, decision_note, decided_at, granted_level")
    .eq("applicant_id", userId)
    .in("status", ["approved", "rejected"])
    .order("decided_at", { ascending: false })
    .limit(20);

  return (data ?? []).map((a): RawNotif => {
    const approved = a.status === "approved";
    return {
      id: `ta-${a.id}-${a.status}`,
      subjectId: `ta-${a.id}`,
      type: approved ? "approved" : "rejected",
      title: approved
        ? "Kualifikasi trainer Anda disetujui"
        : "Pengajuan kualifikasi trainer ditolak",
      body:
        a.decision_note?.trim() ||
        (approved
          ? `Anda kini dapat mengajukan modul pelatihan${a.granted_level ? ` (level ${a.granted_level})` : ""}.`
          : "Pengajuan Anda belum memenuhi kriteria kualifikasi trainer."),
      subjectKind: "trainer_application",
      subjectTitle: "Kualifikasi trainer",
      targetUrl: approved ? "/experts/portal" : "/experts/trainer-application",
      createdAt: a.decided_at ?? new Date(0).toISOString(),
      actorName: "Tim Verifikator BARUNA",
    };
  });
}

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InAppNotification[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // A failure in one source must not hide the others.
    const [review, services, trainerApps, reads] = await Promise.all([
      buildReviewNotifications(context.userId).catch(() => ({ raw: [] as RawNotif[], legacyReadIds: [] as string[] })),
      buildServiceRequestNotifications(context.userId).catch(() => [] as RawNotif[]),
      buildTrainerApplicationNotifications(context.userId).catch(() => [] as RawNotif[]),
      supabaseAdmin
        .from("notification_reads")
        .select("notification_id")
        .eq("user_id", context.userId)
        .order("read_at", { ascending: false })
        .limit(1000),
    ]);

    // Read markers: notification_reads (current) + review_subjects.metadata (legacy).
    const readIdsSet = new Set<string>(review.legacyReadIds);
    for (const r of reads.data ?? []) readIdsSet.add(r.notification_id);

    const rawNotifications = [...review.raw, ...services, ...trainerApps];
    rawNotifications.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const seenSubjects = new Set<string>();
    return rawNotifications.map(({ subjectId, ...notif }) => {
      const isLatestForSubject = !seenSubjects.has(subjectId);
      seenSubjects.add(subjectId);
      return { ...notif, isLatestForSubject, isRead: readIdsSet.has(notif.id) };
    });
  });

export const markNotificationsAsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ notificationIds: z.array(z.string().min(1).max(200)).max(500) }).parse(input),
  )
  .handler(async ({ data: { notificationIds }, context }): Promise<{ success: boolean; count: number }> => {
    const ids = Array.from(new Set(notificationIds));
    if (!ids.length) return { success: true, count: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // One row per notification: concurrent devices cannot overwrite each other.
    const { error } = await supabaseAdmin
      .from("notification_reads")
      .upsert(
        ids.map((notification_id) => ({ user_id: context.userId, notification_id })),
        { onConflict: "user_id,notification_id", ignoreDuplicates: true },
      );
    if (error) throw new Error("Gagal menandai notifikasi sebagai dibaca. Coba lagi.");

    return { success: true, count: ids.length };
  });
