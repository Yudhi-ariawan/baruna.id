// ============================================================================
// Dynamic CMS for the curation console (kurikulum 3.1; migration 20261118010000;
// CATATAN_PERBAIKAN 2br). Every read and write goes through RPCs that check the
// role, validate the content, keep the live version until someone else approves,
// and write the audit trail. The server only adds the image upload and CSV export.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cmsErrorText } from "./cms-errors";
import type { CmsDraft, CmsOverview, CmsSubmissionList } from "./cms-types";
import { CMS_DOMAINS } from "./cms-types";

// The CMS RPCs are newer than the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function rpc<T>(context: { supabase: unknown }, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (context.supabase as Db).rpc(fn, args ?? {});
  if (error) throw new Error(cmsErrorText(error.message));
  return data as T;
}

const id = z.string().uuid();

export const getCmsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => rpc<CmsOverview>(context, "cms_overview"));

export const getCmsDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => rpc<CmsDraft>(context, "cms_draft_get", { _draft_id: data.id }));

export const openCmsDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({ kind: z.enum(["page", "form", "menu"]), targetId: id.nullable(), domain: z.enum(CMS_DOMAINS).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) =>
    rpc<string>(context, "cms_draft_open", { _kind: data.kind, _target_id: data.targetId, _domain: data.domain }),
  );

export const saveCmsDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id, payload: z.record(z.unknown()), expectedUpdatedAt: z.string().min(10) }).parse(d))
  .handler(async ({ data, context }) =>
    rpc<string>(context, "cms_draft_save", { _draft_id: data.id, _payload: data.payload, _expected_updated_at: data.expectedUpdatedAt }),
  );

export const submitCmsDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => rpc<null>(context, "cms_draft_submit", { _draft_id: data.id }));

export const withdrawCmsDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => rpc<null>(context, "cms_draft_withdraw", { _draft_id: data.id }));

export const decideCmsDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({
      id,
      decision: z.enum(["approve", "request_revision", "reject"]),
      note: z.string().trim().max(2000).nullable(),
      expectedUpdatedAt: z.string().min(10),
    }).parse(d),
  )
  .handler(async ({ data, context }) =>
    rpc<{ status: string; resultId: string | null }>(context, "cms_draft_decide", {
      _draft_id: data.id, _decision: data.decision, _note: data.note, _expected_updated_at: data.expectedUpdatedAt,
    }),
  );

export const setCmsStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({
      kind: z.enum(["page", "form"]), id, status: z.enum(["published", "on_hold", "closed", "archived"]),
      reason: z.string().trim().min(5).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) =>
    rpc<null>(context, "cms_set_status", { _kind: data.kind, _id: data.id, _status: data.status, _reason: data.reason }),
  );

// ---------------------------------------------------------------- image upload
type ImageKind = { mime: "image/png" | "image/jpeg" | "image/webp"; ext: "png" | "jpg" | "webp" };
/** Real file type from the first bytes (same check as the course cover upload). */
function sniffImage(b: Uint8Array): ImageKind | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}
const MAX_IMAGE = 2 * 1024 * 1024;

/** Uploads a page image for an editable page draft of the signed-in author; returns the stored path. */
export const uploadCmsImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ draftId: id, dataBase64: z.string().min(16).max(Math.ceil(MAX_IMAGE / 3) * 4 + 8) }).parse(d))
  .handler(async ({ data, context }) => {
    const draft = await rpc<CmsDraft>(context, "cms_draft_get", { _draft_id: data.draftId });
    if (draft.kind !== "page") throw new Error("Gambar hanya untuk draf halaman.");
    if (!draft.canEdit || (draft.status !== "draft" && draft.status !== "revision_requested")) throw new Error(cmsErrorText("forbidden"));
    const bytes = Uint8Array.from(Buffer.from(data.dataBase64, "base64"));
    if (bytes.length === 0) throw new Error("Berkas gambar kosong.");
    if (bytes.length > MAX_IMAGE) throw new Error("Ukuran gambar maksimal 2 MB.");
    const kind = sniffImage(bytes);
    if (!kind) throw new Error("Gambar harus berformat PNG, JPG, atau WebP.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomUUID } = await import("node:crypto");
    const path = `cms/${randomUUID().replace(/-/g, "")}.${kind.ext}`;
    const res = await supabaseAdmin.storage.from("knowledge-module-covers").upload(path, bytes, { contentType: kind.mime, upsert: false });
    if (res.error) throw new Error(`Gambar gagal diunggah: ${res.error.message}`);
    return { path };
  });

// ---------------------------------------------------------------- submissions
export const listCmsSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ formId: id, status: z.enum(["new", "reviewed", "archived"]).nullable() }).parse(d))
  .handler(async ({ data, context }) =>
    rpc<CmsSubmissionList>(context, "cms_form_submission_list", { _form_id: data.formId, _status: data.status, _limit: 500 }),
  );

export const markCmsSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id, status: z.enum(["new", "reviewed", "archived"]) }).parse(d))
  .handler(async ({ data, context }) => rpc<null>(context, "cms_form_mark", { _submission_id: data.id, _status: data.status }));

/** A cell that spreadsheet apps would run as a formula is prefixed with an apostrophe. */
function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "Ya" : "Tidak") : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV of a form's submissions (same access as the list); Excel-friendly (BOM, ; separator). */
export const exportCmsSubmissionsCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ formId: id, status: z.enum(["new", "reviewed", "archived"]).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const list = await rpc<CmsSubmissionList>(context, "cms_form_submission_list", { _form_id: data.formId, _status: data.status, _limit: 2000 });
    const STATUS = { new: "Baru", reviewed: "Sudah ditinjau", archived: "Diarsipkan" } as const;
    const head = ["Waktu kirim", "Pengirim", "Email pengirim", "Status", ...list.form.fields.map((f) => f.label_id)];
    const lines = [head.map(csvCell).join(";")];
    for (const r of list.rows) {
      lines.push([r.createdAt, r.submitter, r.submitterEmail, STATUS[r.status], ...list.form.fields.map((f) => r.data[f.key])].map(csvCell).join(";"));
    }
    return { filename: `kiriman-${list.form.slug}.csv`, csv: "﻿" + lines.join("\r\n") };
  });
