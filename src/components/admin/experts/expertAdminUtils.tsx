import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  RotateCcw,
  XCircle,
  Archive,
  Clock,
} from "lucide-react";

export function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 font-medium">
          <CheckCircle2 className="h-3 w-3" /> Disetujui (Aktif)
        </Badge>
      );
    case "resubmitted":
      return (
        <Badge className="bg-sky-100 text-sky-900 border-sky-300 hover:bg-sky-100 flex items-center gap-1 font-semibold shadow-2xs">
          <RotateCcw className="h-3 w-3 text-sky-600 animate-spin" style={{ animationDuration: "3s" }} /> Sudah Direvisi
        </Badge>
      );
    case "revision_requested":
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 flex items-center gap-1 font-medium">
          <RotateCcw className="h-3 w-3" /> Perlu Revisi
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100 flex items-center gap-1 font-medium">
          <XCircle className="h-3 w-3" /> Ditolak
        </Badge>
      );
    case "archived":
      return (
        <Badge className="bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-100 flex items-center gap-1 font-semibold">
          <Archive className="h-3 w-3 text-slate-600" /> Diarsipkan (Hidden)
        </Badge>
      );
    case "under_review":
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 flex items-center gap-1 font-medium">
          <Clock className="h-3 w-3" /> Sedang Direview
        </Badge>
      );
    case "decision_pending":
    case "pending":
    default:
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 flex items-center gap-1 font-medium">
          <Clock className="h-3 w-3" /> Menunggu Verifikasi
        </Badge>
      );
  }
}

