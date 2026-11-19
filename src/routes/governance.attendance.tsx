import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, Loader2, Plus, Save, Trash2 } from "lucide-react";
import {
  ATTENDANCE_STATUSES,
  deleteAttendanceSession,
  getAttendanceOverview,
  listAttendanceOfferings,
  saveAttendanceSession,
  setAttendanceRecords,
  type AttendanceOverview,
  type AttendanceStatus,
} from "@/lib/learning/attendance.functions";
import { LoadingSkeleton } from "@/components/baruna/console/LoadingSkeleton";

// Kehadiran (Slide 23 PB-ACA-04: Operator "Catat Kehadiran"; CATATAN_PERBAIKAN 2bb).
// Sessions of a cohort Course Offering and one status per enrolled participant.
export const Route = createFileRoute("/governance/attendance")({
  head: () => ({ meta: [{ title: "Kehadiran — Konsol Kurasi BARUNA" }] }),
  component: AttendancePage,
});

const LABEL: Record<AttendanceStatus, string> = { present: "Hadir", late: "Terlambat", excused: "Izin", absent: "Tidak hadir" };
const fmt = (d: string) => new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

function AttendancePage() {
  const offeringsFn = useServerFn(listAttendanceOfferings);
  const offeringsQ = useQuery({ queryKey: ["governance", "attendance", "offerings"], queryFn: () => offeringsFn(), staleTime: 60_000 });
  const [offeringId, setOfferingId] = useState("");
  useEffect(() => { if (!offeringId && offeringsQ.data?.[0]) setOfferingId(offeringsQ.data[0].id); }, [offeringsQ.data, offeringId]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-navy"><CalendarCheck className="h-6 w-6 text-marine" /> Kehadiran</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Buat sesi untuk course angkatan, lalu catat kehadiran setiap peserta yang terdaftar. Peserta melihat kehadirannya sendiri di
          halaman course. Kehadiran belum menjadi syarat lulus sampai aturannya diputuskan.
        </p>
      </div>
      {offeringsQ.isError ? <p className="text-sm text-destructive">{(offeringsQ.error as Error).message}</p> : null}
      <label className="block max-w-xl text-xs font-semibold text-navy">
        Course Offering
        <select value={offeringId} onChange={(e) => setOfferingId(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-2 text-sm">
          {(offeringsQ.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.title} ({o.code}{o.status !== "published" ? `, ${o.status}` : ""})</option>)}
        </select>
      </label>
      {offeringsQ.data && offeringsQ.data.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada course angkatan.</p> : null}
      {offeringId ? <OfferingAttendance key={offeringId} offeringId={offeringId} /> : null}
    </div>
  );
}

function OfferingAttendance({ offeringId }: { offeringId: string }) {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getAttendanceOverview);
  const saveSessionFn = useServerFn(saveAttendanceSession);
  const deleteSessionFn = useServerFn(deleteAttendanceSession);
  const key = ["governance", "attendance", offeringId];
  const q = useQuery({ queryKey: key, queryFn: () => overviewFn({ data: { offeringId } }), staleTime: 15_000 });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const refresh = () => void qc.invalidateQueries({ queryKey: key });
  const addSession = useMutation({
    mutationFn: () => saveSessionFn({ data: { offeringId, id: null, title, startsAt: new Date(startsAt).toISOString(), location: location.trim() || null } }),
    onSuccess: (r) => { setTitle(""); setStartsAt(""); setLocation(""); setSessionId(r.id); refresh(); },
  });
  const removeSession = useMutation({ mutationFn: (id: string) => deleteSessionFn({ data: { id } }), onSuccess: () => { setSessionId(null); refresh(); } });

  if (q.isLoading) return <LoadingSkeleton />;
  if (q.isError) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const data = q.data!;
  const current = data.sessions.find((s) => s.id === sessionId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <section className="space-y-3 rounded-2xl border border-border bg-white p-4">
        <h2 className="font-display text-base font-bold text-navy">Sesi ({data.sessions.length})</h2>
        <ul className="space-y-1.5">
          {data.sessions.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => setSessionId(s.id)}
                className={`w-full rounded-lg border px-2.5 py-2 text-left text-xs ${s.id === sessionId ? "border-marine bg-marine/5" : "border-border hover:bg-muted"}`}>
                <span className="block font-semibold text-navy">{s.title}</span>
                <span className="text-muted-foreground">{fmt(s.startsAt)}{s.location ? ` · ${s.location}` : ""} · {s.recorded}/{data.participants.length} dicatat</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="space-y-1.5 rounded-lg border border-dashed border-border p-2.5 text-xs">
          <p className="font-semibold text-navy">Tambah sesi</p>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Judul, mis. Hari 1 — Pembukaan" className="w-full rounded border border-border px-2 py-1.5" />
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full rounded border border-border px-2 py-1.5" />
          <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} placeholder="Tempat (opsional)" className="w-full rounded border border-border px-2 py-1.5" />
          <button type="button" disabled={addSession.isPending || title.trim().length < 2 || !startsAt} onClick={() => addSession.mutate()}
            className="inline-flex items-center gap-1 rounded-lg bg-marine px-3 py-1.5 font-semibold text-white disabled:opacity-50">
            {addSession.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Tambah
          </button>
          {addSession.isError ? <p className="text-destructive">{(addSession.error as Error).message}</p> : null}
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-border bg-white p-4">
        {!current ? (
          <p className="text-sm text-muted-foreground">Pilih sesi untuk mencatat kehadiran. Peserta terdaftar: {data.participants.length}.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold text-navy">{current.title}</h2>
                <p className="text-xs text-muted-foreground">{fmt(current.startsAt)}{current.location ? ` · ${current.location}` : ""}</p>
              </div>
              <button type="button" disabled={removeSession.isPending} onClick={() => { if (window.confirm(`Hapus sesi "${current.title}"?`)) removeSession.mutate(current.id); }}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" /> Hapus sesi
              </button>
            </div>
            {removeSession.isError ? <p className="mb-2 text-xs text-destructive">{(removeSession.error as Error).message}</p> : null}
            <SessionGrid key={current.id} sessionId={current.id} data={data} onSaved={refresh} />
          </>
        )}
      </section>
    </div>
  );
}

function SessionGrid({ sessionId, data, onSaved }: { sessionId: string; data: AttendanceOverview; onSaved: () => void }) {
  const recordsFn = useServerFn(setAttendanceRecords);
  const initial = useMemo(
    () => Object.fromEntries(data.records.filter((r) => r.sessionId === sessionId).map((r) => [r.enrolmentId, { status: r.status as AttendanceStatus | null, note: r.note ?? "" }])),
    [data.records, sessionId],
  );
  const [draft, setDraft] = useState<Record<string, { status: AttendanceStatus | null; note: string }>>(initial);
  const changed = data.participants.filter((p) => {
    const a = draft[p.enrolmentId], b = initial[p.enrolmentId];
    return (a?.status ?? null) !== (b?.status ?? null) || (a?.note ?? "") !== (b?.note ?? "");
  });
  const save = useMutation({
    mutationFn: () => recordsFn({ data: { sessionId, records: changed.map((p) => ({ enrolmentId: p.enrolmentId, status: draft[p.enrolmentId]?.status ?? null, note: draft[p.enrolmentId]?.note || undefined })) } }),
    onSuccess: onSaved,
  });
  const set = (id: string, patch: Partial<{ status: AttendanceStatus | null; note: string }>) =>
    setDraft((d) => ({ ...d, [id]: { status: d[id]?.status ?? null, note: d[id]?.note ?? "", ...patch } }));

  if (data.participants.length === 0) return <p className="text-sm text-muted-foreground">Belum ada peserta terdaftar di course ini.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 text-xs">
        <button type="button" onClick={() => data.participants.forEach((p) => set(p.enrolmentId, { status: "present" }))} className="rounded-lg border border-border px-2.5 py-1 font-semibold text-navy hover:bg-muted">Tandai semua hadir</button>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {data.participants.map((p) => (
          <li key={p.enrolmentId} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
            <span className="min-w-[10rem] flex-1">
              <span className="block font-semibold text-navy">{p.name}</span>
              {p.email ? <span className="text-muted-foreground">{p.email}</span> : null}
            </span>
            <span className="flex flex-wrap gap-1">
              {ATTENDANCE_STATUSES.map((st) => (
                <button key={st} type="button" onClick={() => set(p.enrolmentId, { status: draft[p.enrolmentId]?.status === st ? null : st })}
                  className={`rounded-md border px-2 py-1 font-semibold ${draft[p.enrolmentId]?.status === st ? "border-marine bg-marine text-white" : "border-border text-navy hover:bg-muted"}`}>
                  {LABEL[st]}
                </button>
              ))}
            </span>
            <input value={draft[p.enrolmentId]?.note ?? ""} onChange={(e) => set(p.enrolmentId, { note: e.target.value })} maxLength={300} placeholder="Catatan"
              className="w-40 rounded border border-border px-2 py-1" />
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <button type="button" disabled={save.isPending || changed.length === 0} onClick={() => save.mutate()}
          className="inline-flex items-center gap-1 rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan kehadiran ({changed.length} berubah)
        </button>
        {save.isSuccess && changed.length === 0 ? <span className="text-xs text-emerald-700">Tersimpan.</span> : null}
        {save.isError ? <span className="text-xs text-destructive">{(save.error as Error).message}</span> : null}
      </div>
    </div>
  );
}

