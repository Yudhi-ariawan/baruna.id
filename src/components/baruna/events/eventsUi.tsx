import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Calendar,
  MapPin,
  Building2,
  ArrowRight,
  Bookmark,
  CalendarPlus,
  Share2,
  ExternalLink,
  Ticket,
  Clock,
} from "lucide-react";
import type { BarunaEvent } from "@/data/events";
import { countdownLabel } from "@/data/events";
import {
  useSavedEvents,
  downloadICS,
  shareEvent,
} from "@/lib/eventActions";

/** Client-only countdown — avoids SSR/client hydration mismatch on time-based text. */
function Countdown({ iso }: { iso: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(countdownLabel(iso));
  }, [iso]);
  if (!label) return null;
  return (
    <span className="mt-0.5 inline-flex items-center gap-1 text-[0.7rem] font-semibold text-marine">
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}


const badgeColor: Record<string, string> = {
  Conference: "bg-eco-experts",
  Webinar: "bg-badge-webinar",
  Workshop: "bg-badge-workshop",
  Training: "bg-badge-training",
  Community: "bg-eco-community",
  "Field Visit": "bg-eco-events",
};

export function EventBadge({ category }: { category: string }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-navy-foreground ${
        badgeColor[category] ?? "bg-marine"
      }`}
    >
      {category}
    </span>
  );
}

export function SaveButton({
  slug,
  className = "",
  withLabel = false,
}: {
  slug: string;
  className?: string;
  withLabel?: boolean;
}) {
  const { has, toggle } = useSavedEvents();
  const saved = has(slug);
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(slug);
      }}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save event"}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-semibold transition-colors hover:border-marine hover:text-marine ${
        saved ? "border-marine text-marine" : "text-navy"
      } ${className}`}
    >
      <Bookmark className={`h-4 w-4 ${saved ? "fill-marine" : ""}`} />
      {withLabel && (saved ? "Saved" : "Save")}
    </button>
  );
}

/** Compact horizontal card for the right sidebar / lists */
export function UpcomingItem({ e }: { e: BarunaEvent }) {
  return (
    <Link to="/events/$slug" params={{ slug: e.slug }} className="group flex gap-3">
      <img
        src={e.image}
        alt={e.title}
        loading="lazy"
        width={64}
        height={64}
        className="h-16 w-16 shrink-0 rounded-lg object-cover"
      />
      <div className="min-w-0">
        <EventBadge category={e.category} />
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-navy group-hover:text-marine">
          {e.shortTitle}
        </h3>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {e.dateLabel}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {e.location}
        </p>
        <Countdown iso={e.startISO} />

      </div>
    </Link>
  );
}

/** Full featured event card — entire card clickable */
export function EventCard({ e }: { e: BarunaEvent }) {
  return (
    <Link
      to="/events/$slug"
      params={{ slug: e.slug }}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-hover"
    >
      <div className="relative h-36 overflow-hidden">
        <img
          src={e.image}
          alt={e.title}
          loading="lazy"
          width={768}
          height={512}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-2.5 top-2.5">
          <EventBadge category={e.category} />
        </span>
        <span className="absolute right-2.5 top-2.5 rounded-md bg-card/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-marine">
          {e.format}
        </span>
        <SaveButton slug={e.slug} className="absolute bottom-2.5 right-2.5 h-8 w-8 p-0" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 min-h-[2.5rem] font-display text-sm font-bold leading-snug text-navy group-hover:text-marine">
          {e.title}
        </h3>
        <div className="mt-2 space-y-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {e.dateLabel}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {e.location}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            {e.organizer}
          </p>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-eco-community">
            <span className="h-2 w-2 rounded-full bg-eco-community" />
            Registration Open
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-marine">
            View Details <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Register / Add to calendar / Share button row */
export function EventActions({
  e,
  variant = "row",
}: {
  e: BarunaEvent;
  variant?: "row" | "stack";
}) {
  return (
    <div className={variant === "stack" ? "flex flex-col gap-2.5" : "flex flex-wrap items-center gap-2.5"}>
      {e.registrationUrl || e.website ? (
        <a
          href={e.registrationUrl ?? e.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-hover"
        >
          <Ticket className="h-4 w-4" /> Register
        </a>
      ) : null}
      {e.website && (
        <a
          href={e.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-navy transition-colors hover:border-marine hover:text-marine"
        >
          <ExternalLink className="h-4 w-4" /> Official Website
        </a>
      )}
      <button
        onClick={() => downloadICS(e)}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-navy transition-colors hover:border-marine hover:text-marine"
      >
        <CalendarPlus className="h-4 w-4" /> Add to Calendar
      </button>
      <button
        onClick={() => shareEvent(e)}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-navy transition-colors hover:border-marine hover:text-marine"
      >
        <Share2 className="h-4 w-4" /> Share
      </button>
      <SaveButton slug={e.slug} withLabel className="px-5 py-3" />
    </div>
  );
}

export function Breadcrumb({
  items,
}: {
  items: { label: string; to?: string; params?: Record<string, string> }[];
}) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-1.5">
          {item.to ? (
            <Link
              to={item.to}
              params={item.params}
              className="font-medium transition-colors hover:text-marine"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-navy">{item.label}</span>
          )}
          {i < items.length - 1 && <span className="text-muted-foreground/50">/</span>}
        </span>
      ))}
    </nav>
  );
}

export function EventGrid({
  items,
  emptyMessage = "No events match your filters yet.",
}: {
  items: BarunaEvent[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((e) => (
        <EventCard key={e.slug} e={e} />
      ))}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-navy">{title}</h1>
      {subtitle && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
