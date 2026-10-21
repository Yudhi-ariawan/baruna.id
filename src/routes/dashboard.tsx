import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { MyLearningOverview } from "@/components/baruna/dashboard/MyLearningOverview";
import { getPublishedModulesCatalog } from "@/lib/learning/learning.functions";
import { useHomeExperience } from "@/components/baruna/home-experience";
import { useLanguage } from "@/lib/i18n";

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

  const isAdmin = Boolean(viewer?.canUseAdminPortal);

  const getModulesCatalogFn = useServerFn(getPublishedModulesCatalog);
  const { data: publishedModules } = useQuery({
    queryKey: ["dashboard", "published-modules"],
    queryFn: () => getModulesCatalogFn(),
    staleTime: 30_000,
    gcTime: 300_000,
  });

  // Learning figures (applications, progress, passes, certificates) come from the
  // database in MyLearningOverview. These cards only link to other areas and do
  // not show numbers kept in this browser.
  const cards: {
    icon: React.ElementType;
    title: string;
    body: string;
    cta: string;
    to: string;
  }[] = [
    {
      icon: GraduationCap,
      title: isId ? "Rekomendasi Pembelajaran" : "Recommended Learning",
      body:
        (publishedModules?.length ?? 0) > 0
          ? isId
            ? `${publishedModules?.length} modul terverifikasi tersedia di katalog.`
            : `${publishedModules?.length} verified module(s) available in the catalog.`
          : isId
            ? "Jelajahi modul berdasarkan minat dan jalur kompetensi Anda."
            : "Explore modules by interest and competency pathway.",
      cta: isId ? "Jelajahi" : "Browse",
      to: "/academy/self-paced",
    },
    {
      icon: CalendarDays,
      title: isId ? "Kalender Acara" : "Event Calendar",
      body: isId ? "Webinar, lokakarya, dan pelatihan yang dijadwalkan." : "Scheduled webinars, workshops, and trainings.",
      cta: isId ? "Lihat kalender" : "View calendar",
      to: "/events/calendar",
    },
    {
      icon: Bookmark,
      title: isId ? "Disimpan" : "Saved Items",
      body: isId ? "Materi Knowledge Hub, modul, dan acara yang Anda tandai." : "Knowledge Hub resources, modules, and events you bookmarked.",
      cta: isId ? "Buka" : "Open",
      to: "/saved",
    },
    {
      icon: Globe,
      title: isId ? "Fellowship" : "Fellowship",
      body: isId ? "Program pertukaran dan fellowship maritim internasional." : "International maritime fellowship and exchange programs.",
      cta: isId ? "Buka" : "Open",
      to: "/fellowship",
    },
    {
      icon: MessagesSquare,
      title: isId ? "Komunitas" : "Community",
      body: isId ? "Diskusi tematik, kolaborasi, dan tanya jawab pakar." : "Thematic discussions, collaboration, and expert Q&A.",
      cta: isId ? "Buka" : "Open",
      to: "/community",
    },
    {
      icon: Award,
      title: isId ? "Jejaring Alumni" : "Alumni Network",
      body: isId ? "Tetap terhubung dengan jejaring angkatan Anda." : "Stay connected with your cohort.",
      cta: isId ? "Buka" : "Open",
      to: "/academy/alumni-network",
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
          <MyLearningOverview isId={isId} />
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
                to={c.to}
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
