// Helpers for the trainer-initiated update of a live module (client-safe).

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});

/** The update facts carried by a module draft's payload metadata. */
export function moduleUpdateInfo(payload: unknown): {
  isPublishedUpdate: boolean;
  byTrainer: boolean;
  note: string | null;
  baseVersion: number | null;
} {
  const meta = obj(obj(payload).metadata);
  const isPublishedUpdate = meta.revision_kind === "published_module_update";
  return {
    isPublishedUpdate,
    byTrainer: isPublishedUpdate && meta.revision_initiated_by === "trainer",
    note: typeof meta.update_note === "string" && meta.update_note.trim() ? meta.update_note : null,
    baseVersion: typeof meta.base_version === "number" ? meta.base_version : null,
  };
}
