import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

/**
 * Shared lightweight toast. Listens for the `baruna:toast` window event
 * (dispatched by barunaToast() in src/lib/downloads.ts) and shows a transient
 * confirmation. Mirrors the Events module toaster so behaviour is consistent.
 */
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setMsg(detail?.message ?? "Done");
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2800);
    };
    window.addEventListener("baruna:toast", handler);
    return () => {
      window.removeEventListener("baruna:toast", handler);
      clearTimeout(timer);
    };
  }, []);
  if (!msg) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-navy-foreground shadow-hover">
      <CheckCircle2 className="h-4 w-4 text-marine-foreground" />
      {msg}
    </div>
  );
}
