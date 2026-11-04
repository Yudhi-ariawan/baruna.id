// Public catalog of Course Offerings published from Konsol Kurasi → Program Academy.
// Read with the publishable (anon) key: the same tables the course page reads.
// Only offerings that the admin screen manages are listed (legacy programs whose
// content lives in code already have their own static cards).
import { createServerFn } from "@tanstack/react-start";
import { PROGRAM_COVER_BUCKET } from "@/lib/academy/program-cover";
import type {
  DeliveryFormat,
  EnrolmentAccessRule,
  LearningModel,
  SelfPacedAccessModel,
} from "@/lib/learning/classification";

export type CatalogOffering = {
  offeringCode: string;
  offeringTitle: string;
  courseTitle: string;
  description: string | null;
  languageName: string | null;
  learningModel: LearningModel;
  deliveryFormat: DeliveryFormat;
  accessRule: EnrolmentAccessRule;
  selfPacedAccess: SelfPacedAccessModel | null;
  cohortName: string | null;
  year: number | null;
  openingDate: string | null;
  closingDate: string | null;
  enrolmentStartDate: string | null;
  enrolmentEndDate: string | null;
  moduleCount: number;
  totalHours: number;
  /** Approved Master Course cover (public URL), or null to use the page's default image. */
  coverUrl: string | null;
};

type Row = {
  id: string;
  offering_code: string;
  offering_title: string;
  cohort_name: string | null;
  year: number | null;
  status: string;
  learning_model: LearningModel;
  delivery_format: DeliveryFormat;
  enrolment_access_rule: EnrolmentAccessRule;
  self_paced_access_model: SelfPacedAccessModel | null;
  opening_date: string | null;
  closing_date: string | null;
  enrolment_start_date: string | null;
  enrolment_end_date: string | null;
  created_at: string;
  master_courses: {
    title: string;
    description: string | null;
    language: string | null;
    status: string;
    legacy_course_id: string | null;
    cover_path?: string | null;
    master_modules: { learning_hours: number | string | null }[] | null;
  } | null;
};

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listCatalogOfferings = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogOffering[]> => {
    const supabase = await publicClient();
    const selectOfferings = (withCover: boolean) =>
      supabase
        .from("course_offerings")
        .select(
          `id, offering_code, offering_title, cohort_name, year, status, learning_model, delivery_format, enrolment_access_rule, self_paced_access_model, opening_date, closing_date, enrolment_start_date, enrolment_end_date, created_at, master_courses(title, description, language, status, legacy_course_id,${withCover ? " cover_path," : ""} master_modules(learning_hours))`,
        )
        .eq("status", "published");
    const [first, flags, languages] = await Promise.all([
      selectOfferings(true),
      supabase.from("learning_feature_flags").select("course_offering_id, engine_version, enabled"),
      supabase.from("languages_taxonomy").select("code, name"),
    ]);
    // Before migration 20261104020000 the cover column does not exist yet: list without covers.
    const offerings = first.error && /cover_path/.test(first.error.message) ? await selectOfferings(false) : first;
    if (offerings.error) throw new Error(offerings.error.message);

    // Only offerings that run on the shared learning engine have a working course page.
    const shared = new Set(
      (flags.data ?? [])
        .filter((f) => f.enabled && f.engine_version === "shared_v1")
        .map((f) => f.course_offering_id),
    );
    const langName = new Map((languages.data ?? []).map((l) => [String(l.code).toLowerCase(), l.name as string]));

    return ((offerings.data ?? []) as unknown as Row[])
      .filter((o) => {
        const c = o.master_courses;
        return c && c.status === "active" && !c.legacy_course_id && shared.has(o.id);
      })
      // Soonest start first; offerings without a date (always open) last, newest first.
      .sort(
        (a, b) =>
          (a.opening_date ?? "9999-12-31").localeCompare(b.opening_date ?? "9999-12-31") ||
          b.created_at.localeCompare(a.created_at),
      )
      .map((o) => {
        const c = o.master_courses!;
        const modules = c.master_modules ?? [];
        const totalHours = modules.reduce((sum, m) => sum + (Number(m.learning_hours) || 0), 0);
        return {
          offeringCode: o.offering_code,
          offeringTitle: o.offering_title,
          courseTitle: c.title,
          description: c.description,
          languageName: c.language ? langName.get(c.language.toLowerCase()) ?? c.language : null,
          learningModel: o.learning_model,
          deliveryFormat: o.delivery_format,
          accessRule: o.enrolment_access_rule,
          selfPacedAccess: o.self_paced_access_model,
          cohortName: o.cohort_name,
          year: o.year,
          openingDate: o.opening_date,
          closingDate: o.closing_date,
          enrolmentStartDate: o.enrolment_start_date,
          enrolmentEndDate: o.enrolment_end_date,
          moduleCount: modules.length,
          totalHours: Math.round(totalHours * 10) / 10,
          coverUrl: c.cover_path
            ? supabase.storage.from(PROGRAM_COVER_BUCKET).getPublicUrl(c.cover_path).data.publicUrl
            : null,
        };
      });
  },
);
