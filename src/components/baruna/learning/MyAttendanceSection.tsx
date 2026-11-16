// "Kehadiran saya" on the course page (Slide 23; CATATAN_PERBAIKAN 2bb): the sessions
// of my cohort offering and how the operator recorded me. Read from the server, so
// it is the same on every device. Hidden when the offering has no sessions.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAttendance, type AttendanceStatus } from "@/lib/learning/attendance.functions";

const LABEL: Record<AttendanceStatus, { text: string; cls: string }> = {
  present: { text: "Hadir", cls: "bg-emerald-100 text-emerald-800" },
  late: { text: "Terlambat", cls: "bg-amber-100 text-amber-800" },
  excused: { text: "Izin", cls: "bg-sky-100 text-sky-800" },
  absent: { text: "Tidak hadir", cls: "bg-red-100 text-red-800" },
};

export function MyAttendanceSection({ offeringId }: { offeringId: string }) {
  const fn = useServerFn(getMyAttendance);
  const q = useQuery({ queryKey: ["learning", "my-attendance", offeringId], queryFn: () => fn({ data: { offeringId } }), staleTime: 30_000 });
  const rows = q.data ?? [];
  if (rows.length === 0) return null;
  const attended = rows.filter((r) => r.status === "present" || r.status === "late").length;
  const recorded = rows.filter((r) => r.status).length;
  return (
    <div className="mt-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">Kehadiran</div>
      <div className="mt-1 text-sm font-semibold text-navy">Hadir {attended} dari {recorded} sesi tercatat</div>
      <ul className="mt-2 space-y-1">
        {rows.map((r) => (
          <li key={r.sessionId} className="flex items-start justify-between gap-2 text-xs">
            <span className="min-w-0">
              <span className="block truncate font-medium text-navy">{r.title}</span>
              <span className="text-muted-foreground">{new Date(r.startsAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
            </span>
            {r.status ? (
              <span className={`shrink-0 rounded px-1.5 py-0.5 font-semibold ${LABEL[r.status].cls}`} title={r.note ?? undefined}>{LABEL[r.status].text}</span>
            ) : (
              <span className="shrink-0 text-muted-foreground">Belum dicatat</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
