import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LogIn, Search, ShieldCheck } from "lucide-react";
import { listAuthEvents } from "@/lib/admin/auth-log.functions";
import { AUTH_EVENTS, AUTH_EVENT_INFO, describeDevice, type AuthEvent, type AuthLogEntry } from "@/lib/admin/auth-log.shared";

// Log Autentikasi (Slide 42, LS-01 output "Authentication Log"): who signed in or
// out, when, and from which browser. Read-only; the server checks audit.read.
export const Route = createFileRoute("/admin/auth-log")({
  head: () => ({ meta: [{ title: "Log Autentikasi — BARUNA Administration" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AuthLogPage,
});

type Filters = { event: AuthEvent | "all"; search: string; from: string; to: string; adminsOnly: boolean; hideTestAccounts: boolean };
const EMPTY: Filters = { event: "all", search: "", from: "", to: "", adminsOnly: false, hideTestAccounts: true };
const SEARCH_RULE = /^[a-z0-9@.+\- ]*$/i;

/** Local calendar day → ISO instant; "to" is inclusive, so it becomes the next midnight. */
function dayStart(day: string, addDays = 0): string | undefined {
  if (!day) return undefined;
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setDate(d.getDate() + addDays);
  return d.toISOString();
}
const when = (d: string) => new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "medium" });

function AuthLogPage() {
  const listFn = useServerFn(listAuthEvents);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);

  const q = useInfiniteQuery({
    queryKey: ["admin", "auth-log", applied],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      listFn({
        data: {
          event: applied.event,
          search: applied.search,
          from: dayStart(applied.from),
          to: dayStart(applied.to, 1),
          adminsOnly: applied.adminsOnly,
          hideTestAccounts: applied.hideTestAccounts,
          beforeId: pageParam,
        },
      }),
    getNextPageParam: (last) => last.nextBeforeId ?? undefined,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
  const items = useMemo<AuthLogEntry[]>(() => (q.data?.pages ?? []).flatMap((p) => p.items), [q.data]);

  const apply = (next: Filters) => {
    setDraft(next);
    setApplied({ ...next, search: next.search.trim() });
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    apply(draft);
  };
  const rangeInvalid = Boolean(draft.from && draft.to && draft.from > draft.to);
  const searchInvalid = !SEARCH_RULE.test(draft.search.trim());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-navy">
          <LogIn className="h-6 w-6 text-marine" /> Log Autentikasi
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Catatan masuk dan keluar akun, pembuatan akun, konfirmasi email, serta perubahan dan reset kata sandi, lengkap dengan
          waktu, alamat IP, dan peramban bila tersedia. Dicatat otomatis oleh database sejak migrasi log autentikasi dijalankan;
          tidak dapat diubah atau dihapus dari aplikasi. Membuka halaman tanpa masuk ulang (sesi masih tersimpan) tidak
          menghasilkan catatan "Masuk".
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", ...AUTH_EVENTS] as const).map((ev) => (
          <button
            key={ev}
            type="button"
            onClick={() => apply({ ...draft, event: ev })}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${applied.event === ev ? "bg-marine text-white" : "border border-border bg-white text-navy hover:bg-muted"}`}
          >
            {ev === "all" ? "Semua kejadian" : AUTH_EVENT_INFO[ev].label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-white p-3 text-xs">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 font-semibold text-navy">
          Email
          <span className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={draft.search}
              onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
              maxLength={120}
              placeholder="mis. admin@gmail.com atau @kkp.go.id"
              className="w-full rounded-lg border border-border py-1.5 pl-7 pr-2 font-normal"
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 font-semibold text-navy">
          Dari tanggal
          <input type="date" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className="rounded-lg border border-border px-2 py-1.5 font-normal" />
        </label>
        <label className="flex flex-col gap-1 font-semibold text-navy">
          Sampai tanggal
          <input type="date" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className="rounded-lg border border-border px-2 py-1.5 font-normal" />
        </label>
        <button type="submit" disabled={rangeInvalid || searchInvalid} className="rounded-lg bg-marine px-4 py-2 font-semibold text-white hover:bg-navy disabled:opacity-50">
          Terapkan
        </button>
        <button type="button" onClick={() => apply(EMPTY)} className="rounded-lg border border-border px-3 py-2 font-semibold text-navy hover:bg-muted">
          Atur ulang
        </button>
        <div className="flex w-full flex-wrap gap-4 pt-1 font-normal text-navy">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={draft.adminsOnly} onChange={(e) => apply({ ...draft, adminsOnly: e.target.checked })} />
            Hanya akun admin / super admin
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={draft.hideTestAccounts} onChange={(e) => apply({ ...draft, hideTestAccounts: e.target.checked })} />
            Sembunyikan akun uji otomatis (@example.test)
          </label>
        </div>
        {rangeInvalid ? <p className="w-full text-destructive">"Dari tanggal" tidak boleh setelah "Sampai tanggal".</p> : null}
        {searchInvalid ? <p className="w-full text-destructive">Email hanya boleh berisi huruf, angka, titik, @, +, atau tanda minus.</p> : null}
      </form>

      {q.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat log…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">{(q.error as Error).message === "forbidden" ? "Akun Anda tidak memiliki izin membaca log." : (q.error as Error).message}</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Belum ada catatan yang cocok dengan filter ini.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b border-border bg-slate-50 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Waktu</th>
                  <th className="px-4 py-2.5 font-semibold">Kejadian</th>
                  <th className="px-4 py-2.5 font-semibold">Akun</th>
                  <th className="px-4 py-2.5 font-semibold">Peramban</th>
                  <th className="px-4 py-2.5 font-semibold">Alamat IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{when(e.at)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${AUTH_EVENT_INFO[e.event]?.tone ?? ""}`}>
                        {AUTH_EVENT_INFO[e.event]?.label ?? e.event}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-navy">{e.name || e.email || "Akun terhapus"}</span>
                      {e.isAdmin ? (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-navy px-1 py-0.5 text-[9px] font-bold uppercase text-white">
                          <ShieldCheck className="h-2.5 w-2.5" /> Admin
                        </span>
                      ) : null}
                      {e.name && e.email ? <span className="block text-[11px] text-muted-foreground">{e.email}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700" title={e.userAgent ?? undefined}>{describeDevice(e.userAgent) ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700">{e.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {q.hasNextPage ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => q.fetchNextPage()}
                disabled={q.isFetchingNextPage}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-muted disabled:opacity-50"
              >
                {q.isFetchingNextPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Muat lebih banyak
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">Semua catatan sudah ditampilkan.</p>
          )}
        </>
      )}
    </div>
  );
}
