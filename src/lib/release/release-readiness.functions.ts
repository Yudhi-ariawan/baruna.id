// Temporary read-only page /kesiapanrilis for reporting to supervisors: shows
// dokumen/KESIAPAN_RILIS.md behind a username and password. The credentials live
// in the server environment (RELEASE_PAGE_USER, RELEASE_PAGE_PASSWORD; .env locally,
// project secrets on the host), never in the repository. The document lists open
// security gaps, so its text only leaves the server after the check passes and is
// never part of the browser bundle. To be removed with the page.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parseReadiness, type ReadinessBoard } from "./readiness-board";

export const getReleaseReadiness = createServerFn({ method: "POST" })
  .validator((input) =>
    z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ markdown: string; board: ReadinessBoard }> => {
    const user = process.env.RELEASE_PAGE_USER;
    const pass = process.env.RELEASE_PAGE_PASSWORD;
    if (!user || !pass) {
      throw new Error("Halaman ini belum diaktifkan di server (RELEASE_PAGE_USER dan RELEASE_PAGE_PASSWORD belum diatur).");
    }
    const { createHash, timingSafeEqual } = await import("node:crypto");
    const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();
    const ok = timingSafeEqual(digest(data.username), digest(user)) && timingSafeEqual(digest(data.password), digest(pass));
    if (!ok) {
      // Slows down guessing; the page is temporary and not linked anywhere.
      await new Promise((r) => setTimeout(r, 800));
      throw new Error("Username atau password salah.");
    }
    const { default: markdown } = await import("../../../dokumen/KESIAPAN_RILIS.md?raw");
    return { markdown, board: parseReadiness(markdown) };
  });
