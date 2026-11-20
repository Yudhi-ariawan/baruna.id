import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, KeyRound, Loader2, Send } from "lucide-react";
import { cancelRoleRequest, getMyRoleRequests, submitRoleRequest } from "@/lib/account/role-requests.functions";
import { LinesSkeleton } from "@/components/baruna/loading/Skeletons";
import {
  REASON_MAX,
  REASON_MIN,
  REQUESTABLE_ROLES,
  ROLE_INFO,
  STATUS_INFO,
  roleName,
  type RequestableRole,
} from "@/lib/account/role-requests.shared";
import { useLanguage } from "@/lib/i18n";

// Permintaan Akses / Peran (Slide 42, LS-01): the user asks for a curation role with
// a reason; a super admin decides in the Admin Portal (Permintaan Akses).

const QUERY_KEY = ["account", "role-requests"] as const;

/** End of the chosen local day, as an ISO instant. */
function endOfDay(day: string): string | undefined {
  if (!day) return undefined;
  const d = new Date(`${day}T23:59:59`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function RoleRequestSection() {
  const { isId } = useLanguage();
  const qc = useQueryClient();
  const listFn = useServerFn(getMyRoleRequests);
  const submitFn = useServerFn(submitRoleRequest);
  const cancelFn = useServerFn(cancelRoleRequest);
  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
  const q = useQuery({ queryKey: QUERY_KEY, queryFn: () => listFn(), staleTime: 30_000 });

  const [role, setRole] = useState<RequestableRole | "">("");
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  const active = q.data?.activeRoles ?? [];
  const pendingRoles = (q.data?.requests ?? []).filter((r) => r.status === "pending").map((r) => r.role);
  const choices = REQUESTABLE_ROLES.filter((r) => !active.includes(r) && !pendingRoles.includes(r));
  const today = new Date().toISOString().slice(0, 10);

  const submit = useMutation({
    mutationFn: () => submitFn({ data: { role: role as RequestableRole, reason: reason.trim(), validUntil: endOfDay(until) } }),
    onSuccess: () => {
      setSent(roleName(role, isId));
      setRole("");
      setReason("");
      setUntil("");
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
  const reasonLen = reason.trim().length;
  const canSend = Boolean(role) && reasonLen >= REASON_MIN && (!until || until > today) && !submit.isPending;
  const when = (d: string) => new Date(d).toLocaleString(isId ? "id-ID" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-marine/10 p-2 text-marine"><KeyRound className="h-5 w-5" /></span>
        <div>
          <h2 className="font-display text-lg font-bold text-navy">{isId ? "Permintaan Peran" : "Role Requests"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isId
              ? "Ajukan peran kurasi (Operator, Reviewer, Verifier, Approver, Publisher) bila tugas Anda membutuhkannya. Permintaan diputuskan oleh super admin dan tercatat di jejak audit."
              : "Request a curation role (Operator, Reviewer, Verifier, Approver, Publisher) if your work requires it. A super admin decides, and every request is recorded in the audit trail."}
          </p>
        </div>
      </div>

      {q.isLoading ? (
        <LinesSkeleton className="mt-4" lines={3} label={isId ? "Memuat…" : "Loading…"} />
      ) : q.isError ? (
        <p className="mt-4 text-sm text-destructive">{(q.error as Error).message}</p>
      ) : (
        <div className="mt-5 space-y-5">
          {sent ? (
            <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              {isId ? `Permintaan peran ${sent} terkirim dan menunggu keputusan.` : `Your ${sent} role request was sent and awaits a decision.`}
            </p>
          ) : null}

          {choices.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
              {isId
                ? "Semua peran kurasi sudah Anda miliki atau sedang menunggu keputusan."
                : "You already hold, or are awaiting a decision on, every curation role."}
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (canSend) submit.mutate();
              }}
              className="space-y-3"
            >
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-navy">{isId ? "Peran yang diajukan" : "Requested role"}</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {choices.map((r) => (
                    <label
                      key={r}
                      className={`flex cursor-pointer gap-2 rounded-xl border p-3 text-sm ${role === r ? "border-marine bg-marine/5" : "border-border hover:bg-muted/50"}`}
                    >
                      <input type="radio" name="role" value={r} checked={role === r} onChange={() => { setRole(r); setSent(null); }} className="mt-1" />
                      <span>
                        <span className="block font-semibold text-navy">{roleName(r, isId)}</span>
                        <span className="block text-xs text-muted-foreground">{isId ? ROLE_INFO[r].descId : ROLE_INFO[r].descEn}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="block text-xs font-semibold text-navy">
                {isId ? "Alasan dan tugas yang membutuhkan peran ini" : "Reason and the work that needs this role"}
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={REASON_MAX}
                  rows={3}
                  placeholder={isId ? "Contoh: Saya ditugaskan unit kerja untuk meninjau modul pelatihan perikanan tangkap mulai Desember." : "Example: My unit assigned me to review capture-fisheries training modules from December."}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal"
                />
                <span className={`mt-0.5 block text-[11px] font-normal ${reasonLen > 0 && reasonLen < REASON_MIN ? "text-destructive" : "text-muted-foreground"}`}>
                  {isId ? `Minimal ${REASON_MIN} karakter (${reasonLen}/${REASON_MAX}).` : `At least ${REASON_MIN} characters (${reasonLen}/${REASON_MAX}).`}
                </span>
              </label>

              <label className="block text-xs font-semibold text-navy">
                {isId ? "Berlaku sampai (opsional, kosongkan bila tanpa batas)" : "Valid until (optional; leave empty for no end)"}
                <input type="date" min={today} value={until} onChange={(e) => setUntil(e.target.value)} className="mt-1 block rounded-lg border border-border px-2 py-1.5 text-sm font-normal" />
                {until && until <= today ? (
                  <span className="mt-0.5 block text-[11px] font-normal text-destructive">{isId ? "Tanggal harus setelah hari ini." : "The date must be after today."}</span>
                ) : null}
              </label>

              {submit.error ? <p className="text-sm text-destructive">{(submit.error as Error).message}</p> : null}
              <button
                type="submit"
                disabled={!canSend}
                className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-white hover:bg-navy disabled:opacity-50"
              >
                {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isId ? "Kirim permintaan" : "Send request"}
              </button>
            </form>
          )}

          {(q.data?.requests ?? []).length ? (
            <div>
              <h3 className="text-sm font-bold text-navy">{isId ? "Riwayat permintaan Anda" : "Your request history"}</h3>
              <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                {q.data!.requests.map((r) => (
                  <li key={r.id} className="space-y-1 px-3 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-navy">
                        {r.action === "revoke" ? (isId ? "Cabut " : "Remove ") : ""}{roleName(r.role, isId)}
                      </span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_INFO[r.status].tone}`}>
                        {isId ? STATUS_INFO[r.status].id : STATUS_INFO[r.status].en}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {isId ? "diajukan" : "sent"} {when(r.createdAt)}
                        {r.reviewedAt ? ` · ${isId ? "diputuskan" : "decided"} ${when(r.reviewedAt)}` : ""}
                        {r.validUntil ? ` · ${isId ? "berlaku sampai" : "valid until"} ${new Date(r.validUntil).toLocaleDateString(isId ? "id-ID" : "en-GB")}` : ""}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{isId ? "Alasan" : "Reason"}: {r.reason}</p>
                    {r.status === "pending" ? (
                      <button type="button" disabled={cancel.isPending}
                        onClick={() => { if (window.confirm(isId ? "Batalkan permintaan ini?" : "Withdraw this request?")) cancel.mutate(r.id); }}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-navy hover:bg-muted disabled:opacity-50">
                        {isId ? "Batalkan permintaan" : "Withdraw request"}
                      </button>
                    ) : null}
                    {r.decisionNote ? (
                      <p className="text-xs text-slate-700"><b>{isId ? "Catatan keputusan" : "Decision note"}:</b> {r.decisionNote}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {cancel.isError ? <p className="mt-1 text-xs text-destructive">{(cancel.error as Error).message}</p> : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
