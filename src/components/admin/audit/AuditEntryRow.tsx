import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { auditEntityLabel, auditEventLabel, SOURCE_LABEL, type AuditEntry, type AuditJson } from "@/lib/admin/audit-labels";

const SOURCE_TONE: Record<AuditEntry["source"], string> = {
  admin: "bg-sky-50 text-sky-800 border-sky-200",
  governance: "bg-violet-50 text-violet-800 border-violet-200",
  learning: "bg-emerald-50 text-emerald-800 border-emerald-200",
  status: "bg-amber-50 text-amber-800 border-amber-200",
};

const when = (d: string) => new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "medium" });
const shortId = (id: string) => `${id.slice(0, 8)}…`;

function person(id: string | null, name: string | null, empty: string) {
  if (!id) return empty;
  return name || `Pengguna ${shortId(id)}`;
}

function JsonBlock({ label, value }: { label: string; value: AuditJson | null }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const hasDetail = Boolean(entry.before || entry.after || entry.details || entry.entityId || entry.subjectId);
  const entity = auditEntityLabel(entry.entityType);
  const statusChange =
    entry.source === "status"
      ? `${(entry.before?.status as string | undefined) ?? "—"} → ${entry.after?.status as string}`
      : null;

  return (
    <li className="px-4 py-3 text-sm">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        className={`flex w-full items-start gap-2 text-left ${hasDetail ? "cursor-pointer" : "cursor-default"}`}
        aria-expanded={hasDetail ? open : undefined}
      >
        <span className="mt-0.5 text-muted-foreground">
          {hasDetail ? open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" /> : <span className="inline-block w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${SOURCE_TONE[entry.source]}`}>
              {SOURCE_LABEL[entry.source]}
            </span>
            <span className="font-semibold text-navy">{auditEventLabel(entry.eventType)}</span>
            {statusChange ? <span className="font-mono text-xs text-slate-600">{statusChange}</span> : null}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {when(entry.at)} · oleh <b className="text-slate-700">{person(entry.actorId, entry.actorName, "Sistem")}</b>
            {entry.targetUserId ? <> · terhadap <b className="text-slate-700">{person(entry.targetUserId, entry.targetName, "—")}</b></> : null}
            {entity ? ` · ${entity}` : ""}
            {entry.subjectTitle ? <> · <span className="text-slate-700">"{entry.subjectTitle}"</span></> : null}
          </span>
        </span>
      </button>

      {open ? (
        <div className="mt-2 space-y-2 pl-6">
          <p className="text-[11px] text-muted-foreground">
            Kode: <span className="font-mono">{entry.eventType}</span>
            {entry.entityId ? <> · ID entitas: <span className="font-mono">{entry.entityId}</span></> : null}
            {entry.subjectId ? <> · ID pengajuan: <span className="font-mono">{entry.subjectId}</span></> : null}
            {entry.actorId ? <> · ID pelaku: <span className="font-mono">{entry.actorId}</span></> : null}
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <JsonBlock label="Sebelum" value={entry.source === "status" ? null : entry.before} />
            <JsonBlock label="Sesudah" value={entry.source === "status" ? null : entry.after} />
          </div>
          <JsonBlock label="Keterangan" value={entry.details} />
        </div>
      ) : null}
    </li>
  );
}
