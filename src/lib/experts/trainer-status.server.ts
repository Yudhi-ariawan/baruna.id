import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * expert_trainer_status is a VERSIONED HISTORY table: upsert_expert_trainer_status
 * appends a new row per change and trainer_portal_bootstrap reads the newest one
 * (version DESC, granted_at DESC). Never read it with `.maybeSingle()` — with two
 * or more versions that errors, the caller sees "no row" and inserts yet another
 * version on every request.
 */
export async function getLatestTrainerStatus(expertId: string) {
  const { data, error } = await supabaseAdmin
    .from("expert_trainer_status")
    .select("id, trainer_status, trainer_level, version, unique_graduated_participants, rationale")
    .eq("expert_id", expertId)
    .order("version", { ascending: false })
    .order("granted_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Gagal membaca status trainer: ${error.message}`);
  return data?.[0] ?? null;
}

type TrainerStatus = "candidate" | "active" | "inactive" | "suspended" | "retired";

/** Marker written on the version created by archiving, so unarchive can undo exactly that. */
export const ARCHIVE_RATIONALE_PREFIX = "expert_archived;previous=";

/**
 * Appends a new version (never updates history in place). Level and graduate
 * count carry over from the latest version. No-op when the status is unchanged.
 */
export async function appendTrainerStatusVersion(
  expertId: string,
  status: TrainerStatus,
  grantedBy: string,
  rationale: string,
) {
  const latest = await getLatestTrainerStatus(expertId);
  if (!latest || latest.trainer_status === status) return;
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("expert_trainer_status").insert({
    expert_id: expertId,
    trainer_status: status,
    trainer_level: latest.trainer_level,
    unique_graduated_participants: latest.unique_graduated_participants,
    granted_by: grantedBy,
    granted_at: now,
    effective_from: now,
    rationale,
    version: latest.version + 1,
  });
  if (error) throw new Error(`Gagal memperbarui status trainer: ${error.message}`);
}

/** Archive: deactivate and remember what the status was. */
export async function deactivateTrainerForArchive(expertId: string, actorId: string) {
  const latest = await getLatestTrainerStatus(expertId);
  if (!latest || latest.trainer_status === "inactive") return;
  await appendTrainerStatusVersion(expertId, "inactive", actorId, `${ARCHIVE_RATIONALE_PREFIX}${latest.trainer_status}`);
}

/** Unarchive: restore only what archiving changed; an earlier admin deactivation stays. */
export async function restoreTrainerAfterArchive(expertId: string, actorId: string) {
  const latest = await getLatestTrainerStatus(expertId);
  if (!latest) return;
  const rationale = latest.rationale ?? "";
  // Archives made before this marker existed overwrote every version to
  // "inactive" with no rationale; the old unarchive restored "active".
  if (!rationale && latest.trainer_status === "inactive") {
    await appendTrainerStatusVersion(expertId, "active", actorId, "expert_unarchived(legacy)");
    return;
  }
  if (!rationale.startsWith(ARCHIVE_RATIONALE_PREFIX)) return;
  const previous = rationale.slice(ARCHIVE_RATIONALE_PREFIX.length) as TrainerStatus;
  if (!["candidate", "active", "inactive", "suspended", "retired"].includes(previous)) return;
  await appendTrainerStatusVersion(expertId, previous, actorId, "expert_unarchived");
}
