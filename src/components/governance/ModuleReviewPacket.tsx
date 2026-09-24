import { Eye, FileText } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { AttachmentPreviewDialog } from "@/components/baruna/experts/AttachmentPreviewDialog";

export type ReviewAttachment = {
  category: string;
  name: string;
  size: number;
  type: string;
  path: string;
  signedUrl: string;
  downloadUrl?: string;
};

export function ModuleReviewPacket({ packet }: { packet: { payload: Record<string, Json>; attachments: ReviewAttachment[] } | null | undefined }) {
  if (!packet) return null;
  const payload = packet.payload;
  return (
    <section className="rounded border border-border p-4">
      <h3 className="text-sm font-semibold">Submitted module evidence</h3>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Summary</dt><dd>{String(payload.summary ?? "—")}</dd></div>
        <div><dt className="text-muted-foreground">Language</dt><dd>{String(payload.language ?? "—")}</dd></div>
        <div><dt className="text-muted-foreground">Target participants</dt><dd>{String(payload.target_participants ?? "—")}</dd></div>
        <div><dt className="text-muted-foreground">Learning hours</dt><dd>{String(payload.estimated_learning_hours ?? "—")}</dd></div>
      </dl>
      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide">Attachments ({packet.attachments.length})</h4>
      {packet.attachments.length ? (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {packet.attachments.map((file) => (
            <li key={file.path}>
              <AttachmentPreviewDialog file={file} trigger={<button type="button" className="flex w-full min-w-0 items-center gap-2 rounded bg-muted/40 p-2 text-left text-xs hover:bg-muted" aria-label={`Preview ${file.name}`}><FileText className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{file.name}</span><span className="text-muted-foreground">{file.category.replaceAll("_", " ")} · {(file.size / 1024 / 1024).toFixed(1)} MB</span></span><Eye className="h-4 w-4 shrink-0 text-marine" /></button>} />
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-xs text-muted-foreground">No attachments submitted.</p>}
    </section>
  );
}
