import { LEVEL_MODULE_LIMIT, type TrainerLevel } from "@/lib/trainerModules";
import { UPLOAD_LIMITS } from "@/lib/storage/upload-limits";
import type { TrainerPortalBootstrap } from "./portal-services.types";

/**
 * Server-side guards for Trainer Portal module submissions (PB-ACA-01 via
 * Slide 41 Experts -> Academy). The browser form is never trusted.
 */

const ALLOWED_ATTACHMENT_BUCKETS = new Set(["module-attachments", "expert-applications"]);

type Attachment = Record<string, unknown>;

function attachmentsOf(payload: Record<string, unknown>): Attachment[] {
  const meta = (payload.metadata as Record<string, unknown>) ?? {};
  const lists = [payload.attachments, payload.documents, meta.attached_resources];
  const found = lists.find((list) => Array.isArray(list) && list.length > 0);
  return Array.isArray(found) ? (found as unknown[]).filter((x): x is Attachment => Boolean(x) && typeof x === "object") : [];
}

const isUrl = (value: string) => /^https?:\/\//i.test(value);

/**
 * - Every stored file must live under the caller's own `users/<uid>/` prefix in an
 *   allowed bucket (stops referencing someone else's private files).
 * - On final submit, every listed file must actually have been uploaded: an entry
 *   with only a name and no storage path is a "phantom" attachment that reviewers
 *   and participants could never open.
 */
export function assertModuleAttachments(payload: Record<string, unknown>, userId: string, submit: boolean) {
  const prefix = `users/${userId}/`;
  for (const item of attachmentsOf(payload)) {
    const label = String(item.fileName ?? item.name ?? item.type ?? "lampiran");
    const path = typeof item.path === "string" ? item.path.trim() : "";
    const size = Number(item.fileSize ?? item.size ?? 0);

    if (size > UPLOAD_LIMITS.video) {
      throw new Error(`Berkas "${label}" melebihi batas maksimum 100 MB.`);
    }
    if (!path) {
      if (submit) {
        throw new Error(
          `Berkas "${label}" belum berhasil terunggah. Unggah ulang berkas tersebut sebelum mengirim modul.`,
        );
      }
      continue;
    }
    if (isUrl(path)) continue; // online video / external link

    const bucket = typeof item.bucket === "string" && item.bucket ? item.bucket : "module-attachments";
    if (!ALLOWED_ATTACHMENT_BUCKETS.has(bucket) || !path.startsWith(prefix) || path.includes("..")) {
      throw new Error(`Lampiran "${label}" tidak valid: berkas harus diunggah dari akun Anda sendiri.`);
    }
  }
}

/** Same rule the submit page shows, enforced where it cannot be bypassed. */
export function getModuleLevelLimitBlocker(bootstrap: TrainerPortalBootstrap): string | null {
  const rawLevel = bootstrap.trainer?.level ?? "not_assigned";
  const level: TrainerLevel = rawLevel === "not_assigned" ? "none" : rawLevel;
  const limit = LEVEL_MODULE_LIMIT[level];
  const active = (bootstrap.modules ?? []).filter((m) => ["approved", "published"].includes(m.status)).length;
  return active >= limit ? `Batas level modul tercapai (${limit} modul aktif).` : null;
}
