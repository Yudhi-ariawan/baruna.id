import { useEffect, useState, type ReactNode } from "react";
import { Menu, CalendarDays, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Link } from "@tanstack/react-router";
import {
  EventsSidebar,
  EventsSidebarHeader,
  EventsMobileNav,
} from "./EventsSidebar";

function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setMsg(detail?.message ?? "Done");
      const t = setTimeout(() => setMsg(null), 2600);
      return () => clearTimeout(t);
    };
    window.addEventListener("baruna:toast", handler);
    return () => window.removeEventListener("baruna:toast", handler);
  }, []);
  if (!msg) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-navy-foreground shadow-hover">
      {msg}
    </div>
  );
}

export function EventsShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Mobile sidebar trigger */}
      <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 pt-4 sm:px-6 lg:hidden">
        <div className="flex items-center gap-2 text-navy">
          <CalendarDays className="h-5 w-5 text-marine" />
          <span className="font-display text-base font-bold">Events</span>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-navy shadow-soft">
              <Menu className="h-4 w-4" /> Menu
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            <SheetTitle className="sr-only">Events navigation</SheetTitle>
            <div className="mb-4">
              <EventsSidebarHeader />
            </div>
            <EventsMobileNav onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <EventsSidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>

      {/* CTA */}
      <section className="bg-gradient-to-r from-marine/15 via-marine/10 to-marine/15">
        <div className="mx-auto flex max-w-[1500px] flex-col items-center gap-5 px-4 py-8 sm:px-6 md:flex-row md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-marine/15 text-marine">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-lg font-extrabold text-navy sm:text-xl">
                Have an Event to Share?
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Submit your event and reach a global community of marine and fisheries
                professionals.
              </p>
            </div>
          </div>
          <Link
            to="/events/submit"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-hover"
          >
            Submit Event
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Toaster />
    </div>
  );
}
