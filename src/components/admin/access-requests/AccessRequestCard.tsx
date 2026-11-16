import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, X } from "lucide-react";
import { decideAccessRequest, type AccessRequestRow } from "@/lib/admin/role-requests.functions";
import { NOTE_MAX, STATUS_INFO, roleName } from "@/lib/account/role-requests.shared";

const when = (d: string) => new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

export function AccessRequestCard({ item, canDecide, me }: { item: AccessRequestRow; canDecide: boolean; me: string }) {
  const qc = useQueryClient();
  const decideFn = useServerFn(decideAccessRequest);
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [note, setNote] = useState("");
  const decide = useMutation({
    mutationFn: (decision: "approve" | "reject") => decideFn({ data: { requestId: item.id, decision, note: note.trim() } }),
    onSuccess: () => {
      setMode("idle");
      setNote("");
      void qc.invalidateQueries({ queryKey: ["admin", "access-requests"] });
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
  const ownRequest = item.target.id === me;
  const pending = item.status === "pending";
  const noteOk = mode === "approve" || note.trim().length >= 5;

  return (
    <li className="space-y-2 px-4 py-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-navy">
            {item.target.name}
            <span className="ml-2 font-normal text-muted-foreground">{item.target.email ?? ""}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {[item.target.jobTitle, item.target.organization].filter(Boolean).join(" · ") || "Jabatan/instansi belum diisi"}
          </p>
        </div>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_INFO[item.status].tone}`}>
          {STATUS_INFO[item.status].id}
        </span>
      </div>

      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-sm">
          {item.action === "revoke" ? "Minta mencabut peran " : "Minta peran "}
          <b className="text-navy">{roleName(item.role)}</b>
          {item.validUntil ? ` sampai ${new Date(item.validUntil).toLocaleDateString("id-ID", { dateStyle: "medium" })}` : " tanpa batas waktu"}
          <span className="text-xs text-muted-foreground"> · diajukan {when(item.createdAt)}{item.requestedBySelf ? "" : " oleh admin"}</span>
        </p>
        <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">"{item.reason}"</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Peran aktif saat ini: {item.target.activeRoles.length ? item.target.activeRoles.map((r) => roleName(r)).join(", ") : "tidak ada"}
        </p>
      </div>

      {!pending ? (
        <p className="text-xs text-muted-foreground">
          Diputuskan {item.reviewedAt ? when(item.reviewedAt) : ""} oleh {item.reviewerName ?? "—"}
          {item.decisionNote ? <>: <span className="text-slate-700">"{item.decisionNote}"</span></> : null}
        </p>
      ) : !canDecide ? (
        <p className="text-xs text-muted-foreground">Hanya super admin yang dapat memutuskan permintaan peran.</p>
      ) : ownRequest ? (
        <p className="text-xs text-muted-foreground">Ini permintaan untuk akun Anda sendiri; harus diputuskan super admin lain.</p>
      ) : mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode("approve")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
            <Check className="h-3.5 w-3.5" /> Setujui
          </button>
          <button type="button" onClick={() => setMode("reject")} className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
            <X className="h-3.5 w-3.5" /> Tolak
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={NOTE_MAX}
            rows={2}
            placeholder={mode === "reject" ? "Alasan penolakan (wajib, dikirim ke pengguna)" : "Catatan untuk pengguna (opsional)"}
            className="w-full rounded-lg border border-border px-3 py-2 text-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!noteOk || decide.isPending}
              onClick={() => decide.mutate(mode)}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${mode === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
            >
              {decide.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mode === "approve" ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              {mode === "approve" ? `Ya, berikan peran ${roleName(item.role)}` : "Tolak permintaan"}
            </button>
            <button type="button" disabled={decide.isPending} onClick={() => { setMode("idle"); setNote(""); decide.reset(); }} className="px-2 py-1.5 text-xs text-muted-foreground">
              Batal
            </button>
            {mode === "reject" && !noteOk ? <span className="text-[11px] text-destructive">Minimal 5 karakter.</span> : null}
          </div>
        </div>
      )}
      {decide.error ? <p className="text-xs text-destructive">{(decide.error as Error).message}</p> : null}
    </li>
  );
}
