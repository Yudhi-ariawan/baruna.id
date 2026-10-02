import type { ReactNode } from "react";
import { Download, FileQuestion } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type PreviewAttachment = {
  name: string;
  type: string;
  size?: number;
  signedUrl: string;
  downloadUrl?: string;
};

type Props = {
  file: PreviewAttachment;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function previewKind(file: PreviewAttachment) {
  const extension = (file?.name || "").split(".").pop()?.toLowerCase();
  if (file.type === "application/pdf" || extension === "pdf") return "pdf";
  if (file.type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(extension ?? "")) return "image";
  if (file.type.startsWith("video/") || ["mp4", "mov", "webm"].includes(extension ?? "")) return "video";
  return "unsupported";
}

export function AttachmentPreviewDialog({ file, trigger, open, onOpenChange }: Props) {
  const kind = previewKind(file);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
    <DialogContent className="flex h-[92vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
      <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-28 text-left">
        <DialogTitle className="truncate text-base text-navy">{file.name}</DialogTitle>
        <DialogDescription>Secure attachment preview</DialogDescription>
      </DialogHeader>
      <div className="absolute right-12 top-3 flex items-center gap-1">
        <a href={file.downloadUrl ?? file.signedUrl} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-navy hover:bg-muted">
          <Download className="h-4 w-4" />Download
        </a>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-5">
        {kind === "pdf" ? <iframe title={`Preview ${file.name}`} src={file.signedUrl} className="h-full min-h-[65vh] w-full rounded-lg border border-border bg-white" /> : null}
        {kind === "image" ? <div className="flex min-h-full items-center justify-center"><img src={file.signedUrl} alt={`Preview of ${file.name}`} className="max-h-[75vh] max-w-full rounded-lg object-contain shadow" /></div> : null}
        {kind === "video" ? <div className="flex min-h-full items-center justify-center"><video controls preload="metadata" src={file.signedUrl} className="max-h-[75vh] w-full max-w-5xl rounded-lg bg-black">Your browser does not support video preview.</video></div> : null}
        {kind === "unsupported" ? <div className="mx-auto mt-[12vh] max-w-md rounded-xl border border-border bg-white p-8 text-center shadow-sm"><FileQuestion className="mx-auto h-12 w-12 text-marine" /><h3 className="mt-4 font-display text-lg font-bold text-navy">Preview is not available</h3><p className="mt-2 text-sm text-muted-foreground">This file type cannot be displayed safely in the browser. Use the Download button to open it with a compatible application.</p><p className="mt-3 break-all text-xs font-semibold text-foreground">{file.name}</p></div> : null}
      </div>
    </DialogContent>
  </Dialog>;
}
