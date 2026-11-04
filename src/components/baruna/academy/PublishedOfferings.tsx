import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Clock, Globe, Layers, Lock, Monitor } from "lucide-react";
import type { CatalogOffering } from "@/lib/academy/catalog.functions";
import {
  DELIVERY_FORMAT_LABEL,
  ENROLMENT_ACCESS_RULE_LABEL,
  LEARNING_MODEL_LABEL,
  SELF_PACED_ACCESS_MODEL_LABEL,
} from "@/lib/learning/classification";
import { MetaItem } from "@/components/baruna/academy/ui";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function fmt(d: string | null) {
  if (!d) return null;
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isNaN(t) ? null : dateFmt.format(t);
}

function range(from: string | null, to: string | null) {
  const a = fmt(from);
  const b = fmt(to);
  if (a && b) return `${a} – ${b}`;
  if (a) return `From ${a}`;
  if (b) return `Until ${b}`;
  return null;
}

/** Offerings published from Konsol Kurasi → Program Academy. Renders nothing when empty. */
export function PublishedOfferingsSection({
  items,
  image,
  title,
  description,
}: {
  items: CatalogOffering[];
  image: string;
  title: string;
  description: string;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="published-offerings-heading" className="space-y-4">
      <div>
        <h2 id="published-offerings-heading" className="font-display text-lg font-extrabold text-navy">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((o) => (
          <OfferingCard key={o.offeringCode} offering={o} image={image} />
        ))}
      </div>
    </section>
  );
}

function OfferingCard({ offering: o, image }: { offering: CatalogOffering; image: string }) {
  const schedule = range(o.openingDate, o.closingDate);
  const enrolment = range(o.enrolmentStartDate, o.enrolmentEndDate);
  const subtitle = [o.offeringTitle, o.cohortName].filter(Boolean).join(" · ");
  const access =
    o.learningModel === "self_paced" && o.selfPacedAccess
      ? `${ENROLMENT_ACCESS_RULE_LABEL[o.accessRule]} · ${SELF_PACED_ACCESS_MODEL_LABEL[o.selfPacedAccess]}`
      : ENROLMENT_ACCESS_RULE_LABEL[o.accessRule];

  return (
    <Link
      to="/academy/course/$offeringId"
      params={{ offeringId: o.offeringCode }}
      aria-label={`Open course: ${o.courseTitle}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-marine/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marine focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        <img
          src={image}
          alt=""
          loading="lazy"
          width={1280}
          height={720}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wide text-marine shadow-sm ring-1 ring-marine/20">
          {DELIVERY_FORMAT_LABEL[o.deliveryFormat]}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-marine px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wide text-white shadow-sm">
          {LEARNING_MODEL_LABEL[o.learningModel]}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-base font-bold text-navy transition-colors group-hover:text-marine">
          {o.courseTitle}
        </h3>
        <p className="mt-1 text-xs font-medium text-marine">{subtitle}</p>
        {o.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{o.description}</p>}

        <div className="mt-4 grid grid-cols-2 gap-y-2 border-t border-border pt-3">
          <MetaItem icon={Layers}>
            {o.moduleCount} {o.moduleCount === 1 ? "module" : "modules"}
          </MetaItem>
          <MetaItem icon={Clock}>{o.totalHours} Hours</MetaItem>
          {o.languageName && <MetaItem icon={Globe}>{o.languageName}</MetaItem>}
          <MetaItem icon={o.accessRule === "open" ? Monitor : Lock}>{access}</MetaItem>
        </div>

        {(schedule || enrolment) && (
          <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            {schedule && (
              <p className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-marine/70" />
                Runs {schedule}
              </p>
            )}
            {enrolment && (
              <p className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-marine/70" />
                Enrolment {enrolment}
              </p>
            )}
          </div>
        )}

        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-marine">
          View course <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
