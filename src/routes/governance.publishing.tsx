import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2, Megaphone, Search } from "lucide-react";
import {
  holdPublication,
  listPublications,
  releasePublication,
  type PublicationItem,
  type PublicationKind,
} from "@/lib/governance/publishing.functions";

// Penayangan (Slide 16, Publisher; CATATAN_PERBAIKAN 2ba). Approval still publishes
// (Slide 21); here the Publisher (or Admin) takes live content down temporarily, with
// a reason, and puts it back. The database checks the role and every rule.
export const Route = createFileRoute("/governance/publishing")({
  head: () => ({ meta: [{ title: "Penayangan — Konsol Kurasi BARUNA" }] }),
  component: PublishingPage,
});

const KINDS: Array<{ key: PublicationKind | "all"; label: string }> = [
  { key: "all", label: "Semua" },
  { key: "course_offering", label: "Course Offering" },
  { key: "module", label: "Modul" },
  { key: "knowledge_resource", label: "Knowledge Hub" },
  { key: "expert", label: "Profil Expert" },
];
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.key, k.label])) as Record<PublicationKind, string>;
const when = (d: string | null) => (d ? new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "");

function PublishingPage() {
  const listFn = useServerFn(listPublications);
  const q = useQuery({ queryKey: ["governance", "publishing"], queryFn: () => listFn(), staleTime: 15_000 });
  const [kind, setKind] = useState<PublicationKind | "all">("all");
  const [onlyHeld, setOnlyHeld] = useState(false);
  const [search, setSearch] = useState("");

  const items = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? [])
      .filter((i) => (kind === "all" || i.kind === kind) && (!onlyHeld || i.heldAt) && (!s || `${i.title} ${i.ref ?? ""}`.toLowerCase().includes(s)))
      .sort((a, b) => Number(Boolean(b.heldAt)) - Number(Boolean(a.heldAt)) || a.title.localeCompare(b.title));
  }, [q.data, kind, onlyHeld, search]);
  const heldCount = (q.data ?? []).filter((i) => i.heldAt).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-navy"><Megaphone className="h-6 w-6 text-marine" /> Penayangan</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Konten yang disetujui langsung tayang. Di sini Publisher atau Admin dapat <b>menurunkan sementara</b> konten yang sedang tayang
          (misalnya ada data yang keliru) dengan alasan, lalu <b>menayangkannya lagi</b>. Selama diturunkan, konten tidak tampil di halaman
          publik dan tidak menerima pendaftaran baru; perubahan yang disetujui di saat itu baru tampil setelah ditayangkan lagi.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map((k) => (
          <button key={k.key} type="button" onClick={() => setKind(k.key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${kind === k.key ? "bg-marine text-white" : "border border-border bg-white text-navy hover:bg-muted"}`}>
            {k.label}
          </button>
        ))}
        <label className="ml-1 inline-flex items-center gap-1.5 text-xs text-navy">
          <input type="checkbox" checked={onlyHeld} onChange={(e) => setOnlyHeld(e.target.checked)} /> Hanya yang diturunkan ({heldCount})
        </label>
        <span className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari judul atau kode…"
            className="w-56 rounded-lg border border-border py-1.5 pl-7 pr-2 text-xs" />
        </span>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Tidak ada konten yang cocok.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
          {items.map((i) => <Row key={`${i.kind}-${i.id}`} item={i} />)}
        </ul>
      )}
    </div>
  );
}

function Row({ item }: { item: PublicationItem }) {
  const qc = useQueryClient();
  const holdFn = useServerFn(holdPublication);
  const releaseFn = useServerFn(releasePublication);
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["governance"] }); };
  const hold = useMutation({ mutationFn: () => holdFn({ data: { kind: item.kind, id: item.id, reason: reason.trim() } }), onSuccess: () => { setAsking(false); setReason(""); refresh(); } });
  const release = useMutation({ mutationFn: () => releaseFn({ data: { kind: item.kind, id: item.id } }), onSuccess: refresh });
  const err = (hold.error ?? release.error) as Error | null;
  const busy = hold.isPending || release.isPending;

  return (
    <li className="space-y-1.5 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-navy">
            <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">{KIND_LABEL[item.kind]}</span>
            {item.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.ref ? `${item.ref} · ` : ""}
            {item.heldAt ? (
              <span className="font-semibold text-orange-700">Diturunkan {when(item.heldAt)} oleh {item.heldByName ?? "—"}: "{item.heldReason}"</span>
            ) : item.live ? (
              <span className="font-semibold text-emerald-700">Tayang</span>
            ) : (
              "Tidak tayang"
            )}
          </p>
        </div>
        {item.heldAt ? (
          <button type="button" disabled={busy} onClick={() => release.mutate()}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {release.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Tayangkan lagi
          </button>
        ) : item.live && !asking ? (
          <button type="button" disabled={busy} onClick={() => setAsking(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-orange-300 px-3 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-50 disabled:opacity-50">
            <EyeOff className="h-3.5 w-3.5" /> Turunkan sementara
          </button>
        ) : null}
      </div>
      {asking ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Alasan menurunkan (wajib, tercatat di audit)"
            className="min-w-0 flex-1 rounded-lg border border-border px-2 py-1.5" />
          <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => hold.mutate()}
            className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50">
            {hold.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />} Turunkan
          </button>
          <button type="button" onClick={() => setAsking(false)} className="px-2 py-1.5 text-muted-foreground">Batal</button>
        </div>
      ) : null}
      {err ? <p className="text-xs text-destructive">{err.message}</p> : null}
    </li>
  );
}
