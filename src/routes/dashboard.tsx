import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
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
  BookOpen,
  Plus,
  ListChecks,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { RequireAuth } from "@/components/baruna/auth/RequireAuth";
import { TrainerKnowledgePublicationsCard } from "@/components/baruna/experts/TrainerKnowledgePublicationsCard";
import { masterByCode } from "@/data/masterModules";
import { useApplications, isCourseComplete } from "@/lib/application";
import { useSavedEvents } from "@/lib/eventActions";
import { useSavedIds } from "@/lib/khSaved";
import { getPublishedModulesCatalog } from "@/lib/learning/learning.functions";
import { shortCourseProgress, useShortCourses } from "@/lib/shortCourses";
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
  errorComponent: ({ error, reset }) => (
    <div className="flex min-h-[60vh] items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 shadow-soft space-y-4">
        <h2 className="font-display text-xl font-bold text-navy">Kendala Memuat Dashboard</h2>
        <p className="text-xs text-muted-foreground">
          {error instanceof Error ? error.message : "Terjadi kesalahan saat memuat aktivitas pelatihan."}
        </p>
        <button
          onClick={() => reset()}
          className="rounded-xl bg-marine px-4 py-2 text-xs font-bold text-white hover:bg-navy transition"
        >
          Muat Ulang
        </button>
      </div>
    </div>
  ),
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

  // Live user-scoped learning enrollments (synced with Supabase cloud)
  const { enrollments: shortCourses } = useShortCourses();
  const getModulesCatalogFn = useServerFn(getPublishedModulesCatalog);
  const { data: publishedModules } = useQuery({
    queryKey: ["dashboard", "published-modules"],
    queryFn: () => getModulesCatalogFn(),
    staleTime: 30_000,
    gcTime: 300_000,
  });

  // Live user applications (excluding legacy test records)
  const rawApps = useApplications();
  const realApps = useMemo(
    () =>
      rawApps.filter(
        (a) =>
          !a.id.startsWith("BARUNA-AFRICA") &&
          a.slug !== "international-training-fisheries-african-countries",
      ),
    [rawApps],
  );

  // Live user saved items count
  const savedKhIds = useSavedIds();
  const savedEventsStore = useSavedEvents();
  const totalSavedCount =
    savedKhIds.length + shortCourses.length + savedEventsStore.items.length;

  const activeShortCourses = useMemo(
    () =>
      [...shortCourses]
        .filter((c) => !c.completed)
        .sort((a, b) => (b.enrolledAt ?? 0) - (a.enrolledAt ?? 0)),
    [shortCourses],
  );

  const completedShortCourses = useMemo(
    () => shortCourses.filter((c) => c.completed),
    [shortCourses],
  );

  const completedFullApps = useMemo(
    () => realApps.filter((a) => a.status === "Accepted" && isCourseComplete(a)),
    [realApps],
  );

  const totalCertificates = completedShortCourses.length + completedFullApps.length;

  const resolveCourseTitle = (code: string, fallbackTitle?: string) => {
    const dbMod = (publishedModules ?? []).find((m) => m.id === code);
    if (dbMod?.title) return dbMod.title;
    if (fallbackTitle) return fallbackTitle;
    const master = masterByCode[code];
    if (master?.title) return master.title;
    return code;
  };

  const primaryActiveCourse = activeShortCourses[0];
  const activeLearningBody = primaryActiveCourse
    ? `${resolveCourseTitle(primaryActiveCourse.code, primaryActiveCourse.title)} — ${shortCourseProgress(primaryActiveCourse)}% ${isId ? "selesai" : "complete"}`
    : completedShortCourses.length > 0
      ? isId
        ? `${completedShortCourses.length} modul telah diselesaikan (100%). Jelajahi modul baru.`
        : `${completedShortCourses.length} module(s) completed (100%). Explore new modules.`
      : isId
        ? "Belum ada modul mandiri yang sedang diikuti. Mulai belajar sekarang."
        : "No active self-paced module yet. Start learning at your own pace.";

  const activeLearningCta = primaryActiveCourse
    ? isId
      ? "Lanjutkan"
      : "Continue"
    : isId
      ? "Jelajahi Modul"
      : "Browse Modules";

  const activeLearningTo = primaryActiveCourse
    ? "/academy/self-paced/$code"
    : "/academy/self-paced";
  const activeLearningParams = primaryActiveCourse
    ? { code: primaryActiveCourse.code }
    : undefined;

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
      body:
        realApps.length > 0
          ? isId
            ? `${realApps.length} pendaftaran program pelatihan tercatat.`
            : `${realApps.length} training program application(s) on record.`
          : isId
            ? "Belum ada pendaftaran program pelatihan penuh. Pantau atau daftar program."
            : "No full training program applications yet. Track or apply to programs.",
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
      body: activeLearningBody,
      cta: activeLearningCta,
      to: activeLearningTo,
      params: activeLearningParams,
    },
    {
      icon: Award,
      title: isId ? "Sertifikat Saya" : "Certificates",
      body:
        totalCertificates > 0
          ? isId
            ? `${totalCertificates} sertifikat resmi telah diperoleh dan siap diunduh.`
            : `${totalCertificates} official certificate(s) earned and ready to download.`
          : isId
            ? "Selesaikan modul mandiri atau program pelatihan untuk meraih sertifikat resmi."
            : "Complete a self-paced module or training program to earn official certificates.",
      cta: isId ? "Lihat" : "View",
      to: "/academy/certification",
    },
    {
      icon: Bookmark,
      title: isId ? "Disimpan" : "Saved Items",
      body:
        totalSavedCount > 0
          ? isId
            ? `${totalSavedCount} item tersimpan (Knowledge Hub, modul, & acara).`
            : `${totalSavedCount} saved item(s) across Knowledge Hub, modules, and events.`
          : isId
            ? "Belum ada materi Knowledge Hub, modul, atau acara yang disimpan."
            : "No saved Knowledge Hub resources, courses, or events yet.",
      cta: isId ? "Buka" : "Open",
      to: "/saved",
    },
    {
      icon: Globe,
      title: isId ? "Aplikasi Fellowship" : "Fellowship Applications",
      body: isId ? "Program pertukaran dan fellowship maritim internasional." : "International maritime fellowship and exchange programs.",
      cta: isId ? "Buka" : "Open",
      to: "/fellowship",
    },
    {
      icon: MessagesSquare,
      title: isId ? "Partisipasi Komunitas" : "Community Participation",
      body: isId ? "Diskusi tematik, kolaborasi, dan tanya jawab pakar." : "Thematic discussions, collaboration, and expert Q&A.",
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
      body:
        (publishedModules?.length ?? 0) > 0
          ? isId
            ? `${publishedModules?.length} modul mandiri terverifikasi tersedia di katalog.`
            : `${publishedModules?.length} verified self-paced module(s) available in the catalog.`
          : isId
            ? "Jelajahi modul mandiri berdasarkan minat dan jalur kompetensi Anda."
            : "Explore self-paced modules tailored to your interests.",
      cta: isId ? "Jelajahi" : "Browse",
      to: "/academy/self-paced",
    },
    {
      icon: Bookmark,
      title: isId ? "Transkrip Belajar" : "Learning Records",
      body: isId
        ? `${shortCourses.length} modul diikuti · ${completedShortCourses.length} modul dituntaskan.`
        : `${shortCourses.length} enrolled module(s) · ${completedShortCourses.length} completed.`,
      cta: isId ? "Buka" : "Open",
      to: "/academy/learn",
    },
    {
      icon: GraduationCap,
      title: isId ? "Kursus Selesai" : "Completed Courses",
      body:
        completedShortCourses.length > 0
          ? isId
            ? `${completedShortCourses.length} modul pelatihan mandiri telah berhasil Anda tuntaskan.`
            : `${completedShortCourses.length} self-paced module(s) successfully completed.`
          : isId
            ? "Belum ada kursus atau modul yang diselesaikan."
            : "No completed courses or modules yet.",
      cta: isId ? "Buka" : "Open",
      to: "/academy/learn",
    },
  ];

  const displayName = viewer?.displayName || (isId ? "Peserta BARUNA" : "BARUNA Member");
  const roleLabel = viewer?.primaryRoleLabel || (isId ? "Profil Peserta" : "Participant Profile");

  return (
    <RequireAuth>
      <PageShell
        sidebar={{
          icon: LayoutDashboard,
          title: isId ? "Perjalanan Belajar Saya" : "My Training Journey",
          subtitle: isId ? "Ruang kerja peserta & kontributor." : "Personal learning & contributor workspace.",
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
            {
              label: "Knowledge Hub",
              items: [
                {
                  label: isId ? "Submit Publikasi / Video / Best Practice" : "Submit Resource",
                  icon: Plus,
                  to: "/knowledge-hub/submit-resource",
                },
                {
                  label: isId ? "Kontribusi Saya" : "My Contributions",
                  icon: ListChecks,
                  to: "/knowledge-hub/my-contributions",
                },
                {
                  label: isId ? "Katalog Knowledge Hub" : "Browse Knowledge Hub",
                  icon: BookOpen,
                  to: "/knowledge-hub",
                },
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
              {isId ? "Perjalanan Belajar & Kontribusi Saya" : "My Training Journey & Contributions"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isId
                ? "Satu tempat untuk aktivitas pelatihan serta kontribusi publikasi, best practice, dan video Anda di BARUNA."
                : "A single place for your training progress and Knowledge Hub contributions on BARUNA."}
            </p>
          </div>
          <Link
            to="/account/profile"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-navy shadow-soft transition hover:border-marine hover:text-marine"
          >
            <UserRound className="h-4 w-4" /> {isId ? "Edit Profil" : "Edit Profile"}
          </Link>
        </div>

        <div className="mt-6">
          <TrainerKnowledgePublicationsCard variant="participant" />
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
