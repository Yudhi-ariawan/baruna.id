import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export type SidebarItem = {
  label: string;
  icon?: LucideIcon;
  count?: number;
  active?: boolean;
  to?: string;
};

export type SidebarSection = {
  label?: string;
  items: SidebarItem[];
};

export type SidebarProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  sections: SidebarSection[];
  footer?: { icon: LucideIcon; label: string };
  extra?: ReactNode;
};

export function Sidebar({ icon: Icon, title, subtitle, sections, footer, extra }: SidebarProps) {
  return (
    <aside className="hidden w-full shrink-0 lg:block lg:w-[260px]">
      <div className="sticky top-24 space-y-5">
        <div className="rounded-2xl bg-navy p-5 text-navy-foreground shadow-card">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-foreground/10">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">{title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-navy-foreground/80">{subtitle}</p>
            </div>
          </div>
        </div>

        <nav className="rounded-2xl border border-border bg-card p-3 shadow-soft">
          {sections.map((section, si) => (
            <div key={si} className={si > 0 ? "mt-4" : ""}>
              {section.label && (
                <p className="px-3 pb-2 pt-1 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const cls = `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    item.active
                      ? "bg-marine/10 text-marine"
                      : "text-foreground/75 hover:bg-muted hover:text-marine"
                  }`;
                  const inner = (
                    <>
                      {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.count != null && (
                        <span className="text-xs font-semibold text-muted-foreground">
                          {item.count}
                        </span>
                      )}
                    </>
                  );
                  return (
                    <li key={item.label}>
                      {item.to ? (
                        <Link to={item.to} className={cls}>
                          {inner}
                        </Link>
                      ) : (
                        <button className={cls}>{inner}</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {footer && (
            <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-marine py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground">
              <footer.icon className="h-4 w-4" />
              {footer.label}
            </button>
          )}
        </nav>
        {extra}
      </div>
    </aside>
  );
}
