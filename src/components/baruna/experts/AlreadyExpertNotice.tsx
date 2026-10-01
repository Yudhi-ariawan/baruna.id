import { Link } from "@tanstack/react-router";
import { Award, ArrowRight, ShieldCheck, UserCheck, ExternalLink } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type AlreadyExpertNoticeProps = {
  expertName?: string | null;
  expertSlug?: string | null;
};

export function AlreadyExpertNotice({ expertName, expertSlug }: AlreadyExpertNoticeProps) {
  const { language } = useLanguage();
  const isId = language === "id";

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-linear-to-br from-emerald-500/20 via-marine/15 to-emerald-500/10 text-emerald-600 shadow-soft ring-1 ring-emerald-500/25">
        <ShieldCheck className="h-10 w-10 text-emerald-600" />
        <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
          <Award className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        <UserCheck className="h-3.5 w-3.5" />
        {isId ? "Pakar Terverifikasi BARUNA" : "Verified BARUNA Expert"}
      </div>

      <h1 className="mt-4 font-display text-2xl font-extrabold text-navy sm:text-3xl">
        {isId
          ? "Anda Sudah Terdaftar sebagai Expert"
          : "You Are Already Registered as an Expert"}
      </h1>

      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
        {isId ? (
          <>
            Halo, <strong className="text-foreground">{expertName || "Pakar"}</strong>. Akun Anda
            telah resmi terdaftar dan aktif dalam jaringan pakar kelautan & perikanan BARUNA. Anda
            tidak perlu mengisi formulir pendaftaran lagi.
          </>
        ) : (
          <>
            Hello, <strong className="text-foreground">{expertName || "Expert"}</strong>. Your
            account is officially verified and active in the BARUNA global marine and fisheries
            expert network. You do not need to register again.
          </>
        )}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/experts/portal"
          className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-white shadow-soft transition-all hover:bg-navy hover:shadow-hover"
        >
          {isId ? "Buka Portal Expert" : "Open Expert Portal"}
          <ArrowRight className="h-4 w-4" />
        </Link>

        {expertSlug ? (
          <Link
            to="/experts/$slug"
            params={{ slug: expertSlug }}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-navy transition-all hover:bg-muted hover:shadow-2xs"
          >
            <ExternalLink className="h-4 w-4 text-marine" />
            {isId ? "Lihat Profil Publik Saya" : "View My Public Profile"}
          </Link>
        ) : (
          <Link
            to="/experts/profile"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-navy transition-all hover:bg-muted hover:shadow-2xs"
          >
            {isId ? "Status & Kelola Profil" : "Manage Profile Status"}
          </Link>
        )}

        <Link
          to="/experts"
          className="inline-flex items-center gap-2 rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-marine transition-colors hover:text-navy"
        >
          {isId ? "Jelajahi Direktori Pakar" : "Browse Expert Directory"}
        </Link>
      </div>
    </div>
  );
}

