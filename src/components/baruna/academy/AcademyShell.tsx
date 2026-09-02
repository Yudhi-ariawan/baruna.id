import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { AcademySidebar, type AcademyActive } from "./AcademySidebar";

export function AcademyShell({
  active,
  activeCategory,
  activePathway,
  children,
  aside,
}: {
  active: AcademyActive;
  activeCategory?: string;
  activePathway?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
        {/* Mobile sidebar trigger */}
        <div className="mb-4 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-navy shadow-soft">
                <Menu className="h-4 w-4" />
                Academy Menu
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] overflow-y-auto p-4">
              <SheetTitle className="sr-only">Academy Menu</SheetTitle>
              <AcademySidebar active={active} activeCategory={activeCategory} activePathway={activePathway} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Desktop left sidebar */}
          <aside className="hidden w-[260px] shrink-0 lg:block">
            <div className="sticky top-24">
              <AcademySidebar active={active} activeCategory={activeCategory} activePathway={activePathway} />
            </div>
          </aside>

          {/* Center + right */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-6 xl:flex-row">
              <main className="min-w-0 flex-1">{children}</main>
              {aside && (
                <aside className="w-full shrink-0 xl:w-[300px]">
                  <div className="space-y-5 xl:sticky xl:top-24">{aside}</div>
                </aside>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
