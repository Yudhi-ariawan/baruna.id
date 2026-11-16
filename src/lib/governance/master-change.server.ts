// One write path for Data Master (migration 20261116010000; CATATAN_PERBAIKAN 2az).
// master_change_submit applies the change at once for Approver/Admin and stores a
// pending request for an Operator (another Approver/Admin approves it). Before that
// migration the function does not exist and the old RPC is called directly.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type MasterChangeKind =
  | "expertise_save" | "expertise_set_active" | "kh_topic_save" | "kh_topic_set_active"
  | "language_save" | "language_set_active" | "training_category_save" | "training_category_set_active"
  | "trainer_levels_set" | "module_limits_set";

/** queued=true: an Operator's proposal waiting for approval; nothing changed yet. */
export type MasterChangeResult<T> = { queued: false; result: T } | { queued: true; requestId: string };

const MISSING = /master_change_submit|PGRST202/;

export async function submitMasterChange<T>(
  context: { supabase: unknown },
  change: { kind: MasterChangeKind; payload: Record<string, unknown>; summary: string },
  legacy: { fn: string; args: Record<string, unknown> },
  friendly: (message: string) => string,
): Promise<MasterChangeResult<T>> {
  const db = context.supabase as Db;
  const { data, error } = await db.rpc("master_change_submit", {
    _kind: change.kind,
    _payload: change.payload,
    _summary: change.summary.slice(0, 300),
  });
  if (error) {
    if (MISSING.test(`${error.message} ${error.code ?? ""}`)) {
      const old = await db.rpc(legacy.fn, legacy.args);
      if (old.error) throw new Error(friendly(old.error.message));
      return { queued: false, result: old.data as T };
    }
    throw new Error(friendly(error.message));
  }
  const r = data as { queued: boolean; requestId?: string; result?: T };
  return r.queued ? { queued: true, requestId: String(r.requestId) } : { queued: false, result: r.result as T };
}

/** Name of a Data Master row, for the summary of an activate/deactivate proposal. */
export async function masterRowName(table: string, id: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as Db).from(table).select("name").eq("id", id).maybeSingle();
  return (data?.name as string | undefined) ?? id;
}

export const MASTER_FORBIDDEN =
  "Data Master hanya dapat diubah oleh Approver, Admin, atau Super Admin; Operator dapat mengusulkan perubahan.";
