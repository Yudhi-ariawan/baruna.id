import type { ReactNode } from "react";
import { Navbar } from "@/components/baruna/Navbar";
import { CtaBanner } from "./CtaBanner";
import { Sidebar, type SidebarProps } from "./Sidebar";
import type { LucideIcon } from "lucide-react";

export function PageShell({
  sidebar,
  cta,
  children,
}: {
  sidebar?: SidebarProps | null;
  cta?: { icon?: LucideIcon | null; title?: string; description?: string; button?: string; href?: string } | null;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          {sidebar && <Sidebar {...sidebar} />}
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
      {cta && <CtaBanner {...cta} />}
    </div>
  );
}
