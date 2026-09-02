import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

export function SectionHeader({
  title,
  action = "View all",
}: {
  title: string;
  action?: string | null;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold text-navy sm:text-xl">{title}</h2>
      {action && (
        <a
          href="#"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-marine transition-colors hover:text-navy"
        >
          {action}
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-5 shadow-soft ${className}`}>
      {children}
    </div>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-marine/10 px-3 py-1 text-xs font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground">
      {children}
    </span>
  );
}

const categoryBadge: Record<string, string> = {
  COURSE: "bg-badge-course",
  TRAINING: "bg-badge-training",
  WEBINAR: "bg-badge-webinar",
  WORKSHOP: "bg-badge-workshop",
  CERTIFICATION: "bg-eco-knowledge",
  PUBLICATION: "bg-badge-course",
  "POLICY BRIEF": "bg-badge-training",
  VIDEO: "bg-eco-events",
  "BEST PRACTICE": "bg-eco-community",
  CONFERENCE: "bg-eco-experts",
  SUMMIT: "bg-eco-knowledge",
  Question: "bg-badge-course",
  Discussion: "bg-badge-training",
  Resource: "bg-eco-knowledge",
  Poll: "bg-badge-workshop",
};

export function CategoryBadge({ label }: { label: string }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-navy-foreground ${
        categoryBadge[label] ?? "bg-marine"
      }`}
    >
      {label}
    </span>
  );
}
