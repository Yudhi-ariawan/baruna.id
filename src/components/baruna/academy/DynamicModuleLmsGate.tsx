import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock } from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { DynamicModuleLmsPlayer } from "@/components/baruna/academy/DynamicModuleLmsPlayer";
import { getPublishedModuleContent, type PublishedModuleDetail } from "@/lib/learning/learning.functions";

const DENIED = /module_access_denied|Unauthorized|Forbidden/i;

/**
 * Server-enforced gate for dynamic (database) modules. The public summary in the route
 * loader has no documents or quiz questions; the learning content only arrives from
 * getPublishedModuleContent, which the database lets through for approved participants,
 * the module's author and admins. localStorage and demo mode no longer play a part.
 */
export function DynamicModuleLmsGate({ module }: { module: PublishedModuleDetail }) {
  const navigate = useNavigate();
  const contentFn = useServerFn(getPublishedModuleContent);
  const query = useQuery({
    queryKey: ["module-content", module.id],
    queryFn: () => contentFn({ data: { moduleId: module.id } }),
    // Signed download links last 24 h; keep them for a long session without re-requesting.
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });

  const denied = query.isError && DENIED.test(query.error instanceof Error ? query.error.message : String(query.error));

  useEffect(() => {
    if (!denied) return;
    void navigate({ to: "/academy/self-paced/$code", params: { code: module.id }, replace: true });
  }, [denied, module.id, navigate]);

  if (query.data) return <DynamicModuleLmsPlayer module={query.data} />;

  return (
    <AcademyShell active="self-paced">
      <div className="mx-auto my-8 max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-700 shadow-xs">
          {query.isError && !denied ? <Lock className="h-7 w-7" /> : <Loader2 className="h-7 w-7 animate-spin" />}
        </span>
        <h2 className="mt-4 font-display text-xl font-bold text-navy">
          {denied
            ? "Mengalihkan ke Halaman Pendaftaran"
            : query.isError
              ? "Materi Belum Dapat Dimuat"
              : "Memeriksa Akses Materi"}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {denied
            ? "Materi ini hanya untuk peserta yang pendaftarannya telah disetujui."
            : query.isError
              ? query.error instanceof Error
                ? query.error.message
                : "Terjadi gangguan. Coba lagi."
              : "Mohon tunggu sebentar."}
        </p>
        {query.isError && !denied && (
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-4 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-white"
          >
            Coba lagi
          </button>
        )}
      </div>
    </AcademyShell>
  );
}
