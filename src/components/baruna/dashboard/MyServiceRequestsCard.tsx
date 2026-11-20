// Dashboard section: the participant's expert service requests (Slide 38, PB-EXP-03),
// so the status is visible without opening My Requests. Same data and query key as
// /experts/my-requests; hidden when the account has never made a request.
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, ArrowRight, Handshake, MessageSquareReply } from "lucide-react";
import { listMyExpertServiceRequests } from "@/lib/experts/portal-services.functions";
import { latestInfoRequest, serviceRequestStatusText, type ServiceRequest } from "@/lib/experts/portal-services.types";
import { getActiveUserId } from "@/lib/authSession";
import { REQUEST_TYPE_CONFIG } from "@/lib/experts";

const STATUS_ID: Record<string, string> = {
  draft: "Draf, belum dikirim",
  submitted: "Diajukan",
  under_review: "Ditinjau tim BARUNA",
  expert_matching: "Tim mencarikan expert",
  expert_contacted: "Menunggu jawaban expert",
  information_requested: "Perlu jawaban Anda",
  confirmed: "Diterima expert",
  scheduled: "Terjadwal",
  completed: "Selesai",
  declined: "Ditolak",
  cancelled: "Dibatalkan",
};

const TONE: Record<string, string> = {
  information_requested: "border-orange-300 bg-orange-50/70",
  confirmed: "border-emerald-200 bg-emerald-50/60",
  scheduled: "border-emerald-200 bg-emerald-50/60",
  completed: "border-emerald-200 bg-emerald-50/40",
  declined: "border-destructive/30 bg-destructive/5",
  cancelled: "border-border bg-muted/40",
};

/** Requests that need the participant come first, then the rest by last change. */
const ORDER: Record<string, number> = { information_requested: 0, draft: 2, completed: 3, declined: 3, cancelled: 3 };

function titleOf(r: ServiceRequest): string {
  const v = r.payload.values ?? {};
  return v.eventName || v.trainingTitle || v.subjectArea || v.objective || v.technicalIssue || REQUEST_TYPE_CONFIG[r.type]?.label || "Expert request";
}

export function MyServiceRequestsCard({ isId }: { isId: boolean }) {
  const list = useServerFn(listMyExpertServiceRequests);
  const userId = getActiveUserId();
  const query = useQuery({
    queryKey: ["experts", "my-service-requests", userId ?? "guest"],
    queryFn: () => list(),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  if (query.isLoading || query.isError || !query.data?.length) return null;
  const items = [...query.data]
    .sort((a, b) => (ORDER[a.status] ?? 1) - (ORDER[b.status] ?? 1) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const needYou = query.data.filter((r) => r.status === "information_requested").length;
  const date = (d: string) => new Date(d).toLocaleDateString(isId ? "id-ID" : "en-GB");

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-marine">
          <Handshake className="h-4 w-4" /> {isId ? "Permintaan Expert" : "Expert Requests"}
          {needYou > 0 ? (
            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-white">
              {isId ? `${needYou} perlu jawaban` : `${needYou} need your answer`}
            </span>
          ) : null}
        </h2>
        <Link to="/experts/my-requests" className="text-xs font-semibold text-marine hover:text-navy">
          {isId ? "Lihat semua" : "View all"} ({query.data.length}) →
        </Link>
      </div>
      <ul className="space-y-2">
        {items.map((r) => {
          const question = r.status === "information_requested" ? latestInfoRequest(r.events) : null;
          const expert = r.assignedExpert
            ? `Expert: ${r.assignedExpert}`
            : r.preferredExpert
              ? `${isId ? "Pilihan Anda" : "Your choice"}: ${r.preferredExpert} (${isId ? "ditinjau tim dulu" : "reviewed by BARUNA first"})`
              : isId ? "Expert dicarikan tim BARUNA" : "Expert to be matched by BARUNA";
          return (
            <li key={r.id} className={`rounded-xl border p-3 text-sm ${TONE[r.status] ?? "border-amber-200 bg-amber-50/50"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {r.requestNumber} · {REQUEST_TYPE_CONFIG[r.type]?.label ?? r.type}
                  </p>
                  <p className="truncate font-semibold text-navy">{titleOf(r)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{expert} · {isId ? "diperbarui" : "updated"} {date(r.updatedAt)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-navy ring-1 ring-border">
                  {isId ? STATUS_ID[r.status] ?? serviceRequestStatusText(r.status) : serviceRequestStatusText(r.status)}
                </span>
              </div>
              {question ? (
                <div className="mt-2 rounded-lg bg-white/70 p-2 text-xs text-orange-900">
                  <p className="flex items-start gap-1.5">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{question.message ?? (isId ? "Tim atau expert meminta informasi tambahan." : "Additional information was requested.")}</span>
                  </p>
                  <Link to="/experts/my-requests" className="mt-2 inline-flex items-center gap-1 rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy">
                    <MessageSquareReply className="h-3.5 w-3.5" /> {isId ? "Jawab sekarang" : "Answer now"}
                  </Link>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Link to="/experts/request" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-marine hover:text-navy">
        {isId ? "Ajukan permintaan expert baru" : "Request another expert"} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
