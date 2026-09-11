import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  ArrowRight,
  BarChart3,
  
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter as FilterIcon,
  Globe,
  GraduationCap,
  Info,
  MapPin,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import {
  MetaItem,
  ProgramTypeTabs,
  Rating,
  StatusBadge,
} from "@/components/baruna/academy/ui";
import { academyImages } from "@/data/academy";
import {
  PROGRAM_TYPES,
  PROGRAM_TYPE_LABEL,
  programs,
  type Program,
  type ProgramType,
} from "@/data/programs";
import type { AcademyActive } from "@/components/baruna/academy/AcademySidebar";

/* ============================================================
 *  Filter option definitions (label + URL-safe value)
 * ============================================================ */

type Opt = { value: string; label: string };

const CATEGORIES: Opt[] = [
  { value: "fisheries-management", label: "Fisheries Management" },
  { value: "aquaculture", label: "Aquaculture" },
  { value: "marine-conservation", label: "Marine Conservation" },
  { value: "blue-economy", label: "Blue Economy" },
  { value: "climate-change", label: "Climate Change" },
  { value: "ocean-governance", label: "Ocean Governance" },
  { value: "marine-spatial-planning", label: "Marine Spatial Planning" },
  { value: "fisheries-surveillance", label: "Fisheries Surveillance" },
  { value: "fish-processing", label: "Fish Processing and Value Addition" },
];

const DELIVERY_MODES: Opt[] = [
  { value: "online", label: "Online" },
  { value: "in-person", label: "In-person" },
  { value: "blended", label: "Blended" },
  { value: "self-paced", label: "Self-paced" },
  { value: "live-virtual", label: "Live Virtual" },
];

const LANGUAGES: Opt[] = [
  { value: "english", label: "English" },
  { value: "indonesian", label: "Indonesian" },
  { value: "bilingual", label: "Bilingual" },
  { value: "other", label: "Other" },
];

const LEVELS: Opt[] = [
  { value: "foundation", label: "Foundation" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "professional", label: "Professional" },
];

const STATUSES: Opt[] = [
  { value: "applications-open", label: "Applications Open" },
  { value: "upcoming", label: "Upcoming" },
  { value: "ongoing", label: "Ongoing" },
  { value: "enrollment-open", label: "Enrollment Open" },
  { value: "available-now", label: "Available Now" },
];

const SCHEDULES: Opt[] = [
  { value: "any", label: "Any Date" },
  { value: "this-month", label: "This Month" },
  { value: "next-3-months", label: "Next 3 Months" },
  { value: "this-year", label: "This Year" },
  { value: "anytime", label: "Available Anytime" },
];

const CERTIFICATES: Opt[] = [
  { value: "any-certificate", label: "Certificate Available" },
  { value: "completion", label: "Certificate of Completion" },
  { value: "programme", label: "Programme Certificate" },
  { value: "assessment", label: "Certification Assessment" },
  { value: "none", label: "No Certificate" },
];

const REGIONS: Opt[] = [
  { value: "indonesia", label: "Indonesia" },
  { value: "southeast-asia", label: "Southeast Asia" },
  { value: "asia-pacific", label: "Asia-Pacific" },
  { value: "africa", label: "Africa" },
  { value: "international", label: "International" },
  { value: "global", label: "Global" },
];

const DURATIONS: Opt[] = [
  { value: "under-2h", label: "Under 2 hours" },
  { value: "2-5h", label: "2–5 hours" },
  { value: "6-10h", label: "6–10 hours" },
  { value: "over-10h", label: "More than 10 hours" },
  { value: "multi-day", label: "Multi-day" },
  { value: "multi-week", label: "Multi-week" },
];

// Instructor options are derived from the actual programs dataset below.

/* ============================================================
 *  Derivation helpers (single source of truth = programs[])
 * ============================================================ */

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const categorySlug = (raw: string): string => {
  const map: Record<string, string> = {
    "Fisheries Management": "fisheries-management",
    Aquaculture: "aquaculture",
    "Marine Conservation": "marine-conservation",
    "Blue Economy": "blue-economy",
    "Climate Change": "climate-change",
    "Ocean Governance": "ocean-governance",
    "Marine Spatial Planning": "marine-spatial-planning",
    "Fisheries Surveillance": "fisheries-surveillance",
    "Fish Processing and Value Addition": "fish-processing",
  };
  return map[raw] ?? slug(raw);
};

const languageSlug = (raw: string): string => {
  const l = raw.toLowerCase();
  if (l.includes("english") && l.includes("indonesian")) return "bilingual";
  if (l === "english") return "english";
  if (l === "indonesian") return "indonesian";
  return "other";
};

const levelSlug = (raw: Program["level"]): string => {
  if (raw === "Beginner") return "foundation";
  if (raw === "Intermediate") return "intermediate";
  return "advanced";
};

// Certification programs earn "Professional" bucket in addition to Advanced.
const levelSlugsFor = (p: Program): string[] => {
  const base = levelSlug(p.level);
  if (p.type === "certification") return [base, "professional"];
  return [base];
};

const deliveryModeSlug = (p: Program): string => {
  if (p.type === "self-paced") return "self-paced";
  if (p.type === "webinar") return p.status === "ON DEMAND" ? "online" : "live-virtual";
  if (p.type === "workshop") return p.status === "ON DEMAND" ? "online" : "in-person";
  if (p.type === "certification") return "blended";
  // training
  if (p.duration.toLowerCase().includes("hour")) return "online";
  return p.status === "ON DEMAND" ? "online" : "in-person";
};

const regionSlug = (p: Program): string => {
  const k = (p.title + " " + p.keywords.join(" ")).toLowerCase();
  if (k.includes("africa")) return "africa";
  if (k.includes("asean") || k.includes("southeast")) return "southeast-asia";
  if (k.includes("global") || k.includes("world")) return "global";
  if (k.includes("asia-pacific") || k.includes("asia pacific")) return "asia-pacific";
  if (p.country === "Indonesia") return "indonesia";
  return "international";
};

const statusFilterSlug = (p: Program): string => {
  switch (p.status) {
    case "OPEN FOR REGISTRATION":
      return p.type === "certification" || p.type === "self-paced"
        ? "enrollment-open"
        : "applications-open";
    case "UPCOMING":
      return "upcoming";
    case "LIVE NOW":
      return "ongoing";
    case "ON DEMAND":
    case "ONLINE":
      return "available-now";
    default:
      return "upcoming";
  }
};

// Certificate buckets — a program can satisfy multiple values (e.g. "any-certificate" and its specific type).
const certificateSlugsFor = (p: Program): string[] => {
  if (p.type === "certification") return ["any-certificate", "assessment", "programme"];
  if (p.type === "training") return ["any-certificate", "programme"];
  if (p.type === "workshop" || p.type === "self-paced") return ["any-certificate", "completion"];
  return ["none"]; // webinars
};

// Parse "5 Days", "1.5 Hours", "24 Hours", "45 Minutes" into an object.
function parseDuration(raw: string): { hours: number; days: number } {
  const m = raw.match(/([\d.]+)\s*(minute|hour|day|week)/i);
  if (!m) return { hours: 0, days: 0 };
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith("minute")) return { hours: n / 60, days: 0 };
  if (unit.startsWith("hour")) return { hours: n, days: 0 };
  if (unit.startsWith("day")) return { hours: n * 8, days: n };
  return { hours: n * 40, days: n * 7 };
}

const durationSlug = (p: Program): string => {
  const { hours, days } = parseDuration(p.duration);
  if (days >= 7) return "multi-week";
  if (days >= 2) return "multi-day";
  if (hours > 10) return "over-10h";
  if (hours >= 6) return "6-10h";
  if (hours >= 2) return "2-5h";
  return "under-2h";
};

const scheduleMatches = (p: Program, bucket: string, now: Date): boolean => {
  if (bucket === "any") return true;
  if (bucket === "anytime") return p.type === "self-paced";
  const start = new Date(p.startDate + "T00:00:00Z");
  if (bucket === "this-month") {
    return (
      start.getUTCFullYear() === now.getUTCFullYear() &&
      start.getUTCMonth() === now.getUTCMonth()
    );
  }
  if (bucket === "next-3-months") {
    const in3 = new Date(now);
    in3.setUTCMonth(in3.getUTCMonth() + 3);
    return start >= now && start <= in3;
  }
  if (bucket === "this-year") return start.getUTCFullYear() === now.getUTCFullYear();
  return true;
};

const instructorSlug = (name: string): string => slug(name);

/* ============================================================
 *  URL search schema (single shared state)
 * ============================================================ */

const searchSchema = z.object({
  type: fallback(z.string(), "").default(""), // back-compat single-select
  types: fallback(z.string(), "").default(""), // csv
  q: fallback(z.string(), "").default(""),
  categories: fallback(z.string(), "").default(""),
  delivery: fallback(z.string(), "").default(""),
  languages: fallback(z.string(), "").default(""),
  levels: fallback(z.string(), "").default(""),
  statuses: fallback(z.string(), "").default(""),
  schedule: fallback(z.string(), "").default(""), // single-select
  certificates: fallback(z.string(), "").default(""),
  regions: fallback(z.string(), "").default(""),
  durations: fallback(z.string(), "").default(""),
  instructors: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "newest").default("newest"),
  page: fallback(z.number().int(), 1).default(1),
});

type ProgramsSearch = {
  type: string;
  types: string;
  q: string;
  categories: string;
  delivery: string;
  languages: string;
  levels: string;
  statuses: string;
  schedule: string;
  certificates: string;
  regions: string;
  durations: string;
  instructors: string;
  sort: string;
  page: number;
};

const EMPTY_SEARCH: ProgramsSearch = {
  type: "",
  types: "",
  q: "",
  categories: "",
  delivery: "",
  languages: "",
  levels: "",
  statuses: "",
  schedule: "",
  certificates: "",
  regions: "",
  durations: "",
  instructors: "",
  sort: "newest",
  page: 1,
};

export const Route = createFileRoute("/academy/programs")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "All Programs — Academy — BARUNA" },
      {
        name: "description",
        content:
          "Browse every marine and fisheries learning program — training, webinars, workshops, certifications, and self-paced courses — with unified filters, search, and sort.",
      },
      { property: "og:title", content: "All Programs — Academy — BARUNA" },
      {
        property: "og:description",
        content: "Every BARUNA Academy program in one unified, filterable catalogue.",
      },
      { property: "og:image", content: academyImages.seaTurtle },
      { property: "og:url", content: "/academy/programs" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: academyImages.seaTurtle },
    ],
    links: [{ rel: "canonical", href: "/academy/programs" }],
  }),
  component: ProgramsPage,
});

/* ============================================================
 *  Meta per active tab
 * ============================================================ */

const TYPE_META: Record<
  ProgramType | "all" | "multi",
  { label: string; heading: string; description: string; crumb: string }
> = {
  all: {
    label: "All Programs",
    heading: "All Programs",
    description:
      "Browse every marine and fisheries learning program — training, webinars, workshops, certifications, and self-paced courses.",
    crumb: "All Programs",
  },
  training: {
    label: "Training",
    heading: "Training Programs",
    description:
      "Instructor-led programs designed to build practical skills and strengthen your capacity in marine and fisheries.",
    crumb: "Training",
  },
  webinar: {
    label: "Webinar",
    heading: "Webinars",
    description:
      "Live and on-demand webinar sessions with experts. Learn, ask questions, and exchange ideas with a global community.",
    crumb: "Webinar",
  },
  workshop: {
    label: "Workshop",
    heading: "Workshops",
    description:
      "Hands-on and practical workshops to build technical skills and solve real-world marine and fisheries challenges.",
    crumb: "Workshop",
  },
  certification: {
    label: "Certification",
    heading: "Certifications",
    description:
      "Earn industry-recognised certificates that validate your expertise and enhance your professional credibility.",
    crumb: "Certification",
  },
  "self-paced": {
    label: "Self-paced",
    heading: "Self-paced Courses",
    description:
      "Learn at your own pace anytime, anywhere. Flexible self-paced courses covering the full BARUNA syllabus.",
    crumb: "Self-paced",
  },
  multi: {
    label: "Filtered Programs",
    heading: "Filtered Programs",
    description:
      "Programs matching your selected types. Adjust filters or return to All Programs at any time.",
    crumb: "Filtered Programs",
  },
};

/* ============================================================
 *  Sorters
 * ============================================================ */

const SORT_KEYS = [
  "newest",
  "oldest",
  "a-z",
  "z-a",
  "popular",
  "rating",
  "participants",
  "closing-soon",
] as const;
type SortKey = (typeof SORT_KEYS)[number];

const NOW = new Date("2026-07-22T00:00:00Z");

const sorters: Record<SortKey, (a: Program, b: Program) => number> = {
  newest: (a, b) => (b.startDate > a.startDate ? 1 : b.startDate < a.startDate ? -1 : 0),
  oldest: (a, b) => (a.startDate > b.startDate ? 1 : a.startDate < b.startDate ? -1 : 0),
  "a-z": (a, b) => a.title.localeCompare(b.title),
  "z-a": (a, b) => b.title.localeCompare(a.title),
  popular: (a, b) => b.reviews - a.reviews,
  rating: (a, b) => b.rating - a.rating,
  participants: (a, b) => b.participants - a.participants,
  "closing-soon": (a, b) => {
    const ad = new Date(a.startDate).getTime() - NOW.getTime();
    const bd = new Date(b.startDate).getTime() - NOW.getTime();
    const av = ad < 0 ? Number.POSITIVE_INFINITY : ad;
    const bv = bd < 0 ? Number.POSITIVE_INFINITY : bd;
    return av - bv;
  },
};

function coerceSort(v: string): SortKey {
  return (SORT_KEYS as readonly string[]).includes(v) ? (v as SortKey) : "newest";
}

/* ============================================================
 *  URL <-> arrays
 * ============================================================ */

const csv = (arr: string[]): string => arr.filter(Boolean).join(",");
const parseCsv = (raw: unknown): string[] => {
  const s = typeof raw === "string" ? raw : String(raw ?? "");
  return s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
};

/* ============================================================
 *  Page
 * ============================================================ */

// Derived option list for Instructor filter (from real data + approved trainer roster).
const APPROVED_TRAINERS = [
  "Dr. Aruna Pratama",
  "Dr. Maya Lestari",
  "Dr. Nara Samudra",
  "Prof. Dimas Cakrawala",
  "Dr. Kirana Wibawa",
  "Dr. Sinta Mahardika",
  "Ir. Raka Bimantara",
  "Captain Aditya Wiratama",
  "Dr. Larasati Pangan",
];
const INSTRUCTOR_OPTS: Opt[] = APPROVED_TRAINERS.map((name) => ({
  value: instructorSlug(name),
  label: name,
}));

// Filter groups metadata for chips rendering.
type GroupKey =
  | "types"
  | "categories"
  | "delivery"
  | "languages"
  | "levels"
  | "statuses"
  | "schedule"
  | "certificates"
  | "regions"
  | "durations"
  | "instructors";

const GROUP_LABEL: Record<GroupKey, string> = {
  types: "Type",
  categories: "Category",
  delivery: "Delivery",
  languages: "Language",
  levels: "Level",
  statuses: "Status",
  schedule: "Schedule",
  certificates: "Certificate",
  regions: "Region",
  durations: "Duration",
  instructors: "Instructor",
};

function ProgramsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/academy/programs" });

  // ------- Parse URL into filter arrays -------
  const selectedTypes = useMemo<ProgramType[]>(() => {
    const list = parseCsv(search.types);
    const set = new Set<string>(list);
    if (
      String(search.type ?? "") &&
      String(search.type ?? "") !== "all" &&
      (PROGRAM_TYPES as readonly string[]).includes(String(search.type))
    ) {
      set.add(String(search.type));
    }
    return [...set].filter((t): t is ProgramType =>
      (PROGRAM_TYPES as readonly string[]).includes(t),
    );
  }, [search.type, search.types]);

  const sel = {
    types: selectedTypes as string[],
    categories: useMemo(() => parseCsv(search.categories), [search.categories]),
    delivery: useMemo(() => parseCsv(search.delivery), [search.delivery]),
    languages: useMemo(() => parseCsv(search.languages), [search.languages]),
    levels: useMemo(() => parseCsv(search.levels), [search.levels]),
    statuses: useMemo(() => parseCsv(search.statuses), [search.statuses]),
    certificates: useMemo(() => parseCsv(search.certificates), [search.certificates]),
    regions: useMemo(() => parseCsv(search.regions), [search.regions]),
    durations: useMemo(() => parseCsv(search.durations), [search.durations]),
    instructors: useMemo(() => parseCsv(search.instructors), [search.instructors]),
    schedule: String(search.schedule ?? ""),
  };

  const activeKey: ProgramType | "all" | "multi" =
    selectedTypes.length === 0
      ? "all"
      : selectedTypes.length === 1
        ? selectedTypes[0]
        : "multi";

  const meta = TYPE_META[activeKey];
  const sortKey = coerceSort(String(search.sort ?? "newest"));

  // ------- Debounced search (syncs URL <-> both inputs) -------
  const [qLocal, setQLocal] = useState<string>(String(search.q ?? ""));
  useEffect(() => {
    setQLocal(String(search.q ?? ""));
  }, [search.q]);
  useEffect(() => {
    if (qLocal === String(search.q ?? "")) return;
    const t = setTimeout(() => {
      patchSearch({ q: qLocal, page: 1 });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qLocal]);

  const q = qLocal.trim().toLowerCase();

  // ------- Match helpers per group -------
  const matchText = (p: Program): boolean => {
    if (!q) return true;
    const hay = [
      p.title,
      p.description,
      p.category,
      p.instructor,
      p.organization,
      p.country,
      p.language,
      ...p.keywords,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  };
  const matchType = (p: Program) => sel.types.length === 0 || sel.types.includes(p.type);
  const matchCategory = (p: Program) =>
    sel.categories.length === 0 || sel.categories.includes(categorySlug(p.category));
  const matchDelivery = (p: Program) =>
    sel.delivery.length === 0 || sel.delivery.includes(deliveryModeSlug(p));
  const matchLanguage = (p: Program) =>
    sel.languages.length === 0 || sel.languages.includes(languageSlug(p.language));
  const matchLevel = (p: Program) =>
    sel.levels.length === 0 || levelSlugsFor(p).some((l) => sel.levels.includes(l));
  const matchStatus = (p: Program) =>
    sel.statuses.length === 0 || sel.statuses.includes(statusFilterSlug(p));
  const matchCertificate = (p: Program) =>
    sel.certificates.length === 0 ||
    certificateSlugsFor(p).some((c) => sel.certificates.includes(c));
  const matchRegion = (p: Program) =>
    sel.regions.length === 0 || sel.regions.includes(regionSlug(p));
  const matchDuration = (p: Program) =>
    sel.durations.length === 0 || sel.durations.includes(durationSlug(p));
  const matchInstructor = (p: Program) =>
    sel.instructors.length === 0 || sel.instructors.includes(instructorSlug(p.instructor));
  const matchSchedule = (p: Program) =>
    !sel.schedule || sel.schedule === "any" || scheduleMatches(p, sel.schedule, NOW);

  // Helper: apply all filters EXCEPT a specified one (used for count derivation).
  type Group =
    | "type"
    | "category"
    | "delivery"
    | "language"
    | "level"
    | "status"
    | "certificate"
    | "region"
    | "duration"
    | "instructor"
    | "schedule";

  const applyExcept = (except?: Group) =>
    programs.filter((p) => {
      if (!matchText(p)) return false;
      if (except !== "type" && !matchType(p)) return false;
      if (except !== "category" && !matchCategory(p)) return false;
      if (except !== "delivery" && !matchDelivery(p)) return false;
      if (except !== "language" && !matchLanguage(p)) return false;
      if (except !== "level" && !matchLevel(p)) return false;
      if (except !== "status" && !matchStatus(p)) return false;
      if (except !== "certificate" && !matchCertificate(p)) return false;
      if (except !== "region" && !matchRegion(p)) return false;
      if (except !== "duration" && !matchDuration(p)) return false;
      if (except !== "instructor" && !matchInstructor(p)) return false;
      if (except !== "schedule" && !matchSchedule(p)) return false;
      return true;
    });

  // Counts for each group (respect other filters)
  const typeCounts = useMemo(() => {
    const base = applyExcept("type");
    const c: Record<string, number> = { all: base.length };
    for (const t of PROGRAM_TYPES) c[t] = base.filter((p) => p.type === t).length;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    q,
    sel.categories.join(","),
    sel.delivery.join(","),
    sel.languages.join(","),
    sel.levels.join(","),
    sel.statuses.join(","),
    sel.certificates.join(","),
    sel.regions.join(","),
    sel.durations.join(","),
    sel.instructors.join(","),
    sel.schedule,
  ]);

  const countBy = (except: Group, fn: (p: Program) => string | string[]): Record<string, number> => {
    const base = applyExcept(except);
    const c: Record<string, number> = {};
    for (const p of base) {
      const v = fn(p);
      const values = Array.isArray(v) ? v : [v];
      for (const val of values) c[val] = (c[val] ?? 0) + 1;
    }
    return c;
  };

  // Depend on full sel object via stringified keys so counts refresh reactively.
  const depsKey =
    q +
    "|" +
    sel.types.join(",") +
    "|" +
    sel.categories.join(",") +
    "|" +
    sel.delivery.join(",") +
    "|" +
    sel.languages.join(",") +
    "|" +
    sel.levels.join(",") +
    "|" +
    sel.statuses.join(",") +
    "|" +
    sel.certificates.join(",") +
    "|" +
    sel.regions.join(",") +
    "|" +
    sel.durations.join(",") +
    "|" +
    sel.instructors.join(",") +
    "|" +
    sel.schedule;

  const categoryCounts = useMemo(() => countBy("category", (p) => categorySlug(p.category)), [depsKey]);
  const deliveryCounts = useMemo(() => countBy("delivery", (p) => deliveryModeSlug(p)), [depsKey]);
  const languageCounts = useMemo(() => countBy("language", (p) => languageSlug(p.language)), [depsKey]);
  const levelCounts = useMemo(() => countBy("level", (p) => levelSlugsFor(p)), [depsKey]);
  const statusCounts = useMemo(() => countBy("status", (p) => statusFilterSlug(p)), [depsKey]);
  const certificateCounts = useMemo(() => countBy("certificate", (p) => certificateSlugsFor(p)), [depsKey]);
  const regionCounts = useMemo(() => countBy("region", (p) => regionSlug(p)), [depsKey]);
  const durationCounts = useMemo(() => countBy("duration", (p) => durationSlug(p)), [depsKey]);
  const instructorCounts = useMemo(
    () => countBy("instructor", (p) => instructorSlug(p.instructor)),
    [depsKey],
  );

  // Fully filtered list (all filters applied)
  const filtered = useMemo(() => {
    const list = applyExcept(undefined);
    return [...list].sort(sorters[sortKey]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, sortKey]);

  const perPage = 9;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageNum = Math.min(Math.max(1, Number(search.page ?? 1)), totalPages);
  const start = (pageNum - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);

  // ------- URL mutation helpers -------
  function patchSearch(patch: Partial<ProgramsSearch>) {
    navigate({
      to: ".",
      search: (prev: ProgramsSearch) => ({ ...prev, ...patch }),
      replace: false,
    });
  }

  function toggle(group: GroupKey, value: string) {
    if (group === "types") {
      const set = new Set(sel.types);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      const arr = [...set];
      patchSearch({ type: "", types: csv(arr), page: 1 });
      return;
    }
    const currentArr = (sel as Record<string, string[] | string>)[group] as string[];
    const set = new Set(currentArr);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    patchSearch({ [group]: csv([...set]), page: 1 } as Partial<ProgramsSearch>);
  }

  function selectTabKey(key: string) {
    if (key === "all") patchSearch({ type: "", types: "", page: 1 });
    else patchSearch({ type: "", types: key, page: 1 });
  }

  function setSchedule(value: string) {
    patchSearch({ schedule: value === "any" ? "" : value, page: 1 });
  }

  function resetAll() {
    setQLocal("");
    setJustReset(true);
    navigate({ to: ".", search: () => ({ ...EMPTY_SEARCH }) });
    window.setTimeout(() => setJustReset(false), 1500);
  }

  const [justReset, setJustReset] = useState(false);

  const tabs = [
    { key: "all", label: "All Programs", count: typeCounts.all },
    { key: "training", label: "Training", count: typeCounts.training ?? 0 },
    { key: "webinar", label: "Webinar", count: typeCounts.webinar ?? 0 },
    { key: "workshop", label: "Workshop", count: typeCounts.workshop ?? 0 },
    { key: "certification", label: "Certification", count: typeCounts.certification ?? 0 },
    { key: "self-paced", label: "Self-paced", count: typeCounts["self-paced"] ?? 0 },
  ];

  const sidebarActive: AcademyActive =
    activeKey === "all"
      ? "all-programs"
      : activeKey === "multi"
        ? "programs-multi"
        : activeKey;

  const tabsActiveKey = activeKey === "multi" ? "" : activeKey;

  // ------- Chips -------
  type Chip = { group: GroupKey; value: string; label: string };
  const chips: Chip[] = [
    ...sel.types.map((v) => ({
      group: "types" as const,
      value: v,
      label: PROGRAM_TYPE_LABEL[v as ProgramType],
    })),
    ...chipsFrom("categories", sel.categories, CATEGORIES),
    ...chipsFrom("delivery", sel.delivery, DELIVERY_MODES),
    ...chipsFrom("languages", sel.languages, LANGUAGES),
    ...chipsFrom("levels", sel.levels, LEVELS),
    ...chipsFrom("statuses", sel.statuses, STATUSES),
    ...(sel.schedule
      ? [
          {
            group: "schedule" as const,
            value: sel.schedule,
            label: SCHEDULES.find((s) => s.value === sel.schedule)?.label ?? sel.schedule,
          },
        ]
      : []),
    ...chipsFrom("certificates", sel.certificates, CERTIFICATES),
    ...chipsFrom("regions", sel.regions, REGIONS),
    ...chipsFrom("durations", sel.durations, DURATIONS),
    ...chipsFrom("instructors", sel.instructors, INSTRUCTOR_OPTS),
  ];
  const activeFilterCount = chips.length + (q ? 1 : 0);

  const filterPanel = (
    <FilterPanelUI
      qLocal={qLocal}
      setQLocal={setQLocal}
      typeCounts={typeCounts}
      counts={{
        categories: categoryCounts,
        delivery: deliveryCounts,
        languages: languageCounts,
        levels: levelCounts,
        statuses: statusCounts,
        certificates: certificateCounts,
        regions: regionCounts,
        durations: durationCounts,
        instructors: instructorCounts,
      }}
      sel={sel}
      onToggle={toggle}
      onSchedule={setSchedule}
      onReset={resetAll}
      resetConfirm={justReset}
      activeCount={activeFilterCount}
    />
  );

  return (
    <AcademyShell active={sidebarActive} aside={filterPanel}>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav
          className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
          aria-label="Breadcrumb"
        >
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">
            Academy
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          {activeKey === "all" ? (
            <span className="font-semibold text-navy">All Programs</span>
          ) : (
            <>
              <Link
                to="/academy/programs"
                className="font-medium text-foreground/70 hover:text-marine"
              >
                Programs
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-semibold text-navy">{meta.crumb}</span>
            </>
          )}
        </nav>

        {/* Header */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-xl">
            <h1 className="font-display text-3xl font-extrabold text-navy">{meta.heading}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {meta.description}
            </p>
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-3 xl:max-w-2xl xl:justify-end">
            <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-soft">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="search"
                value={qLocal}
                onChange={(e) => setQLocal(e.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search programs, topics, instructors..."
                aria-label="Search programs"
              />
              {qLocal && (
                <button
                  type="button"
                  onClick={() => setQLocal("")}
                  className="text-muted-foreground hover:text-navy"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <div className="relative">
              <select
                value={sortKey}
                onChange={(e) => patchSearch({ sort: e.target.value, page: 1 })}
                className="appearance-none rounded-xl border border-border bg-card px-4 py-3 pr-9 text-sm font-semibold text-navy shadow-soft transition-colors hover:border-marine/40"
                aria-label="Sort programs"
              >
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="a-z">Sort: A–Z</option>
                <option value="z-a">Sort: Z–A</option>
                <option value="popular">Sort: Most Popular</option>
                <option value="rating">Sort: Highest Rated</option>
                <option value="participants">Sort: Most Participants</option>
                <option value="closing-soon">Sort: Closing Soon</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <ProgramTypeTabs tabs={tabs} activeKey={tabsActiveKey} onSelect={selectTabKey} />

        {/* Chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Active filters:
            </span>
            {chips.map((c) => (
              <button
                key={`${c.group}-${c.value}`}
                onClick={() => (c.group === "schedule" ? setSchedule("any") : toggle(c.group, c.value))}
                className="inline-flex items-center gap-1 rounded-full bg-marine/10 px-3 py-1 text-xs font-semibold text-marine transition-colors hover:bg-marine/20"
                aria-label={`Remove ${GROUP_LABEL[c.group]} filter ${c.label}`}
              >
                <span className="text-muted-foreground">{GROUP_LABEL[c.group]}:</span> {c.label}
                <X className="h-3 w-3" />
              </button>
            ))}
            <button
              onClick={resetAll}
              className="text-xs font-semibold text-muted-foreground underline hover:text-marine"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Result count */}
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {filtered.length === 0
            ? q
              ? `No programs match “${qLocal}”.`
              : "No programs match your selected filters."
            : `Showing ${start + 1}–${Math.min(start + perPage, filtered.length)} of ${filtered.length} programs`}
        </p>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <h3 className="font-display text-lg font-bold text-navy">
              No programs match your selected filters.
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Try removing a filter chip, clearing your search, or exploring the full catalogue.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={resetAll}
                className="rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90"
              >
                Clear All Filters
              </button>
              <Link
                to="/academy/programs"
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-navy transition-colors hover:border-marine/40"
              >
                View All Programs
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
            {visible.map((p) => (
              <ProgramCard key={p.id} p={p} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              disabled={pageNum <= 1}
              onClick={() => patchSearch({ page: pageNum - 1 })}
              className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-navy transition-colors hover:border-marine/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="px-3 text-sm text-muted-foreground">
              Page {pageNum} of {totalPages}
            </span>
            <button
              disabled={pageNum >= totalPages}
              onClick={() => patchSearch({ page: pageNum + 1 })}
              className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-navy transition-colors hover:border-marine/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {(selectedTypes.length === 0 || selectedTypes.includes("training")) && (
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
                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-hover md:w-auto"
              >
                Request a Training
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        )}
      </div>
    </AcademyShell>
  );
}

function chipsFrom(
  group: GroupKey,
  selected: string[],
  opts: Opt[],
): { group: GroupKey; value: string; label: string }[] {
  return selected.map((v) => ({
    group,
    value: v,
    label: opts.find((o) => o.value === v)?.label ?? v,
  }));
}

/* ============================================================
 *  Filter panel (aside)
 * ============================================================ */

function FilterPanelUI({
  qLocal,
  setQLocal,
  typeCounts,
  counts,
  sel,
  onToggle,
  onSchedule,
  onReset,
  resetConfirm,
  activeCount,
}: {
  qLocal: string;
  setQLocal: (v: string) => void;
  typeCounts: Record<string, number>;
  counts: {
    categories: Record<string, number>;
    delivery: Record<string, number>;
    languages: Record<string, number>;
    levels: Record<string, number>;
    statuses: Record<string, number>;
    certificates: Record<string, number>;
    regions: Record<string, number>;
    durations: Record<string, number>;
    instructors: Record<string, number>;
  };
  sel: {
    types: string[];
    categories: string[];
    delivery: string[];
    languages: string[];
    levels: string[];
    statuses: string[];
    certificates: string[];
    regions: string[];
    durations: string[];
    instructors: string[];
    schedule: string;
  };
  onToggle: (group: GroupKey, value: string) => void;
  onSchedule: (value: string) => void;
  onReset: () => void;
  resetConfirm: boolean;
  activeCount: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FilterIcon className="h-4 w-4 text-marine" />
          <h3 className="font-display text-base font-bold text-navy">Filter Programs</h3>
          {activeCount > 0 && (
            <span className="rounded-full bg-marine/10 px-2 py-0.5 text-[0.65rem] font-bold text-marine">
              {activeCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 text-xs font-semibold text-marine hover:text-navy"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      {resetConfirm && (
        <div className="mb-3 rounded-lg bg-marine/10 px-3 py-2 text-xs font-semibold text-marine">
          Filters reset
        </div>
      )}

      <div className="space-y-5">
        {/* Search inside filter panel — syncs with header via qLocal */}
        <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            placeholder="Search programs..."
            aria-label="Search programs (filter panel)"
          />
        </label>

        <Group label="Program Type" defaultOpen>
          {PROGRAM_TYPES.map((t) => (
            <Check
              key={t}
              label={PROGRAM_TYPE_LABEL[t]}
              count={typeCounts[t] ?? 0}
              checked={sel.types.includes(t)}
              onChange={() => onToggle("types", t)}
            />
          ))}
        </Group>

        <Group label="Training Category" defaultOpen>
          {CATEGORIES.map((o) => (
            <Check
              key={o.value}
              label={o.label}
              count={counts.categories[o.value] ?? 0}
              checked={sel.categories.includes(o.value)}
              onChange={() => onToggle("categories", o.value)}
            />
          ))}
        </Group>

        <Group label="Delivery Mode">
          {DELIVERY_MODES.map((o) => (
            <Check
              key={o.value}
              label={o.label}
              count={counts.delivery[o.value] ?? 0}
              checked={sel.delivery.includes(o.value)}
              onChange={() => onToggle("delivery", o.value)}
            />
          ))}
        </Group>

        <Group label="Language">
          {LANGUAGES.map((o) => (
            <Check
              key={o.value}
              label={o.label}
              count={counts.languages[o.value] ?? 0}
              checked={sel.languages.includes(o.value)}
              onChange={() => onToggle("languages", o.value)}
            />
          ))}
        </Group>

        <Group label="Course Level">
          {LEVELS.map((o) => (
            <Check
              key={o.value}
              label={o.label}
              count={counts.levels[o.value] ?? 0}
              checked={sel.levels.includes(o.value)}
              onChange={() => onToggle("levels", o.value)}
            />
          ))}
        </Group>

        <Group label="Programme Status">
          {STATUSES.map((o) => (
            <Check
              key={o.value}
              label={o.label}
              count={counts.statuses[o.value] ?? 0}
              checked={sel.statuses.includes(o.value)}
              onChange={() => onToggle("statuses", o.value)}
            />
          ))}
        </Group>

        <Group label="Schedule">
          <div className="space-y-1">
            {SCHEDULES.map((o) => {
              const active = (sel.schedule || "any") === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onSchedule(o.value)}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    active
                      ? "bg-marine/10 font-semibold text-marine"
                      : "text-foreground/80 hover:bg-muted hover:text-marine"
                  }`}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${active ? "bg-marine" : "bg-muted-foreground/40"}`}
                  />
                  <span className="flex-1">{o.label}</span>
                </button>
              );
            })}
          </div>
        </Group>

        <Group label="Certificate">
          {CERTIFICATES.map((o) => (
            <Check
              key={o.value}
              label={o.label}
              count={counts.certificates[o.value] ?? 0}
              checked={sel.certificates.includes(o.value)}
              onChange={() => onToggle("certificates", o.value)}
            />
          ))}
        </Group>

        <Group label="Instructor / Expert">
          {INSTRUCTOR_OPTS.map((o) => (
            <Check
              key={o.value}
              label={o.label}
              count={counts.instructors[o.value] ?? 0}
              checked={sel.instructors.includes(o.value)}
              onChange={() => onToggle("instructors", o.value)}
            />
          ))}
        </Group>

        <Group label="Country / Region">
          {REGIONS.map((o) => (
            <Check
              key={o.value}
              label={o.label}
              count={counts.regions[o.value] ?? 0}
              checked={sel.regions.includes(o.value)}
              onChange={() => onToggle("regions", o.value)}
            />
          ))}
        </Group>

        <Group label="Duration">
          {DURATIONS.map((o) => (
            <Check
              key={o.value}
              label={o.label}
              count={counts.durations[o.value] ?? 0}
              checked={sel.durations.includes(o.value)}
              onChange={() => onToggle("durations", o.value)}
            />
          ))}
        </Group>
      </div>
    </div>
  );
}

/* ---------------- Collapsible filter group ---------------- */

function Group({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-2 flex w-full items-center justify-between text-xs font-bold uppercase tracking-wide text-foreground/70 hover:text-marine"
      >
        {label}
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

/* ---------------- Controlled checkbox row with count ---------------- */

function Check({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  const disabled = !checked && (count ?? 0) === 0;
  return (
    <label
      className={`flex items-center gap-2.5 rounded-md px-1 py-1 text-sm transition-colors ${
        disabled
          ? "cursor-not-allowed text-foreground/40"
          : "cursor-pointer text-foreground/80 hover:text-marine"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${
          checked
            ? "border-marine bg-marine text-white"
            : disabled
              ? "border-border bg-muted"
              : "border-border bg-background peer-focus-visible:ring-2 peer-focus-visible:ring-marine"
        }`}
      >
        {checked && <Check2 />}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {count != null && <span className="text-xs text-muted-foreground">({count})</span>}
    </label>
  );
}

function Check2() {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
      <path fill="none" stroke="currentColor" strokeWidth="2" d="M2 6l3 3 5-6" />
    </svg>
  );
}

/* ============================================================
 *  Program card
 * ============================================================ */

function ProgramCard({ p }: { p: Program }) {
  return (
    <Link
      to={p.href as never}
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-hover"
    >
      <div className="relative h-36 overflow-hidden">
        <img
          src={p.image}
          alt={p.title}
          loading="lazy"
          width={768}
          height={512}
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
        />
        <span className="absolute left-2 top-2">
          <StatusBadge label={p.status} />
        </span>
        <span className="absolute right-2 top-2 rounded-md bg-navy/85 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-navy-foreground">
          {PROGRAM_TYPE_LABEL[p.type]}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="line-clamp-2 min-h-[2.5rem] font-display text-sm font-bold text-navy">
          {p.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <MetaItem icon={Clock}>{p.duration}</MetaItem>
          <MetaItem icon={BarChart3}>{p.level}</MetaItem>
          <MetaItem icon={Globe}>{p.language}</MetaItem>
          <MetaItem icon={MapPin}>{p.country}</MetaItem>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-marine/10 px-2.5 py-0.5 text-[0.65rem] font-semibold text-marine">
            {p.category}
          </span>
          <span className="text-[0.7rem] text-muted-foreground">by {p.instructor}</span>
        </div>
        <div className="mt-auto flex items-center justify-between pt-3">
          <Rating value={p.rating} reviews={p.reviews} />
          <span className="text-[0.7rem] text-muted-foreground">
            {p.participants.toLocaleString()} participants
          </span>
        </div>
      </div>
    </Link>
  );
}
