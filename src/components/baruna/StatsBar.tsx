import { footerStats } from "@/data/baruna";
import { Fish } from "lucide-react";
import { Logo } from "./Logo";

export function StatsBar() {
  return (
    <footer className="bg-navy text-navy-foreground">
      <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-center">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {footerStats.map(({ value, label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-foreground/10">
                  <Icon className="h-5 w-5 text-navy-foreground" />
                </div>
                <div className="leading-tight">
                  <p className="font-display text-xl font-extrabold">{value}</p>
                  <p className="text-xs text-navy-foreground/75">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative lg:text-right">
            <Fish className="mb-3 h-7 w-7 text-marine lg:ml-auto" />
            <p className="text-sm font-semibold leading-relaxed">
              Together, we build capacity.
              <br />
              Together, we protect our ocean.
            </p>
            <p className="mt-1 text-sm text-navy-foreground/80">
              Join BARUNA and be part of the change.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 border-t border-navy-foreground/15 pt-8">
          <div className="inline-flex rounded-2xl bg-white px-6 py-4 shadow-soft">
            <Logo className="h-16 sm:h-20" />
          </div>
          <p className="text-center text-xs text-navy-foreground/60">
            © {new Date().getFullYear()} BARUNA — Indonesia's Marine and Fisheries Knowledge &amp;
            Capacity Building Network. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
