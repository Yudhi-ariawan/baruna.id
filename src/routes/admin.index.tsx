import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  Layers,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { listUsers } from "@/lib/admin/users.functions";
import { listAdminExpertApplications } from "@/lib/admin/experts.functions";
import { listAdminModuleSubmissions } from "@/lib/admin/modules.functions";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard Overview — BARUNA Administration" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const usersFn = useServerFn(listUsers);
  const expertsFn = useServerFn(listAdminExpertApplications);
  const modulesFn = useServerFn(listAdminModuleSubmissions);

  const usersQuery = useQuery({
    queryKey: ["admin", "users", ""],
    queryFn: () => usersFn({ data: { search: "" } }),
    retry: false,
  });

  const expertsQuery = useQuery({
    queryKey: ["admin", "expert-applications"],
    queryFn: () => expertsFn(),
    retry: false,
  });

  const modulesQuery = useQuery({
    queryKey: ["admin", "modules"],
    queryFn: () => modulesFn({ data: { search: "" } }),
    retry: false,
  });

  const totalUsers = usersQuery.data?.users?.length ?? 0;
  const expertUsers =
    usersQuery.data?.users?.filter((u) => u.roles.some((r) => r.code === "expert")).length ?? 0;

  const expertApps = expertsQuery.data?.items ?? [];
  const pendingExpertApps = expertApps.filter(
    (a) => a.status === "pending" || a.status === "resubmitted" || a.status === "in_review"
  );

  const moduleItems = modulesQuery.data ?? [];
  const pendingModules = moduleItems.filter(
    (m) => m.status === "pending_review" || m.status === "resubmitted" || m.status === "submitted" || m.status === "pending" || m.status === "under_review"
  );

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-navy via-navy to-marine p-6 sm:p-8 text-white shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-xs text-sky-200">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-300" />
              Pusat Tata Kelola &amp; Administrasi BARUNA
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
              Selamat Datang di Portal Admin
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed">
              Pantau status verifikasi pakar, materi modul pelatihan akademi maritim, dan kelola hak akses pengguna secara terpusat.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-navy hover:bg-slate-100 transition shadow-xs"
            >
              <Users className="h-4 w-4 text-marine" /> Kelola Pengguna
            </Link>
            <Link
              to="/admin/experts"
              className="inline-flex items-center gap-2 rounded-xl bg-marine/40 border border-white/20 px-4 py-2.5 text-xs font-bold text-white hover:bg-marine/60 transition"
            >
              <UserCheck className="h-4 w-4" /> Verifikasi Pakar
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-soft transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Pengguna
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-navy">
              {usersQuery.isLoading ? "…" : totalUsers}
            </span>
            <span className="text-xs text-muted-foreground">akun terdaftar</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-emerald-600" />
            Semua pengguna di Supabase Auth
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-soft transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Instruktur &amp; Pakar
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <UserCheck className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-navy">
              {usersQuery.isLoading ? "…" : expertUsers}
            </span>
            <span className="text-xs text-muted-foreground">role expert</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Termasuk 10 instruktur BPPP &amp; Poltek
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-soft transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Antrean Pakar
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-navy">
              {expertsQuery.isLoading ? "…" : pendingExpertApps.length}
            </span>
            <span className="text-xs text-amber-700 font-semibold">perlu ditinjau</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Pengajuan join expert baru/revisi
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-soft transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Modul Pelatihan
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-purple-50 text-purple-600">
              <BookOpen className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-navy">
              {modulesQuery.isLoading ? "…" : moduleItems.length}
            </span>
            <span className="text-xs text-muted-foreground">total materi</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {pendingModules.length} modul menunggu kurasi
          </p>
        </div>
      </div>

      {/* Main Sections: Quick Actions & Governance Hub */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Governance Queues (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Expert Applications Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-marine/10 p-1.5 text-marine">
                  <UserCheck className="h-4 w-4" />
                </span>
                <h2 className="font-display text-base font-bold text-navy">
                  Antrean Pengajuan Pakar (Join Expert)
                </h2>
              </div>
              <Link
                to="/admin/experts"
                className="inline-flex items-center gap-1 text-xs font-semibold text-marine hover:text-navy transition"
              >
                Lihat Semua <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {expertsQuery.isLoading ? (
              <p className="text-xs text-muted-foreground py-4">Memuat antrean pengajuan pakar…</p>
            ) : pendingExpertApps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-xs font-bold text-navy">Semua Pengajuan Telah Ditinjau</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Tidak ada pengajuan pakar yang sedang menunggu verifikasi saat ini.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingExpertApps.slice(0, 4).map((app) => (
                  <div key={app.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-navy truncate">{app.fullName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {app.institution} • {app.country || "Indonesia"}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                      {app.status}
                    </span>
                    <Link
                      to="/admin/experts"
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Periksa
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Modules Queue Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-purple-100 p-1.5 text-purple-700">
                  <BookOpen className="h-4 w-4" />
                </span>
                <h2 className="font-display text-base font-bold text-navy">
                  Antrean Kurasi Modul Pelatihan
                </h2>
              </div>
              <Link
                to="/admin/modules"
                className="inline-flex items-center gap-1 text-xs font-semibold text-marine hover:text-navy transition"
              >
                Lihat Semua <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {modulesQuery.isLoading ? (
              <p className="text-xs text-muted-foreground py-4">Memuat antrean modul…</p>
            ) : pendingModules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-xs font-bold text-navy">Semua Modul Terverifikasi</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Tidak ada modul baru yang sedang menunggu kurasi.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingModules.slice(0, 4).map((mod) => (
                  <div key={mod.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-navy truncate">{mod.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {mod.category || "Pelatihan Maritim"}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                      {mod.status}
                    </span>
                    <Link
                      to="/admin/modules"
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Tinjau
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Navigation Cards (1 col) */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <h3 className="font-display text-sm font-bold text-navy border-b border-slate-100 pb-3">
              Pintasan Cepat Tata Kelola
            </h3>
            <div className="space-y-2.5">
              <Link
                to="/admin/users"
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 hover:border-marine/40 hover:bg-white hover:shadow-2xs transition"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-100 text-blue-700 shrink-0">
                  <UserPlus className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs text-navy">Kelola Pengguna</p>
                  <p className="text-[11px] text-muted-foreground">Tambah user, invite, atau ubah role RBAC</p>
                </div>
              </Link>

              <Link
                to="/admin/experts"
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 hover:border-marine/40 hover:bg-white hover:shadow-2xs transition"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                  <UserCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs text-navy">Verifikasi Pakar</p>
                  <p className="text-[11px] text-muted-foreground">Kurasi berkas CV, sertifikat &amp; foto</p>
                </div>
              </Link>

              <Link
                to="/admin/modules"
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 hover:border-marine/40 hover:bg-white hover:shadow-2xs transition"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-purple-100 text-purple-700 shrink-0">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs text-navy">Verifikasi Modul</p>
                  <p className="text-[11px] text-muted-foreground">Setujui silabus, video &amp; materi PPT</p>
                </div>
              </Link>

              <Link
                to="/governance/subjects"
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 hover:border-marine/40 hover:bg-white hover:shadow-2xs transition"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-100 text-amber-700 shrink-0">
                  <Layers className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs text-navy">Audit &amp; Approvals</p>
                  <p className="text-[11px] text-muted-foreground">Riwayat keputusan &amp; log tata kelola</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
