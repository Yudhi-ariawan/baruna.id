import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, ArrowLeft, LoaderCircle, ShieldAlert } from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { ParticipantBiodataForm } from "@/components/baruna/academy/ParticipantBiodataForm";
import { getMyParticipantBiodata } from "@/lib/academy/participant-biodata.functions";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/academy/daftar-peserta")({
  head: () => ({
    meta: [
      { title: "Form Biodata Peserta — BARUNA Academy" },
      {
        name: "description",
        content: "Formulir biodata resmi peserta pelatihan Kementerian Kelautan dan Perikanan (KKP).",
      },
    ],
  }),
  component: DaftarPesertaPage,
});

function DaftarPesertaPage() {
  const navigate = useNavigate();
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const getBiodataFn = useServerFn(getMyParticipantBiodata);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthUserId(data.user?.id || null);
      setAuthChecked(true);
    });
  }, []);

  const { data: biodataResult, isLoading, error } = useQuery({
    queryKey: ["participant-biodata", authUserId],
    queryFn: () => getBiodataFn(),
    enabled: Boolean(authUserId),
    staleTime: 1000 * 60 * 5,
  });

  if (!authChecked) {
    return (
      <AcademyShell active="overview">
        <div className="flex h-64 items-center justify-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-marine" />
        </div>
      </AcademyShell>
    );
  }

  if (!authUserId) {
    return (
      <AcademyShell active="overview">
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-soft space-y-4 my-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-700 shadow-xs">
            <ShieldAlert className="h-7 w-7" />
          </span>
          <h2 className="font-display text-xl font-bold text-navy">
            Silakan Masuk Terlebih Dahulu
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Anda perlu masuk (login) ke akun BARUNA Anda sebelum melengkapi Form Biodata Peserta resmi.
          </p>
          <div className="pt-2">
            <Link
              to="/auth"
              search={{ redirect: "/academy/daftar-peserta" }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-marine px-6 py-2.5 text-xs font-bold text-white hover:bg-navy transition shadow-sm"
            >
              Masuk / Registrasi Akun
            </Link>
          </div>
        </div>
      </AcademyShell>
    );
  }

  return (
    <AcademyShell active="overview">
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">
            Academy
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-semibold text-navy">Daftar Peserta (Form Biodata)</span>
        </nav>

        {/* Back Link */}
        <Link
          to="/academy"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-marine hover:text-navy transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Katalog Academy
        </Link>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card">
            <LoaderCircle className="h-8 w-8 animate-spin text-marine" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
            <p className="font-bold text-sm">Gagal memuat formulir.</p>
            <p className="text-xs mt-1">{(error as any)?.message || "Terjadi kesalahan"}</p>
          </div>
        ) : biodataResult ? (
          <ParticipantBiodataForm initialData={biodataResult} />
        ) : null}
      </div>
    </AcademyShell>
  );
}

