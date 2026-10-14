import { useRef, useState } from "react";
import { useDebounced } from "@/hooks/use-debounced";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Paperclip, Search, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ServiceRequestTimeline } from "@/components/baruna/experts/ServiceRequestTimeline";
import { REQUEST_TYPE_CONFIG, formatDate } from "@/lib/experts";
import { serviceRequestStatusText } from "@/lib/experts/portal-services.types";
import { getServiceRequestFileUrl } from "@/lib/experts/service-request-files.functions";
import {
  listAssignableExperts,
  transitionAdminServiceRequest,
  type AdminServiceAction,
  type AdminServiceRequest,
} from "@/lib/admin/service-requests.functions";

/** Must match the state machine in admin_service_request_transition. */
const ACTIONS_BY_STATUS: Record<string, AdminServiceAction[]> = {
  submitted: ["review", "matching", "assign", "request_info", "decline", "cancel"],
  under_review: ["matching", "assign", "request_info", "decline", "cancel"],
  expert_matching: ["assign", "request_info", "decline", "cancel"],
  expert_contacted: ["assign", "decline", "cancel"],
  information_requested: ["decline", "cancel"],
  declined: ["assign"],
  confirmed: ["schedule", "complete", "cancel"],
  scheduled: ["complete", "cancel"],
};

const ACTION_LABEL: Record<AdminServiceAction, string> = {
  review: "Mulai Review",
  matching: "Mulai Pencocokan Expert",
  assign: "Tugaskan Expert",
  request_info: "Minta Info ke Pemohon",
  schedule: "Tandai Terjadwal",
  complete: "Selesai & Catat Riwayat",
  decline: "Tolak Permintaan",
  cancel: "Batalkan",
};

const MESSAGE_REQUIRED = new Set<AdminServiceAction>(["request_info", "decline", "cancel"]);
const LABEL_KEYS: Record<string, string> = {
  eventName: "Nama kegiatan", trainingTitle: "Judul pelatihan", subjectArea: "Bidang", objective: "Tujuan",
  technicalIssue: "Isu teknis", organization: "Organisasi", country: "Negara", eventDate: "Tanggal",
  trainingDates: "Tanggal pelatihan", eventFormat: "Format", deliveryMode: "Mode", timeline: "Linimasa",
};

export function ServiceRequestActionPanel({
  request: r,
  onClose,
  onChanged,
}: {
  request: AdminServiceRequest;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const transition = useServerFn(transitionAdminServiceRequest);
  const openFile = useServerFn(getServiceRequestFileUrl);
  const [action, setAction] = useState<AdminServiceAction | null>(null);
  const [message, setMessage] = useState("");
  const [expertId, setExpertId] = useState<string | null>(null);
  const [expertSearch, setExpertSearch] = useState("");
  const values = r.payload.values ?? {};
  const [completion, setCompletion] = useState({
    activityTitle: values.eventName || values.trainingTitle || values.subjectArea || "",
    organizer: values.organization || "",
    startDate: "",
    endDate: "",
    participantCount: "",
    country: values.country || "",
  });
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const actions = ACTIONS_BY_STATUS[r.status] ?? [];

  const submit = async () => {
    if (!action || inFlight.current) return;
    if (MESSAGE_REQUIRED.has(action) && message.trim().length < 5) {
      toast.error("Pesan wajib diisi (minimal 5 karakter).");
      return;
    }
    if (action === "assign" && !expertId) {
      toast.error("Pilih expert terlebih dahulu.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      await transition({
        data: {
          requestId: r.id,
          action,
          expectedUpdatedAt: r.updatedAt,
          message: message.trim() || undefined,
          expertId: action === "assign" ? expertId ?? undefined : undefined,
          completion:
            action === "complete"
              ? {
                  activityTitle: completion.activityTitle.trim(),
                  organizer: completion.organizer.trim() || undefined,
                  startDate: completion.startDate || undefined,
                  endDate: completion.endDate || undefined,
                  participantCount: completion.participantCount === "" ? undefined : Number(completion.participantCount),
                  country: completion.country.trim() || undefined,
                }
              : undefined,
        },
      });
      toast.success(`${ACTION_LABEL[action]}: berhasil.`);
      await onChanged();
      onClose();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal memproses permintaan.");
      await onChanged();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const open = async (fileKey: string) => {
    try {
      const { url } = await openFile({ data: { requestId: r.id, fileKey } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal membuka berkas.");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-navy">
            {r.requestNumber} · {REQUEST_TYPE_CONFIG[r.type]?.label ?? r.type}
          </DialogTitle>
          <DialogDescription>
            Status: <strong>{serviceRequestStatusText(r.status)}</strong> · Pemohon: {r.requesterName || r.requesterEmail || "—"} · Diajukan {formatDate(r.submittedAt || r.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <section className="grid gap-2 rounded-xl border border-border bg-slate-50 p-3 text-xs sm:grid-cols-2">
          {Object.entries(values).filter(([, v]) => v).slice(0, 24).map(([k, v]) => (
            <div key={k} className="min-w-0">
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{LABEL_KEYS[k] ?? k}</span>
              <span className="block whitespace-pre-wrap break-words font-medium text-navy">{v}</span>
            </div>
          ))}
        </section>

        {Object.keys(r.payload.files ?? {}).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(r.payload.files ?? {}).map(([key, file]) => (
              <button key={key} type="button" disabled={!file.path} onClick={() => void open(key)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-marine hover:bg-muted disabled:opacity-50">
                <Paperclip className="h-3 w-3" /> {file.name}
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Expert ditugaskan: <strong className="text-navy">{r.assignedExpert || "Belum ada"}</strong>
          {r.facilitationHistoryId && " · Tercatat di riwayat fasilitasi"}
        </p>

        <details open>
          <summary className="cursor-pointer text-xs font-semibold text-marine">Riwayat aktivitas</summary>
          <ServiceRequestTimeline events={r.events} />
        </details>

        {actions.length > 0 ? (
          <section className="space-y-3 border-t border-border pt-4">
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <button key={a} type="button" disabled={busy} onClick={() => setAction(a)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${action === a ? "border-navy bg-navy text-white" : "border-border text-navy hover:bg-muted"} ${a === "decline" || a === "cancel" ? "text-destructive" : ""}`}>
                  {ACTION_LABEL[a]}
                </button>
              ))}
            </div>

            {action === "assign" && <ExpertPicker selected={expertId} onSelect={setExpertId} search={expertSearch} onSearch={setExpertSearch} />}

            {action === "complete" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Judul kegiatan *" value={completion.activityTitle} onChange={(v) => setCompletion((c) => ({ ...c, activityTitle: v }))} className="sm:col-span-2" />
                <Field label="Penyelenggara" value={completion.organizer} onChange={(v) => setCompletion((c) => ({ ...c, organizer: v }))} />
                <Field label="Negara" value={completion.country} onChange={(v) => setCompletion((c) => ({ ...c, country: v }))} />
                <Field label="Tanggal mulai" type="date" value={completion.startDate} onChange={(v) => setCompletion((c) => ({ ...c, startDate: v }))} />
                <Field label="Tanggal selesai" type="date" value={completion.endDate} onChange={(v) => setCompletion((c) => ({ ...c, endDate: v }))} />
                <Field label="Jumlah peserta" type="number" value={completion.participantCount} onChange={(v) => setCompletion((c) => ({ ...c, participantCount: v.replace(/[^0-9]/g, "") }))} />
              </div>
            )}

            {action && (
              <label className="block text-xs font-semibold text-navy">
                {MESSAGE_REQUIRED.has(action) ? "Pesan untuk pemohon / expert *" : "Catatan (opsional)"}
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-marine/30" />
              </label>
            )}

            {action && (
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" disabled={busy} onClick={() => setAction(null)}>Batal</Button>
                <Button size="sm" disabled={busy} onClick={() => void submit()} className="bg-navy text-white hover:bg-navy/90">
                  {busy ? "Memproses…" : `Konfirmasi: ${ACTION_LABEL[action]}`}
                </Button>
              </div>
            )}
          </section>
        ) : (
          <p className="border-t border-border pt-4 text-xs text-muted-foreground">Permintaan ini sudah ditutup; tidak ada aksi yang tersedia.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text", className = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; className?: string }) {
  return (
    <label className={`block text-xs font-semibold text-navy ${className}`}>
      {label}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} maxLength={240} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-marine/30" />
    </label>
  );
}

function ExpertPicker({ selected, onSelect, search, onSearch }: { selected: string | null; onSelect: (id: string) => void; search: string; onSearch: (v: string) => void }) {
  const list = useServerFn(listAssignableExperts);
  const term = useDebounced(search.trim().toLowerCase(), 350);
  const query = useQuery({
    queryKey: ["admin", "assignable-experts", term],
    queryFn: () => list({ data: { search: term } }),
    staleTime: 60_000,
  });
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Cari nama atau keahlian expert…" className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-marine/30" />
      </div>
      <p className="text-[11px] text-muted-foreground">Hanya expert dengan status trainer aktif yang ditampilkan, karena hanya mereka yang memiliki kotak masuk permintaan.</p>
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {query.isLoading ? (
          <p className="p-3 text-xs text-muted-foreground">Memuat expert…</p>
        ) : query.isError ? (
          <p className="p-3 text-xs text-destructive">{query.error instanceof Error ? query.error.message : "Gagal memuat expert."}</p>
        ) : query.data?.length ? (
          query.data.map((e) => (
            <button key={e.id} type="button" onClick={() => onSelect(e.id)} className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${selected === e.id ? "border-navy bg-navy/5" : "border-border hover:bg-muted"}`}>
              <UserCheck className={`mt-0.5 h-4 w-4 shrink-0 ${selected === e.id ? "text-navy" : "text-muted-foreground"}`} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-navy">{e.name}</span>
                <span className="block truncate text-muted-foreground">{e.headline || "—"}{e.country ? ` · ${e.country}` : ""}</span>
                {e.expertiseAreas.length > 0 && <span className="block truncate text-marine">{e.expertiseAreas.slice(0, 3).join(", ")}</span>}
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700" title="Penugasan aktif">{e.openAssignments} aktif</span>
            </button>
          ))
        ) : (
          <p className="p-3 text-xs text-muted-foreground">Tidak ada expert yang cocok.</p>
        )}
      </div>
    </div>
  );
}
