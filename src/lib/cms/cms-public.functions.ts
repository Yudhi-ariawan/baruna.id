// Public side of the Dynamic CMS (migration 20261118010000): published pages, the
// active navigation menu, open forms, and sending a form. Visitors read the public
// views only; before the migration (or with no content) the readers return null and
// every page keeps its built-in content.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cmsErrorText } from "./cms-errors";
import type { CmsPublicForm, CmsPublicMenuItem, CmsPublicPage } from "./cms-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
const slug = z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

async function publicDb(): Promise<Db> {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

/** A published page by its address, or null (none, or the migration has not run). */
export const getPublicCmsPage = createServerFn({ method: "GET" })
  .validator((d) => z.object({ slug }).parse(d))
  .handler(async ({ data }): Promise<CmsPublicPage | null> => {
    try {
      const { data: row, error } = await (await publicDb()).from("cms_pages_public_v").select("*").eq("slug", data.slug).maybeSingle();
      return error ? null : ((row as CmsPublicPage | null) ?? null);
    } catch {
      return null;
    }
  });

/** Active menu items (flat, ordered); empty when no CMS menu is published yet. */
export const getPublicCmsMenu = createServerFn({ method: "GET" }).handler(async (): Promise<CmsPublicMenuItem[]> => {
  try {
    const { data, error } = await (await publicDb()).from("cms_menu_public_v").select("*").order("sort_order");
    return error ? [] : ((data as CmsPublicMenuItem[]) ?? []);
  } catch {
    return [];
  }
});

/** Open forms by address (several for a page's form blocks). */
export const getPublicCmsForms = createServerFn({ method: "GET" })
  .validator((d) => z.object({ slugs: z.array(slug).min(1).max(30) }).parse(d))
  .handler(async ({ data }): Promise<CmsPublicForm[]> => {
    try {
      const { data: rows, error } = await (await publicDb()).from("cms_forms_public_v").select("*").in("slug", data.slugs);
      return error ? [] : ((rows as CmsPublicForm[]) ?? []);
    } catch {
      return [];
    }
  });

export const submitCmsForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ slug, data: z.record(z.unknown()) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: idRow, error } = await (context.supabase as Db).rpc("cms_form_submit", { _slug: data.slug, _data: data.data });
    if (error) throw new Error(cmsErrorText(error.message));
    return { id: idRow as string };
  });

export const getMyCmsFormStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ slug }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: s, error } = await (context.supabase as Db).rpc("cms_form_my_status", { _slug: data.slug });
    if (error) throw new Error(cmsErrorText(error.message));
    return s as { limit: number; sentToday: number; lastSentAt: string | null };
  });
