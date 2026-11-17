// A row of cards that scrolls sideways and shows it: arrow buttons on the side that
// still has cards, a fade at that edge, and snapping to each card (touch, trackpad,
// mouse wheel with Shift, or the arrows).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function HorizontalScroller({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [update]);

  // One card-width step (about 80% of the visible row).
  const step = (dir: -1 | 1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * Math.max(200, el.clientWidth * 0.8), behavior: "smooth" });
  };

  const arrow = "absolute top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-white/95 text-navy shadow-md transition hover:bg-white hover:text-marine";
  return (
    <div className="relative">
      <div ref={ref} role="region" aria-label={label} tabIndex={0}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 scrollbar-none sm:gap-4 [&>*]:snap-start">
        {children}
      </div>
      {canLeft ? (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-card to-transparent" />
          <button type="button" aria-label="Sebelumnya" onClick={() => step(-1)} className={`${arrow} left-1`}>
            <ChevronLeft className="h-5 w-5" />
          </button>
        </>
      ) : null}
      {canRight ? (
        <>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent" />
          <button type="button" aria-label="Berikutnya" onClick={() => step(1)} className={`${arrow} right-1`}>
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      ) : null}
    </div>
  );
}
