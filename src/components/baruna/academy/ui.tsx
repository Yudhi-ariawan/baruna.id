import type { ReactNode } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Star,
  ArrowRight,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

/* ---------------- Breadcrumb + Page header ---------------- */

export function AcademyHeader({
  crumb,
  parent,
  title,
  description,
  searchPlaceholder,
  sort = false,
}: {
  crumb: string;
  parent?: string;
  title: string;
  description: string;
  searchPlaceholder: string;
  sort?: boolean;
}) {
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <span className="font-medium text-foreground/70">Academy</span>
        <ChevronRight className="h-3.5 w-3.5" />
        {parent && (
          <>
            <span className="font-medium text-foreground/70">{parent}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
        <span className="font-semibold text-navy">{crumb}</span>
      </nav>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-md">
          <h1 className="font-display text-3xl font-extrabold text-navy">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-3 xl:max-w-2xl xl:justify-end">
          <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-soft">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder={searchPlaceholder}
            />
          </label>
          {sort && (
            <button className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-navy shadow-soft transition-colors hover:border-marine/40">
              Sort by: Newest <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Tabs ---------------- */

export type Tab = { label: string; count: string; active?: boolean; live?: boolean };

export function TabBar({ tabs }: { tabs: Tab[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {tabs.map((t) => (
        <button
          key={t.label}
          className={`flex shrink-0 flex-col items-start rounded-xl border px-5 py-2.5 text-left transition-colors ${
            t.active
              ? "border-marine bg-marine/5"
              : "border-border bg-card hover:border-marine/40"
          }`}
        >
          <span className="flex items-center gap-1.5 text-sm font-bold text-navy">
            {t.label}
            {t.live && <span className="h-2 w-2 rounded-full bg-destructive" />}
          </span>
          <span className="text-xs text-muted-foreground">{t.count}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------- Status badges (over images) ---------------- */

const statusStyles: Record<string, string> = {
  UPCOMING: "bg-marine text-marine-foreground",
  "LIVE NOW": "bg-destructive text-destructive-foreground",
  "ON DEMAND": "bg-navy text-navy-foreground",
  "OPEN FOR REGISTRATION": "bg-badge-workshop text-navy-foreground",
  "IN-PERSON": "bg-badge-training text-navy-foreground",
  BLENDED: "bg-badge-webinar text-navy-foreground",
  ONLINE: "bg-badge-workshop text-navy-foreground",
  VERIFIED: "bg-badge-training text-navy-foreground",
  NEW: "bg-marine text-marine-foreground",
  POPULAR: "bg-accent text-accent-foreground",
  "Self-paced": "bg-navy/85 text-navy-foreground",
};

export function StatusBadge({ label }: { label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wide shadow-soft ${
        statusStyles[label] ?? "bg-marine text-marine-foreground"
      }`}
    >
      {label}
    </span>
  );
}

/* ---------------- Meta item (icon + text) ---------------- */

export function MetaItem({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0 text-marine/70" />
      {children}
    </span>
  );
}

/* ---------------- Rating ---------------- */

export function Rating({ value, reviews }: { value: number; reviews: number }) {
  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-foreground">
      <Star className="h-3.5 w-3.5 fill-star text-star" />
      {value} <span className="font-normal text-muted-foreground">({reviews})</span>
    </span>
  );
}

/* ---------------- Buttons ---------------- */

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all";

export function PrimaryButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <button
      className={`${btnBase} bg-marine text-marine-foreground hover:-translate-y-0.5 hover:bg-marine/90 hover:shadow-hover ${className}`}
    >
      {children}
    </button>
  );
}

export function OutlineButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <button
      className={`${btnBase} border border-border bg-card text-navy hover:border-marine hover:text-marine ${className}`}
    >
      {children}
    </button>
  );
}

export function DangerButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <button
      className={`${btnBase} bg-destructive text-destructive-foreground hover:-translate-y-0.5 hover:bg-destructive/90 hover:shadow-hover ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------------- Date chip ---------------- */

export function DateChip({
  top,
  big,
  year,
  tone = "marine",
}: {
  top: string;
  big: string;
  year: string;
  tone?: "marine" | "green" | "amber";
}) {
  const tones: Record<string, string> = {
    marine: "bg-marine/8 text-marine",
    green: "bg-badge-training/10 text-badge-training",
    amber: "bg-accent/10 text-accent",
  };
  return (
    <div
      className={`grid w-[68px] shrink-0 place-items-center rounded-xl px-2 py-2 text-center leading-tight ${tones[tone]}`}
    >
      <span className="text-[0.6rem] font-bold uppercase">{top}</span>
      <span className="font-display text-base font-extrabold text-navy">{big}</span>
      <span className="text-[0.55rem] text-muted-foreground">{year}</span>
    </div>
  );
}

/* ---------------- Filter sidebar pieces ---------------- */

export function FilterPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-navy">{title}</h3>
        <button className="flex items-center gap-1 text-xs font-semibold text-marine hover:text-navy">
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

export function FilterSearch({ placeholder }: { placeholder: string }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
      <Search className="h-3.5 w-3.5 text-muted-foreground" />
      <input
        className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        placeholder={placeholder}
      />
    </label>
  );
}

export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-foreground/70">{label}</p>
      {children}
    </div>
  );
}

export function CheckRow({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked?: boolean;
  onChange?: () => void;
}) {
  const isControlled = onChange !== undefined;
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-foreground/80 transition-colors hover:text-marine">
      {isControlled ? (
        <input
          type="checkbox"
          checked={!!checked}
          onChange={onChange}
          className="peer sr-only"
        />
      ) : null}
      <span
        className={`grid h-4 w-4 place-items-center rounded border ${
          checked ? "border-marine bg-marine text-white" : "border-border bg-background"
        }`}
        aria-hidden
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
            <path fill="none" stroke="currentColor" strokeWidth="2" d="M2 6l3 3 5-6" />
          </svg>
        )}
      </span>
      <span className="flex-1">{label}</span>
      {count != null && <span className="text-xs text-muted-foreground">({count})</span>}
    </label>
  );
}


export function FilterSelect({ placeholder }: { placeholder: string }) {
  return (
    <button className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
      {placeholder}
      <ChevronDown className="h-4 w-4" />
    </button>
  );
}

export function ApplyButton() {
  return (
    <button className="w-full rounded-lg bg-marine py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90">
      Apply Filters
    </button>
  );
}

export function ShowMore() {
  return (
    <button className="flex items-center gap-1 pt-1 text-xs font-semibold text-marine hover:text-navy">
      Show more <ChevronDown className="h-3 w-3" />
    </button>
  );
}

/* ---------------- Sidebar info panel ---------------- */

export function AsidePanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold text-navy">{title}</h3>
        {action && (
          <button className="flex items-center gap-1 text-xs font-semibold text-marine hover:text-navy">
            {action} <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/* ---------------- Program Type Tabs (interactive, URL-synced) ---------------- */

export type ProgramTabItem = { key: string; label: string; count: number; live?: boolean };

export function ProgramTypeTabs({
  tabs,
  activeKey,
  onSelect,
}: {
  tabs: ProgramTabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Program type" className="flex gap-3 overflow-x-auto pb-1">
      {tabs.map((t) => {
        const active = t.key === activeKey;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(t.key)}
            className={`flex shrink-0 cursor-pointer flex-col items-start rounded-xl border px-5 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-marine ${
              active
                ? "border-marine bg-marine/5 shadow-soft"
                : "border-border bg-card hover:border-marine/40"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm font-bold text-navy">
              {t.label}
              {t.live && <span className="h-2 w-2 rounded-full bg-destructive" />}
            </span>
            <span className="text-xs text-muted-foreground">
              {t.count} {t.count === 1 ? "program" : "programs"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
