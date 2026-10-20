import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, ClipboardList, FileText, GraduationCap, Info, UserCheck, type LucideIcon } from "lucide-react";
import { useConsoleAccess } from "@/components/baruna/console/useConsoleAccess";
import type { ConsoleMenuKey } from "@/lib/governance/console-access.functions";

export const Route = createFileRoute("/governance/")({
  head: () => ({ meta: [{ title: "Beranda Konsol Kurasi — BARUNA" }] }),
  component: ConsoleHome,
});

// Role descriptions from Slide 16 (Role dan Hak Akses BARUNA).
const ROLE_INFO: Record<string, { label: string; duty: string }> = {
  super_admin: { label: "Super Admin", duty: "Kelola sistem, user, role, konfigurasi, dan audit secara menyeluruh." },
  admin: { label: "Admin", duty: "Kelola sistem, user, dan konfigurasi." },
  operator: { label: "Operator", duty: "Mengelola data harian, input, editing, dan persiapan dokumen untuk review." },
  reviewer: { label: "Reviewer", duty: "Meninjau substansi dan kelengkapan data serta memberikan catatan." },
  verifier: { label: "Verifier", duty: "Memverifikasi kebenaran data, kepatuhan, dan kesesuaian kebijakan." },
  approver: { label: "Approver", duty: "Menyetujui konten/data untuk dipublikasikan atau digunakan dalam layanan." },
  publisher: { label: "Publisher", duty: "Mempublikasikan konten/data ke pengguna sesuai hak akses." },
};

const MENUS: Array<{ key: ConsoleMenuKey; label: string; to: string; icon: LucideIcon; what: string }> = [
  { key: "experts", label: "Verifikasi Expert", to: "/governance/experts", icon: UserCheck, what: "Pengajuan Join as an Expert (PB-EXP-02)." },
  { key: "modules", label: "Verifikasi Modul", to: "/governance/modules", icon: BookOpen, what: "Modul pelatihan yang diajukan trainer." },
  { key: "publications", label: "Verifikasi Publikasi", to: "/governance/publications", icon: FileText, what: "Kontribusi Knowledge Hub." },
  { key: "enrollments", label: "Persetujuan Peserta", to: "/governance/enrollments", icon: GraduationCap, what: "Pendaftaran peserta ke kursus dan program (PB-ACA-03)." },
  { key: "trainingNeeds", label: "Permintaan Pelatihan", to: "/governance/training-needs", icon: ClipboardList, what: "Request a Training dari individu, instansi, atau mitra." },
];

function ConsoleHome() {
  const { data: access } = useConsoleAccess();
  if (!access) return null;
  const roles = access.roles.filter((code) => ROLE_INFO[code]);
  const visible = MENUS.filter((menu) => access.menus[menu.key].read);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Konsol Kurasi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review, verifikasi, dan persetujuan sesuai peran Anda. Menu dan tombol yang tampil mengikuti hak akses
          masing-masing peran; pengajuan milik Anda sendiri tidak dapat Anda putuskan.
        </p>
      </div>

      {roles.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((code) => (
            <div key={code} className="rounded-xl border border-border bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-marine">{ROLE_INFO[code].label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{ROLE_INFO[code].duty}</p>
            </div>
          ))}
        </div>
      ) : null}

      {access.roles.includes("publisher") && !access.isAdmin ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Tahap publikasi belum terpisah: konten yang disetujui Approver langsung tayang. Antrean publikasi untuk
            Publisher akan tersedia setelah alurnya ditetapkan.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((menu) => {
          const Icon = menu.icon;
          const decide = access.menus[menu.key].decide;
          return (
            <Link
              key={menu.key}
              to={menu.to}
              className="group flex items-start gap-4 rounded-2xl border border-border bg-white p-5 shadow-xs transition hover:border-marine"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-bold text-navy">{menu.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{menu.what}</p>
                <span
                  className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    decide ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {decide
                    ? "Baca & putuskan"
                    : menu.key === "trainingNeeds"
                      ? "Rekomendasi bila ditugaskan"
                      : "Baca saja"}
                </span>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-marine" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
