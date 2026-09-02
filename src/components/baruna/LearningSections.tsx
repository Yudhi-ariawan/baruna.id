import { ArrowRight, Star } from "lucide-react";
import {
  continueLearning,
  recommended,
  type RecommendedCourse,
  type ContinueCourse,
} from "@/data/baruna";

const badgeBg: Record<string, string> = {
  COURSE: "bg-badge-course",
  TRAINING: "bg-badge-training",
  WEBINAR: "bg-badge-webinar",
  WORKSHOP: "bg-badge-workshop",
};

function CategoryBadge({ label }: { label: string }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-navy-foreground ${badgeBg[label]}`}
    >
      {label}
    </span>
  );
}

function SectionHead({ title, action }: { title: string; action: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold text-navy sm:text-xl">{title}</h2>
      <a
        href="#"
        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-marine transition-colors hover:text-navy"
      >
        {action}
        <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function ContinueCard({ course }: { course: ContinueCourse }) {
  return (
    <article className="flex w-[300px] shrink-0 gap-3 rounded-xl border border-border bg-card p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-hover sm:w-auto sm:shrink">
      <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-lg">
        <img
          src={course.image}
          alt={course.title}
          loading="lazy"
          width={768}
          height={512}
          className="h-full w-full object-cover"
        />
        <span className="absolute left-1.5 top-1.5">
          <CategoryBadge label={course.tag} />
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="line-clamp-2 text-sm font-semibold text-navy">{course.title}</h3>
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          {course.progress}% Completed
        </p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-marine"
            style={{ width: `${course.progress}%` }}
          />
        </div>
        <button className="mt-auto w-full rounded-lg border border-marine/40 py-1.5 text-xs font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground">
          Continue
        </button>
      </div>
    </article>
  );
}

function RecommendedCard({ course }: { course: RecommendedCourse }) {
  return (
    <article className="flex w-[230px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-hover">
      <div className="relative h-28 overflow-hidden">
        <img
          src={course.image}
          alt={course.title}
          loading="lazy"
          width={768}
          height={512}
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
        />
        <span className="absolute left-2 top-2">
          <CategoryBadge label={course.category} />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-navy">
          {course.title}
        </h3>
        <div className="mt-auto flex items-center justify-between pt-3 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-marine" />
            {course.level}
          </span>
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Star className="h-3.5 w-3.5 fill-star text-star" />
            {course.rating}{" "}
            <span className="text-muted-foreground">({course.reviews})</span>
          </span>
        </div>
      </div>
    </article>
  );
}

export function LearningSections() {
  return (
    <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <SectionHead title="Continue Learning" action="View all my learning" />
          <div className="flex gap-4 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible">
            {continueLearning.slice(0, 2).map((c) => (
              <ContinueCard key={c.title} course={c} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <SectionHead title="Recommended for You" action="View all recommendations" />
          <div className="flex gap-4 overflow-x-auto pb-2">
            {recommended.map((c) => (
              <RecommendedCard key={c.title} course={c} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
