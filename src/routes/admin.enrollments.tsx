import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  GraduationCap,
  ShieldCheck,
  AlertCircle,
  User,
  Building,
  Mail,
  Calendar,
  Sparkles,
  BookOpen,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  listAdminCourseEnrollments,
  decideAdminCourseEnrollment,
  type AdminCourseEnrollmentItem,
} from "@/lib/admin/enrollments.functions";

export const Route = createFileRoute("/admin/enrollments")({
  head: () => ({
    meta: [
      { title: "Persetujuan Pendaftaran Peserta — BARUNA Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminEnrollmentsPage,
});

function AdminEnrollmentsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<AdminCourseEnrollmentItem | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");

  const listFn = useServerFn(listAdminCourseEnrollments);
  const decideFn = useServerFn(decideAdminCourseEnrollment);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "course-enrollments", activeTab, search],
    queryFn: () => listFn({ data: { status: activeTab, search } }),
  });

  const decideMutation = useMutation({
    mutationFn: async ({
      item,
      decision,
    }: {
      item: AdminCourseEnrollmentItem;
      decision: "approve" | "reject";
    }) => {
      return decideFn({
        data: {
          id: item.id,
          userId: item.userId,
          courseId: item.courseId,
          decision,
          decisionNotes: decisionNotes.trim() || undefined,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(res.message);
      setSelectedItem(null);
      setDecisionNotes("");
      queryClient.invalidateQueries({ queryKey: ["admin", "course-enrollments"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Gagal memproses keputusan pendaftaran.");
    },
  });

  const items = data?.items || [];
  const counts = data?.counts || { total: 0, pending: 0, approved: 0, rejected: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-marine/10 text-marine">
              <GraduationCap className="h-5 w-5" />
            </span>
            <h1 className="font-display text-2xl font-bold text-navy">
              Persetujuan Pendaftaran Peserta
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Verifikasi permohonan kepesertaan modul pelatihan (SOP PB-ACA-03). Peserta yang disetujui otomatis mendapatkan peran <strong>Participant</strong> dan akses ruang belajar.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Segarkan Data
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
            Total Pendaftaran
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-navy">{counts.total}</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-soft">
          <p className="text-[0.7rem] font-bold uppercase tracking-wider text-amber-700">
            Menunggu Persetujuan
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-amber-700">{counts.pending}</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-soft">
          <p className="text-[0.7rem] font-bold uppercase tracking-wider text-emerald-700">
            Disetujui (Aktif)
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-emerald-700">{counts.approved}</p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 shadow-soft">
          <p className="text-[0.7rem] font-bold uppercase tracking-wider text-red-700">
            Ditolak
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-red-700">{counts.rejected}</p>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: "pending", label: "Menunggu Review", count: counts.pending },
            { key: "all", label: "Semua", count: counts.total },
            { key: "approved", label: "Disetujui", count: counts.approved },
            { key: "rejected", label: "Ditolak", count: counts.rejected },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                activeTab === tab.key
                  ? "bg-navy text-white shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.2 text-[0.65rem] ${
                  activeTab === tab.key ? "bg-white/20 text-white" : "bg-card text-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, email, modul..."
            className="w-full rounded-xl border border-border bg-muted/30 pl-9 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:border-marine focus:outline-none"
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            <Clock className="mx-auto h-6 w-6 animate-spin text-marine mb-2" />
            Memuat data permohonan pendaftaran...
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
            Tidak ada permohonan pendaftaran peserta yang cocok dengan kriteria filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nama Pemohon</th>
                  <th className="px-4 py-3">Modul Pelatihan</th>
                  <th className="px-4 py-3">Role Saat Ini</th>
                  <th className="px-4 py-3">Tanggal Daftar</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-navy">{item.applicantName}</div>
                      <div className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                        <Mail className="h-3 w-3" /> {item.applicantEmail || "—"}
                      </div>
                      {item.applicantOrganization && (
                        <div className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                          <Building className="h-3 w-3" /> {item.applicantOrganization}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-navy max-w-[280px] line-clamp-1">
                        {item.courseTitle}
                      </div>
                      <div className="font-mono text-[0.65rem] text-muted-foreground">
                        ID: {item.courseId.slice(0, 16)}...
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {item.userCurrentRoles.map((role) => (
                          <span
                            key={role}
                            className={`rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${
                              role === "expert"
                                ? "bg-purple-100 text-purple-700"
                                : role === "admin" || role === "super_admin"
                                  ? "bg-blue-100 text-blue-700"
                                  : role === "participant"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {role.replace("_", " ")}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    <td className="px-4 py-3.5">
                      {item.status === "pending" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[0.65rem] font-bold text-amber-800">
                          <Clock className="h-3 w-3" /> Menunggu Review
                        </span>
                      )}
                      {item.status === "approved" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[0.65rem] font-bold text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" /> Disetujui (ACC)
                        </span>
                      )}
                      {item.status === "rejected" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[0.65rem] font-bold text-red-800">
                          <XCircle className="h-3 w-3" /> Ditolak
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setDecisionNotes(item.decisionNotes || "");
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-marine px-3 py-1.5 text-xs font-bold text-white hover:bg-marine/90 transition shadow-xs"
                      >
                        Tinjau <ArrowRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal Dialog */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-marine/10 text-marine">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-base font-bold text-navy">
                    Tinjau Pendaftaran Peserta
                  </h3>
                  <p className="text-[0.7rem] text-muted-foreground">
                    Verifikasi identitas dan tentukan persetujuan hak akses modul
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition"
              >
                ✕
              </button>
            </div>

            {/* Applicant & Course Summary */}
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/30 p-3 text-xs">
              <div>
                <p className="text-[0.65rem] font-bold uppercase text-muted-foreground">Nama Peserta</p>
                <p className="font-semibold text-navy">{selectedItem.applicantName}</p>
                <p className="text-[0.7rem] text-muted-foreground">{selectedItem.applicantEmail}</p>
              </div>

              <div>
                <p className="text-[0.65rem] font-bold uppercase text-muted-foreground">Instansi / Lembaga</p>
                <p className="font-semibold text-navy">
                  {selectedItem.applicantOrganization || "Umum / Individu"}
                </p>
              </div>

              <div className="col-span-2 pt-2 border-t border-border/50">
                <p className="text-[0.65rem] font-bold uppercase text-muted-foreground">Modul Pelatihan</p>
                <p className="font-semibold text-navy">{selectedItem.courseTitle}</p>
              </div>

              {selectedItem.notes && (
                <div className="col-span-2 pt-2 border-t border-border/50">
                  <p className="text-[0.65rem] font-bold uppercase text-muted-foreground">
                    Catatan Pengajuan dari Pemohon
                  </p>
                  <p className="mt-0.5 rounded-lg bg-card p-2 text-foreground/90 italic">
                    "{selectedItem.notes}"
                  </p>
                </div>
              )}
            </div>

            {/* Current Status & Role Impact */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-900">
              <p className="flex items-center gap-1.5 font-bold">
                <Sparkles className="h-4 w-4 text-marine" /> Otomatisasi Peran (RBAC):
              </p>
              <p className="mt-1 text-[0.75rem] text-blue-800 leading-relaxed">
                Saat disetujui, akun ini otomatis mendapatkan hak akses <strong>Participant</strong>. Ruang belajar modul akan langsung terbuka bagi peserta. Jika akun sudah berstatus <strong>Expert</strong>, status Expert tetap terlindungi.
              </p>
            </div>

            {/* Decision Notes Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-navy">
                Catatan Keputusan Admin (Opsional):
              </label>
              <textarea
                rows={3}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Masukkan catatan atau alasan jika disetujui/ditolak..."
                className="w-full rounded-xl border border-border p-2.5 text-xs focus:border-marine focus:outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition"
              >
                Batal
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={decideMutation.isPending}
                  onClick={() =>
                    decideMutation.mutate({
                      item: selectedItem,
                      decision: "reject",
                    })
                  }
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                >
                  Tolak Pendaftaran
                </button>

                <button
                  type="button"
                  disabled={decideMutation.isPending}
                  onClick={() =>
                    decideMutation.mutate({
                      item: selectedItem,
                      decision: "approve",
                    })
                  }
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-xs disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {decideMutation.isPending ? "Memproses..." : "Setujui & Berikan Akses (ACC)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

