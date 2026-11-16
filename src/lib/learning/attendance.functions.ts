// Attendance for cohort Course Offerings (Slide 23; migration 20261116030000;
// CATATAN_PERBAIKAN 2bb). Program managers (super_admin, admin, operator, approver)
// keep sessions and record attendance; a participant reads only their own.
// The database checks every rule.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const ATTENDANCE_STATUSES = ["present", "late", "excused", "absent"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type AttendanceSession = { id: string; title: string; startsAt: string; location: string | null; recorded: number };
export type AttendanceOverview = {
  sessions: AttendanceSession[];
  participants: Array<{ enrolmentId: string; userId: string; name: string; email: string | null }>;
  records: Array<{ sessionId: string; enrolmentId: string; status: AttendanceStatus; note: string | null }>;
};
export type MyAttendanceRow = { sessionId: string; title: string; startsAt: string; location: string | null; status: AttendanceStatus | null; note: string | null };
export type AttendanceOffering = { id: string; code: string; title: string; status: string };

const ERRORS: Array<[RegExp, string]> = [
  [/authentication_required/, "Sesi login berakhir. Silakan masuk kembali."],
  [/attendance_session_title_invalid/, "Judul sesi wajib 2–200 karakter."],
  [/attendance_session_time_required/, "Waktu mulai sesi wajib diisi."],
  [/attendance_session_location_invalid/, "Tempat maksimal 200 karakter."],
  [/attendance_not_applicable/, "Kehadiran hanya untuk course angkatan (cohort), bukan course mandiri."],
  [/attendance_session_has_records/, "Sesi ini sudah punya catatan kehadiran. Kosongkan catatannya dulu bila memang ingin menghapus sesi."],
  [/attendance_session_not_found|attendance_offering_not_found/, "Sesi atau course tidak ditemukan. Muat ulang halaman."],
  [/attendance_participant_not_enrolled/, "Ada peserta yang tidak (lagi) terdaftar di course ini. Muat ulang halaman."],
  [/attendance_status_invalid|attendance_records_invalid/, "Isi kehadiran tidak valid. Muat ulang halaman."],
  [/attendance_note_too_long/, "Catatan kehadiran maksimal 300 karakter."],
  [/(^|[^_a-z])forbidden([^_a-z]|$)/, "Hanya Operator, Approver, Admin, atau Super Admin yang dapat mengelola kehadiran."],
  [/attendance_|my_attendance|offering_sessions|PGRST202/, "Kehadiran membutuhkan migrasi database 20261116030000. Jalankan supabase/check_migrations.sql."],
];
const friendly = (m: string) => ERRORS.find(([p]) => p.test(m))?.[1] ?? m;

async function rpc<T>(context: { supabase: unknown }, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (context.supabase as Db).rpc(fn, args);
  if (error) throw new Error(friendly(`${error.message} ${error.code ?? ""}`));
  return data as T;
}

/** Cohort offerings a program manager can record attendance for. */
export const listAttendanceOfferings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AttendanceOffering[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as Db;
    const { data: can } = await db.rpc("_program_can_manage", { _uid: context.userId });
    if (!can) throw new Error(friendly("forbidden"));
    const { data, error } = await db
      .from("course_offerings")
      .select("id, offering_code, offering_title, status, master_courses(title)")
      .eq("learning_model", "cohort_based")
      .in("status", ["published", "closed", "completed"])
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<{ id: string; offering_code: string; offering_title: string; status: string; master_courses: { title: string } | null }>).map((o) => ({
      id: o.id,
      code: o.offering_code,
      title: o.master_courses?.title ? `${o.master_courses.title} — ${o.offering_title}` : o.offering_title,
      status: o.status,
    }));
  });

export const getAttendanceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ offeringId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => rpc<AttendanceOverview>(context, "attendance_overview", { _offering_id: data.offeringId }));

export const saveAttendanceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({
      offeringId: z.string().uuid(),
      id: z.string().uuid().nullable(),
      title: z.string().trim().min(2).max(200),
      startsAt: z.string().datetime({ offset: true }),
      location: z.string().trim().max(200).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) =>
    rpc<{ id: string }>(context, "attendance_session_save", {
      _offering_id: data.offeringId, _id: data.id, _title: data.title, _starts_at: data.startsAt, _location: data.location,
    }),
  );

export const deleteAttendanceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => rpc<{ deleted: boolean }>(context, "attendance_session_delete", { _id: data.id }));

export const setAttendanceRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({
      sessionId: z.string().uuid(),
      records: z.array(z.object({
        enrolmentId: z.string().uuid(),
        status: z.enum(ATTENDANCE_STATUSES).nullable(),
        note: z.string().trim().max(300).optional(),
      })).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => rpc<{ count: number }>(context, "attendance_record_set", { _session_id: data.sessionId, _records: data.records }));

/** My own attendance in an offering; [] when not enrolled or before the migration. */
export const getMyAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ offeringId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<MyAttendanceRow[]> => {
    const { data: rows, error } = await (context.supabase as Db).rpc("my_attendance", { _offering_id: data.offeringId });
    if (error) return [];
    return (rows ?? []) as MyAttendanceRow[];
  });
