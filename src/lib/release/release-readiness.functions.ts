// Temporary read-only page /kesiapanrilis for reporting to supervisors: shows
// dokumen/KESIAPAN_RILIS.md behind a username and password. The credentials live
// in the server environment (RELEASE_PAGE_USER, RELEASE_PAGE_PASSWORD; .env locally,
// project secrets on the host), never in the repository. The document lists open
// security gaps, so its text only leaves the server after the check passes and is
// never part of the browser bundle. To be removed with the page.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parseReadiness, type ReadinessBoard } from "./readiness-board";
import { toCurriculumDocs, type CurriculumDoc } from "./curriculum-outputs";

export const getReleaseReadiness = createServerFn({ method: "POST" })
  .validator((input) =>
    z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ markdown: string; board: ReadinessBoard; outputs: CurriculumDoc[] }> => {
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
    // Curriculum outputs (dokumen/output/bulan-N/*.md); read here, after the check, like the report.
    const loaders = import.meta.glob("../../../dokumen/output/bulan-*/*.md", { query: "?raw", import: "default" }) as Record<
      string,
      () => Promise<string>
    >;
    const files: Record<string, string> = {};
    await Promise.all(Object.entries(loaders).map(async ([path, load]) => { files[path] = await load(); }));
    return { markdown, board: parseReadiness(markdown), outputs: toCurriculumDocs(files) };
  });
