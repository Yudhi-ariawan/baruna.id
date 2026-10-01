import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  GraduationCap,
  Award,
  Bookmark,
  CalendarDays,
  MessagesSquare,
  Globe,
  UserRound,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { RequireAuth } from "@/components/baruna/auth/RequireAuth";
import { DEMO_PARTICIPANTS, DEMO_SHORT_COURSES } from "@/data/demo";
import { useHomeExperience } from "@/components/baruna/home-experience";
import { useLanguage } from "@/lib/i18n";

function buildHref(pattern: string, params?: Record<string, string>) {
  if (!params) return pattern;
  let out = pattern;
  for (const [k, v] of Object.entries(params)) out = out.replace("$" + k, v);
  return out;
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Training Journey — BARUNA" },
      {
        name: "description",
        content:
          "Your personal BARUNA dashboard: applications, learning, certificates, alumni, community, and events.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { language } = useLanguage();
  const { viewer } = useHomeExperience();
  const isId = language === "id";

  const isAdmin =
    viewer?.variant === "admin" ||
    ["super_admin", "admin", "management", "qa_reviewer", "approver"].includes(
      viewer?.primaryRoleCode ?? "",
    );

  // Use a demo participant as fallback or demonstration baseline
  const me = DEMO_PARTICIPANTS.find((p) => p.status === "In Progress") ?? DEMO_PARTICIPANTS[0];
  const enrolledCourse =
    DEMO_SHORT_COURSES.find((c) => c.code === me?.courseCode) ?? DEMO_SHORT_COURSES[0];

  const activeCourseTitle = enrolledCourse?.title ?? (isId ? "Pelatihan Mandiri Terpadu" : "Self-Paced Training");
  const activeCourseProgress = me?.progressPct ?? 45;
  const activeCourseCode = enrolledCourse?.code ?? "BARUNA-FM-001";

  const cards: {
    icon: React.ElementType;
    title: string;
    body: string;
    cta: string;
    to: string;
    params?: Record<string, string>;
  }[] = [
    {
      icon: GraduationCap,
      title: isId ? "Pendaftaran Program" : "Applications",
      body: isId ? "Pantau status seleksi program pelatihan lengkap." : "Track applications to full training programs.",
      cta: isId ? "Buka" : "Open",
      to: "/academy/applications",
    },
    {
      icon: GraduationCap,
      title: isId ? "Pelatihan Mendatang" : "Upcoming Training",
      body: isId ? "Sesi yang dijadwalkan dalam 30 hari ke depan." : "Sessions scheduled in the next 30 days.",
      cta: isId ? "Lihat kalender" : "View calendar",
      to: "/events/calendar",
    },
    {
      icon: GraduationCap,
      title: isId ? "Pembelajaran Aktif" : "Active Learning",
      body: `${activeCourseTitle} — ${activeCourseProgress}% ${isId ? "selesai" : "complete"}`,
      cta: isId ? "Lanjutkan" : "Continue",
      to: "/academy/self-paced/$code",
      params: { code: activeCourseCode },
    },
    {
      icon: Award,
      title: isId ? "Sertifikat Saya" : "Certificates",
      body: isId ? "Sertifikat resmi dan pencapaian kompetensi Anda." : "Official certificates and verified competencies.",
      cta: isId ? "Lihat" : "View",
      to: "/academy/certification",
    },
    {
      icon: Bookmark,
      title: isId ? "Disimpan" : "Saved Items",
      body: isId ? "Pelatihan, acara, dan fellowship yang Anda simpan." : "Courses, events, and fellowships you saved.",
      cta: isId ? "Buka" : "Open",
      to: "/saved",
    },
    {
      icon: Globe,
      title: isId ? "Aplikasi Fellowship" : "Fellowship Applications",
      body: isId ? "Draf, terkirim, atau disetujui." : "Draft, submitted, or accepted.",
      cta: isId ? "Buka" : "Open",
      to: "/fellowship",
    },
    {
      icon: MessagesSquare,
      title: isId ? "Partisipasi Komunitas" : "Community Participation",
      body: isId ? "Unggahan, balasan, dan jawaban pakar." : "Posts, replies, and expert answers.",
      cta: isId ? "Buka" : "Open",
      to: "/community",
    },
    {
      icon: CalendarDays,
      title: isId ? "Acara Mendatang" : "Upcoming Events",
      body: isId ? "Webinar, lokakarya, dan konferensi maritim." : "Webinars, workshops, and conferences.",
      cta: isId ? "Buka" : "Open",
      to: "/events",
    },
    {
      icon: Award,
      title: isId ? "Aktivitas Alumni" : "Alumni Activities",
      body: isId ? "Tetap terhubung dengan jejaring angkatan Anda." : "Stay connected with your cohort.",
      cta: isId ? "Buka" : "Open",
      to: "/academy/alumni-network",
    },
    {
      icon: GraduationCap,
      title: isId ? "Rekomendasi Pembelajaran" : "Recommended Learning",
      body: isId ? "Berdasarkan minat dan jalur pelatihan Anda." : "Based on your interests and completions.",
      cta: isId ? "Jelajahi" : "Browse",
      to: "/academy/self-paced",
    },
    {
      icon: Bookmark,
      title: isId ? "Transkrip Belajar" : "Learning Records",
      body: isId ? "Rekam jejak komprehensif aktivitas belajar di BARUNA." : "Full transcript of your BARUNA activity.",
      cta: isId ? "Buka" : "Open",
      to: "/academy/learn",
    },
    {
      icon: GraduationCap,
      title: isId ? "Kursus Selesai" : "Completed Courses",
      body: isId ? "Semua materi yang telah berhasil Anda tuntaskan." : "Everything you've finished.",
      cta: isId ? "Buka" : "Open",
      to: "/academy/learn",
    },
  ];

  const displayName = viewer?.displayName || me.fullName;
  const roleLabel = viewer?.primaryRoleLabel || (isId ? "Profil Peserta" : "Participant Profile");

  return (
    <RequireAuth>
      <PageShell
        sidebar={{
          icon: LayoutDashboard,
          title: isId ? "Perjalanan Belajar Saya" : "My Training Journey",
          subtitle: isId ? "Ruang kerja peserta & pelatihan." : "Personal learning workspace.",
          sections: [
            {
              label: isId ? "Navigasi" : "Navigation",
              items: [
                { label: isId ? "Ringkasan" : "Overview", active: true },
                { label: isId ? "Pendaftaran" : "Applications", to: "/academy/applications" },
                { label: isId ? "Pembelajaran Saya" : "My Learning", to: "/academy/learn" },
                { label: isId ? "Sertifikat" : "Certificates", to: "/academy/certification" },
                { label: isId ? "Disimpan" : "Saved", to: "/saved" },
              ],
            },
          ],
        }}
        cta={{
          icon: LayoutDashboard,
          title: isId ? "Jelajahi Lebih Banyak di BARUNA" : "Explore more of BARUNA",
          description: isId ? "Temukan pakar, acara, dan komunitas maritim." : "Browse experts, events, and communities.",
          button: isId ? "Jelajahi Akademi" : "Browse Academy",
          href: "/academy",
        }}
      >
        {isAdmin ? (
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-marine/20 bg-marine/5 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marine text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-navy">
                  {isId ? "Panel Administrator Terdeteksi" : "Administrator Privileges Active"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isId
                    ? "Anda memiliki akses ke Admin Console untuk verifikasi instruktur, manajemen pengguna, dan modul."
                    : "You have access to Admin Console for user governance, expert verification, and module audits."}
                </p>
              </div>
            </div>
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 rounded-xl bg-marine px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-marine/90 shrink-0"
            >
              {isId ? "Buka Dashboard Admin" : "Open Admin Dashboard"} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="rounded-full bg-marine/10 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-marine">
              {roleLabel} · {displayName}
            </span>
            <h1 className="mt-3 font-display text-3xl font-extrabold text-navy">
              {isId ? "Perjalanan Belajar Saya" : "My Training Journey"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isId
                ? "Satu tempat untuk seluruh aktivitas dan perkembangan Anda di BARUNA."
                : "A single place for everything you're doing on BARUNA."}
            </p>
          </div>
          <Link
            to="/account/profile"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-navy shadow-soft transition hover:border-marine hover:text-marine"
          >
            <UserRound className="h-4 w-4" /> {isId ? "Edit Profil" : "Edit Profile"}
          </Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <div key={c.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft hover:border-marine/40 transition-colors">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-marine">
                <c.icon className="h-4 w-4" /> {c.title}
              </div>
              <p className="mt-2 text-sm text-foreground/80">{c.body}</p>
              <Link
                to={buildHref(c.to, c.params)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-marine hover:text-navy transition-colors"
              >
                {c.cta} →
              </Link>
            </div>
          ))}
        </div>
      </PageShell>
    </RequireAuth>
  );
}
