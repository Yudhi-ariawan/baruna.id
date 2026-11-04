// Shared (client + server) constants for Master Course cover images.
import { supabase } from "@/integrations/supabase/client";

export const PROGRAM_COVER_BUCKET = "knowledge-module-covers";
export const PROGRAM_COVER_MAX_BYTES = 2 * 1024 * 1024;
export const PROGRAM_COVER_ACCEPT = "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

/** Public URL of an uploaded cover path, or null. */
export function programCoverUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(PROGRAM_COVER_BUCKET).getPublicUrl(path).data.publicUrl;
}
