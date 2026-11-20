import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound } from "lucide-react";
import { ListSkeleton } from "@/components/baruna/loading/Skeletons";
import { listAccessRequests } from "@/lib/admin/role-requests.functions";
import { AccessRequestCard } from "@/components/admin/access-requests/AccessRequestCard";

// Permintaan Akses (Slide 42, LS-01): users ask for a curation role from My Profile;
// a super admin approves (the role becomes active at once) or rejects with a reason.
export const Route = createFileRoute("/admin/access-requests")({
  head: () => ({ meta: [{ title: "Permintaan Akses — BARUNA Administration" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AccessRequestsPage,
});

function AccessRequestsPage() {
  const listFn = useServerFn(listAccessRequests);
  const [view, setView] = useState<"pending" | "decided">("pending");
  const q = useQuery({
    queryKey: ["admin", "access-requests", view],
    queryFn: () => listFn({ data: { view } }),
    staleTime: 15_000,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-navy">
          <KeyRound className="h-6 w-6 text-marine" /> Permintaan Akses
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Pengguna mengajukan peran kurasi (Operator, Reviewer, Verifier, Approver, Publisher) dari halaman Profil Saya beserta
          alasannya. <b>Super admin</b> memutuskan: bila disetujui, peran langsung aktif; bila ditolak, alasan dikirim ke pengguna.
          Permintaan untuk akun sendiri harus diputuskan super admin lain. Semua tercatat di Jejak Audit.
        </p>
      </div>

      <div className="flex gap-2">
        {(["pending", "decided"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${view === v ? "bg-marine text-white" : "border border-border bg-white text-navy hover:bg-muted"}`}
          >
            {v === "pending" ? "Menunggu keputusan" : "Sudah diputuskan"}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <ListSkeleton rows={3} label="Memuat permintaan akses…" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : (q.data?.items ?? []).length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          {view === "pending" ? "Tidak ada permintaan yang menunggu keputusan." : "Belum ada permintaan yang diputuskan."}
        </p>
      ) : (
        <>
          {!q.data!.canDecide && view === "pending" ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Anda dapat melihat antrean ini, tetapi keputusan hanya dapat diambil oleh super admin.
            </p>
          ) : null}
          <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
            {q.data!.items.map((item) => (
              <AccessRequestCard key={item.id} item={item} canDecide={q.data!.canDecide} me={q.data!.me} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
