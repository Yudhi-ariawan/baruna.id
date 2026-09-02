import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Clock,
  BarChart3,
  MapPin,
  Globe,
  Monitor,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { GraduationCap, Info } from "lucide-react";
import {
  AcademyHeader,
  TabBar,
  StatusBadge,
  MetaItem,
  Rating,
  DateChip,
  PrimaryButton,
  OutlineButton,
  FilterPanel,
  FilterSearch,
  FilterGroup,
  CheckRow,
  FilterSelect,
  ApplyButton,
  ShowMore,
  type Tab,
} from "@/components/baruna/academy/ui";
import { academyImages } from "@/data/academy";
import { expertImages } from "@/data/pages";
import { featuredTrainingCard } from "@/data/training";

export const Route = createFileRoute("/academy/training/")({
  head: () => ({
    meta: [
      { title: "Training — Academy — BARUNA" },
      {
        name: "description",
        content:
          "Instructor-led training programs designed to build practical skills and strengthen your capacity in marine and fisheries.",
      },
      { property: "og:title", content: "Training — Academy — BARUNA" },
      { property: "og:description", content: "Instructor-led marine and fisheries training programs." },
      { property: "og:image", content: academyImages.seaTurtle },
      { property: "og:url", content: "/academy/training" },
    ],
    links: [{ rel: "canonical", href: "/academy/training" }],
  }),
  component: TrainingPage,
});

const tabs: Tab[] = [
  { label: "All Training", count: "156 Programs", active: true },
  { label: "Beginner", count: "42 Programs" },
  { label: "Intermediate", count: "68 Programs" },
  { label: "Advanced", count: "46 Programs" },
  { label: "In-person", count: "78 Programs" },
  { label: "Online", count: "92 Programs" },
  { label: "Blended", count: "31 Programs" },
];

type TrainingItem = {
  slug?: string;
  badge: string;
  image: string;
  title: string;
  desc: string;
  duration: string;
  level: string;
  mode: string;
  modeIcon: typeof MapPin;
  language: string;
  instructor: string;
  avatar: string;
  rating: number;
  reviews: number;
  date: { top: string; big: string; year: string; tone: "marine" | "green" | "amber" };
};

const items: TrainingItem[] = [
  {
    slug: featuredTrainingCard.slug,
    badge: featuredTrainingCard.badge, image: featuredTrainingCard.image,
    title: featuredTrainingCard.title,
    desc: featuredTrainingCard.desc,
    duration: featuredTrainingCard.duration, level: featuredTrainingCard.level,
    mode: featuredTrainingCard.mode, modeIcon: MapPin, language: featuredTrainingCard.language,
    instructor: featuredTrainingCard.instructor, avatar: featuredTrainingCard.avatar,
    rating: featuredTrainingCard.rating, reviews: featuredTrainingCard.reviews, date: featuredTrainingCard.date,
  },
  {
    badge: "IN-PERSON", image: academyImages.seaTurtle,
    title: "Sustainable Fisheries Management",
    desc: "Learn sustainable fisheries principles and practices for responsible resource management and conservation.",
    duration: "5 Days", level: "Beginner", mode: "Bali, Indonesia", modeIcon: MapPin, language: "English",
    instructor: "Dr. Maya Lestari", avatar: expertImages[0],
    rating: 4.7, reviews: 98, date: { top: "JUN", big: "24 – 28", year: "2026", tone: "green" },
  },
  {
    badge: "BLENDED", image: academyImages.aquaculture,
    title: "Aquaculture Production and Management",
    desc: "Enhance your knowledge and skills in sustainable aquaculture production systems.",
    duration: "4 Days", level: "Intermediate", mode: "Online + Lab", modeIcon: Monitor, language: "English",
    instructor: "Dr. Putu Ayu Brahmini, S.Pi., M.Si.", avatar: expertImages[1],
    rating: 4.6, reviews: 76, date: { top: "JUL", big: "7 – 10", year: "2026", tone: "marine" },
  },
  {
    badge: "ONLINE", image: academyImages.fisheriesWorkers,
    title: "Fisheries Data Collection and Monitoring",
    desc: "Learn modern data collection methods and monitoring techniques for fisheries resources.",
    duration: "3 Days", level: "Beginner", mode: "Online", modeIcon: Monitor, language: "English",
    instructor: "Dr. Gede Mahiswara, S.Pi., M.T.", avatar: expertImages[2],
    rating: 4.8, reviews: 120, date: { top: "JUL", big: "14 – 16", year: "2026", tone: "amber" },
  },
  {
    badge: "IN-PERSON", image: academyImages.mangrove,
    title: "Marine Ecosystem Conservation",
    desc: "Understand marine ecosystems and strategies for effective conservation and restoration.",
    duration: "5 Days", level: "Intermediate", mode: "Lombok, Indonesia", modeIcon: MapPin, language: "English",
    instructor: "Dr. Ni Wayan Suryati, S.Kel., M.Sc.", avatar: expertImages[3],
    rating: 4.7, reviews: 64, date: { top: "JUL", big: "21 – 25", year: "2026", tone: "green" },
  },
  {
    badge: "BLENDED", image: academyImages.coralDiver,
    title: "Coral Reef Monitoring Techniques",
    desc: "Hands-on training to monitor, assess, and report coral reef health and biodiversity.",
    duration: "3 Days", level: "Advanced", mode: "Bali, Indonesia", modeIcon: MapPin, language: "English",
    instructor: "Dr. Made Wirawan, S.Kel., M.Sc.", avatar: expertImages[4],
    rating: 4.9, reviews: 54, date: { top: "AUG", big: "4 – 6", year: "2026", tone: "marine" },
  },
  {
    badge: "ONLINE", image: academyImages.offshoreWind,
    title: "Blue Economy Fundamentals",
    desc: "Explore opportunities and strategies for building a sustainable blue economy.",
    duration: "4 Weeks", level: "Beginner", mode: "Online", modeIcon: Monitor, language: "English",
    instructor: "Dr. Kadek Surya, S.Pi., M.Si.", avatar: expertImages[5],
    rating: 4.8, reviews: 132, date: { top: "AUG", big: "14 – 18", year: "2026", tone: "amber" },
  },
];

function TrainingCard({ t }: { t: TrainingItem }) {
  const ModeIcon = t.modeIcon;
  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-marine/40 hover:shadow-hover">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative h-44 w-full shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-40">
          <img src={t.image} alt={t.title} loading="lazy" width={768} height={512} className="h-full w-full object-cover" />
          <span className="absolute left-2 top-2">
            <StatusBadge label={t.badge} />
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {t.slug ? (
            <Link
              to="/academy/training/$slug"
              params={{ slug: t.slug }}
              className="font-display text-lg font-bold text-navy transition-colors hover:text-marine"
            >
              {t.title}
            </Link>
          ) : (
            <h3 className="font-display text-lg font-bold text-navy">{t.title}</h3>
          )}
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <MetaItem icon={Clock}>{t.duration}</MetaItem>
            <MetaItem icon={BarChart3}>{t.level}</MetaItem>
            <MetaItem icon={ModeIcon}>{t.mode}</MetaItem>
            <MetaItem icon={Globe}>{t.language}</MetaItem>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <img src={t.avatar} alt={t.instructor} loading="lazy" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
              <span className="text-xs font-medium text-foreground/80">{t.instructor}</span>
            </div>
            <Rating value={t.rating} reviews={t.reviews} />
          </div>
        </div>

        <div className="flex shrink-0 flex-row items-center gap-3 sm:w-[150px] sm:flex-col sm:items-stretch">
          <DateChip top={t.date.top} big={t.date.big} year={t.date.year} tone={t.date.tone} />
          <div className="flex flex-1 flex-col gap-2 sm:flex-none">
            {t.slug ? (
              <Link
                to="/academy/training/$slug"
                params={{ slug: t.slug }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground transition-all hover:-translate-y-0.5 hover:bg-marine/90 hover:shadow-hover"
              >
                View Details
              </Link>
            ) : (
              <PrimaryButton className="w-full">View Details</PrimaryButton>
            )}
            <OutlineButton className="w-full">Save</OutlineButton>
          </div>
        </div>
      </div>
    </article>
  );
}

function TrainingPage() {
  return (
    <AcademyShell
      active="training"
      aside={
        <>
          <FilterPanel title="Filter Programs">
            <FilterSearch placeholder="Search programs..." />
            <FilterGroup label="Category">
              <CheckRow label="Fisheries Management" count={24} />
              <CheckRow label="Aquaculture" count={18} />
              <CheckRow label="Marine Conservation" count={22} />
              <CheckRow label="Blue Economy" count={19} />
              <CheckRow label="Ocean Governance" count={16} />
              <ShowMore />
            </FilterGroup>
            <FilterGroup label="Topic">
              <FilterSelect placeholder="Select topic" />
            </FilterGroup>
            <FilterGroup label="Level">
              <CheckRow label="Beginner" count={42} />
              <CheckRow label="Intermediate" count={68} />
              <CheckRow label="Advanced" count={46} />
            </FilterGroup>
            <FilterGroup label="Delivery Mode">
              <CheckRow label="In-person" count={78} />
              <CheckRow label="Online" count={92} />
              <CheckRow label="Blended" count={31} />
            </FilterGroup>
            <FilterGroup label="Location">
              <FilterSelect placeholder="Select location" />
            </FilterGroup>
            <ApplyButton />
          </FilterPanel>

          <div className="rounded-2xl border border-marine/20 bg-marine/5 p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marine/10 text-marine">
                <HelpCircle className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-navy">Can't find the right training?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Submit a request for training topics you're interested in.
                </p>
                <Link
                  to="/academy/request-training"
                  className="mt-3 flex items-center gap-1 text-sm font-semibold text-marine hover:text-navy"
                >
                  Request Training <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </>
      }
    >
      <div className="space-y-6">
        <AcademyHeader
          crumb="Training"
          title="Training"
          description="Instructor-led training programs designed to build practical skills and strengthen your capacity in marine and fisheries."
          searchPlaceholder="Search training programs, topics, or instructors..."
          sort
        />
        <TabBar tabs={tabs} />
        <p className="text-sm text-muted-foreground">Showing 1–12 of 156 programs</p>
        <div className="space-y-4">
          {items.map((t) => (
            <TrainingCard key={t.title} t={t} />
          ))}
        </div>

        <section
          aria-labelledby="training-cta-heading"
          className="mt-8 overflow-hidden rounded-2xl border border-marine/20 bg-gradient-to-r from-marine/10 via-marine/5 to-marine/10 p-6 shadow-soft sm:p-8"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-marine/15 text-marine">
                <GraduationCap className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h2
                  id="training-cta-heading"
                  className="font-display text-xl font-extrabold text-navy sm:text-2xl"
                >
                  Can't Find the Right Training?
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Tell us about your learning needs and BARUNA will help identify, recommend, or
                  develop the most suitable capacity-building program.
                </p>
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-marine/20 bg-card/70 p-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-marine" />
                  <p>
                    Training requests are reviewed by the BARUNA team and may be connected with
                    existing programs, partner institutions, or developed as new training
                    initiatives.
                  </p>
                </div>
              </div>
            </div>
            <Link
              to="/academy/request-training"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-hover"
            >
              Request a Training
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </AcademyShell>
  );
}
