import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Mail } from "lucide-react";
import type { Instructor } from "@/data/instructors";
import { groupInstructors } from "@/data/instructors";

/**
 * Shared instructor card — compact, horizontal "academy" profile card used
 * across Academy, Experts, Fellowship and Knowledge Hub so the same profile
 * and photo render consistently everywhere.
 *
 * Layout: small portrait thumbnail on the left (NOT a hero image) with the
 * instructor information as the primary focus on the right. Visual hierarchy:
 * Photo → Name → Position → Organization → Expertise → Bio → View Profile.
 */
export function InstructorCard({ instructor }: { instructor: Instructor }) {
  const i = instructor;
  return (
    <article className="group flex h-full gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-1 hover:border-marine/40 hover:shadow-hover">
      <img
        src={i.photo}
        alt={`Portrait of ${i.name}`}
        loading="lazy"
        width={240}
        height={320}
        className="aspect-[3/4] w-[72px] shrink-0 self-start rounded-xl object-cover object-center sm:w-[96px]"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-display text-base font-bold leading-tight text-navy">{i.name}</h3>
        <p className="mt-1 text-xs font-semibold leading-snug text-marine">{i.position}</p>
        <p className="mt-1 flex items-start gap-1.5 text-[0.7rem] leading-snug text-muted-foreground">
          <Building2 className="mt-0.5 h-3 w-3 shrink-0" />
          {i.organization}
        </p>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {i.expertise.map((x) => (
            <span
              key={x}
              className="rounded-md bg-secondary px-2 py-0.5 text-[0.65rem] font-medium text-navy"
            >
              {x}
            </span>
          ))}
        </div>

        <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{i.summary}</p>

        <div className="mt-2.5 rounded-lg border border-marine/15 bg-marine/5 px-3 py-1.5">
          <p className="text-[0.6rem] font-bold uppercase tracking-wide text-marine/80">
            Role in This Program
          </p>
          <p className="mt-0.5 text-xs font-semibold text-navy">{i.programRole}</p>
        </div>

        <Link
          to="/experts/$slug"
          params={{ slug: i.slug }}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-marine transition-colors hover:text-navy"
        >
          View Profile <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

/** Compact directory card with no program-role block (for the Experts page). */
export function ExpertInstructorCard({ instructor }: { instructor: Instructor }) {
  const i = instructor;
  return (
    <article className="group flex h-full gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-1 hover:border-marine/40 hover:shadow-hover">
      <img
        src={i.photo}
        alt={`Portrait of ${i.name}`}
        loading="lazy"
        width={240}
        height={320}
        className="aspect-[3/4] w-[72px] shrink-0 self-start rounded-xl object-cover object-center sm:w-[88px]"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-display text-sm font-bold leading-tight text-navy">{i.name}</h3>
        <p className="mt-1 text-xs font-medium leading-snug text-marine">{i.position}</p>
        <p className="mt-1 text-[0.7rem] leading-snug text-muted-foreground">{i.organization}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {i.expertise.slice(0, 4).map((x) => (
            <span key={x} className="rounded-md bg-secondary px-2 py-0.5 text-[0.65rem] font-medium text-navy">
              {x}
            </span>
          ))}
        </div>
        {i.email && (
          <p className="mt-2.5 flex items-center gap-1.5 truncate text-[0.7rem] text-muted-foreground">
            <Mail className="h-3 w-3 shrink-0" /> {i.email}
          </p>
        )}
        <Link
          to="/experts/$slug"
          params={{ slug: i.slug }}
          className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-marine transition-colors hover:text-navy"
        >
          View Profile <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

/**
 * Grouped instructor directory — Lead Instructors, Aquaculture Specialists,
 * Fish Processing & Value Addition Specialists. Each group gets a title and
 * divider. Lead Instructors render in a 2-column grid; specialist groups in a
 * denser grid so cards stay compact and equal-height.
 */
export function GroupedInstructorDirectory({ list }: { list: Instructor[] }) {
  const groups = groupInstructors(list);
  return (
    <div className="space-y-10">
      {groups.map(({ group, items }) => {
        return (
          <section key={group}>
            <div className="flex items-center gap-3">
              <h3 className="font-display text-lg font-bold text-navy">{group}</h3>
              <span className="rounded-full bg-marine/10 px-2.5 py-0.5 text-xs font-semibold text-marine">
                {items.length}
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-marine/40 to-transparent" />
            </div>
            <div className="mt-5 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
              {items.map((i) => (
                <InstructorCard key={i.slug} instructor={i} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
