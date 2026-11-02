// Topic chips for the Knowledge Hub contribution form, read from Data Master
// (kh_topic_taxonomy). A topic the draft already has but that was deactivated
// stays visible and marked, so an older publication can keep it when updated.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getKhTopicOptions } from "@/lib/knowledge-hub/topic-options.functions";

const norm = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();

export function TopicSelector({ value, onChange }: { value: string; onChange: (topic: string) => void }) {
  const fn = useServerFn(getKhTopicOptions);
  const q = useQuery({
    queryKey: ["knowledge-hub", "topic-options"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  if (q.isLoading) return <p className="text-xs text-muted-foreground">Memuat daftar topik…</p>;
  if (q.isError) return <p className="text-xs text-destructive">{(q.error as Error).message}</p>;

  const options = q.data ?? [];
  const selected = value.trim() ? options.find((o) => norm(o.name) === norm(value)) : undefined;
  const shown = options.filter((o) => o.active);
  // The current value is kept visible when it is inactive or no longer in the list.
  const extra = value.trim() && !selected?.active ? [{ name: selected?.name ?? value, active: false, known: Boolean(selected) }] : [];

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {shown.map((o) => {
          const active = selected?.name === o.name;
          return (
            <button key={o.name} type="button" onClick={() => onChange(o.name)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                active ? "bg-marine text-marine-foreground" : "bg-muted text-foreground/75 hover:bg-marine/15 hover:text-marine"
              }`}>
              {o.name}
            </button>
          );
        })}
        {extra.map((o) => (
          <span key={o.name} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
            {o.name} · {o.known ? "tidak lagi ditawarkan" : "tidak ada di daftar"}
          </span>
        ))}
      </div>
      {extra.length ? (
        <p className="text-xs text-amber-800">
          {extra[0].known
            ? "Topik ini sudah dinonaktifkan kurator. Anda boleh tetap memakainya, atau pilih topik lain."
            : "Topik ini tidak ada di daftar dan akan ditolak saat dikirim. Pilih salah satu topik di atas."}
        </p>
      ) : null}
    </div>
  );
}
