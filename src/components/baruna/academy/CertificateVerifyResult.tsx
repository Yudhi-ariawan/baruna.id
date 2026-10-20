import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { verifyCertificate } from "@/lib/learning/learning.functions";

/**
 * Looks the certificate number up in the database (public RPC verify_certificate).
 * Only a number that exists and is still "issued" is shown as valid; anything else
 * says so plainly instead of claiming an official verification.
 */
export function CertificateVerifyResult({ number }: { number: string }) {
  const verifyFn = useServerFn(verifyCertificate);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["certificate-verify", number],
    queryFn: () => verifyFn({ data: { number } }),
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Box tone="neutral" icon={<Loader2 className="h-6 w-6 animate-spin" />} title="Memeriksa sertifikat..." number={number} />
    );
  }
  if (isError) {
    return (
      <Box
        tone="warning"
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Verifikasi sedang tidak dapat dilakukan"
        number={number}
        body="Terjadi gangguan saat memeriksa data. Coba beberapa saat lagi."
      />
    );
  }
  if (data?.found && data.status === "issued") {
    return (
      <Box
        tone="success"
        icon={<ShieldCheck className="h-6 w-6" />}
        badge="Terdaftar di BARUNA"
        title={data.program}
        number={data.certificate_number}
        body={`Pemegang: ${data.holder} · Diterbitkan ${new Date(data.issue_date).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`}
      />
    );
  }
  if (data?.found) {
    return (
      <Box
        tone="danger"
        icon={<ShieldAlert className="h-6 w-6" />}
        badge="Tidak berlaku"
        title={data.program}
        number={data.certificate_number}
        body={`Status sertifikat: ${data.status}. Sertifikat ini tidak dapat digunakan sebagai bukti kelulusan.`}
      />
    );
  }
  return (
    <Box
      tone="warning"
      icon={<AlertTriangle className="h-6 w-6" />}
      badge="Tidak ditemukan"
      title="Nomor sertifikat tidak terdaftar"
      number={number}
      body="Nomor ini tidak ada di catatan BARUNA. Sertifikat bertanda CONTOH / BELUM RESMI masih dalam masa uji coba dan belum dapat diverifikasi secara online."
    />
  );
}

const TONES = {
  success: { box: "border-emerald-500/40 bg-emerald-50/90 dark:bg-emerald-950/40", accent: "bg-emerald-600" },
  danger: { box: "border-rose-500/40 bg-rose-50/90 dark:bg-rose-950/40", accent: "bg-rose-600" },
  warning: { box: "border-amber-500/40 bg-amber-50/90 dark:bg-amber-950/40", accent: "bg-amber-600" },
  neutral: { box: "border-border bg-card", accent: "bg-slate-500" },
} as const;

function Box({
  tone,
  icon,
  badge,
  title,
  number,
  body,
}: {
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  badge?: string;
  title: string;
  number: string;
  body?: string;
}) {
  return (
    <div className={`rounded-2xl border-2 p-5 shadow-soft sm:p-6 ${TONES[tone].box}`}>
      <div className="flex items-start gap-3.5">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow-xs ${TONES[tone].accent}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {badge && (
              <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wide text-white ${TONES[tone].accent}`}>
                {badge}
              </span>
            )}
            <span className="break-all font-mono text-xs font-semibold text-muted-foreground">No: {number}</span>
          </div>
          <h2 className="mt-1 font-display text-base font-bold text-navy sm:text-lg dark:text-white">{title}</h2>
          {body && <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>}
        </div>
      </div>
    </div>
  );
}
