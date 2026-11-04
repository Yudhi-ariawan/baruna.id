// Master Course cover upload (migration 20261104020000).
// The server checks who uploads (author of an editable Master Course draft), the
// size (<= 2 MB) and the real file type from its first bytes (PNG/JPEG/WebP; the
// file name and the browser's type are not trusted). It stores the file in the
// public cover bucket and returns only the path; the path is saved in the draft
// and the database checks it again on submit and on approval.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROGRAM_COVER_BUCKET, PROGRAM_COVER_MAX_BYTES } from "@/lib/academy/program-cover";
import { programErrorText } from "@/lib/academy/programs.functions";

type ImageKind = { mime: "image/png" | "image/jpeg" | "image/webp"; ext: "png" | "jpg" | "webp" };

function sniffImage(b: Uint8Array): ImageKind | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return { mime: "image/png", ext: "png" };
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

// base64 of 2 MB is ~2.8 M characters; anything longer cannot be a valid cover.
const MAX_BASE64 = Math.ceil(PROGRAM_COVER_MAX_BYTES / 3) * 4 + 8;

export const uploadProgramCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({ draftId: z.string().uuid(), dataBase64: z.string().min(16).max(MAX_BASE64) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Role + draft check through the same RPC the editor uses (raises "forbidden").
    const { data: draft, error } = await (context.supabase as unknown as {
      rpc: (fn: string, a: Record<string, unknown>) => Promise<{ data: { kind: string; status: string; mine: boolean } | null; error: { message: string } | null }>;
    }).rpc("program_draft_get", { _draft_id: data.draftId });
    if (error) throw new Error(programErrorText(error.message));
    if (!draft || draft.kind !== "master_course") throw new Error("Sampul hanya untuk draf Master Course.");
    if (!draft.mine) throw new Error(programErrorText("forbidden"));
    if (draft.status !== "draft" && draft.status !== "revision_requested") throw new Error(programErrorText("program_draft_not_editable"));

    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(Buffer.from(data.dataBase64, "base64"));
    } catch {
      throw new Error("Berkas gambar tidak bisa dibaca.");
    }
    if (bytes.length === 0) throw new Error("Berkas gambar kosong.");
    if (bytes.length > PROGRAM_COVER_MAX_BYTES) throw new Error("Ukuran gambar maksimal 2 MB.");
    const kind = sniffImage(bytes);
    if (!kind) throw new Error("Gambar harus berformat PNG, JPG, atau WebP.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomUUID } = await import("node:crypto");
    const path = `academy-courses/${randomUUID().replace(/-/g, "")}.${kind.ext}`;
    const upload = () =>
      supabaseAdmin.storage.from(PROGRAM_COVER_BUCKET).upload(path, bytes, { contentType: kind.mime, upsert: false });
    let res = await upload();
    if (res.error && /not.?found|does not exist/i.test(res.error.message)) {
      // Same bucket settings as the Knowledge Hub module covers (module-projection.server.ts).
      await supabaseAdmin.storage.createBucket(PROGRAM_COVER_BUCKET, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      });
      res = await upload();
    }
    if (res.error) throw new Error(`Gambar gagal diunggah: ${res.error.message}`);
    return { path };
  });
