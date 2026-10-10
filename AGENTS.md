<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## GitHub backup workflow

- The canonical branch is `main` and the canonical remote is `origin`.
- After completing and validating any user-requested feature, bug fix, or file
  change, create a focused Git commit and push it with `git push origin main`.
- Never commit `.env`, credentials, generated build output, dependency folders,
  browser-test screenshots, or other ignored files.
- Before committing, inspect `git status` and confirm no secret-bearing file is
  staged. Use `scripts/backup-to-github.sh "<descriptive commit message>"` for
  the standard build, commit, and push sequence.

## Long-Term Scalability & Engineering Standards (Responsible Vibe Coding)

All AI agents and developers working on BARUNA must strictly adhere to the following principles:

1. **Alignment with Official Business Process:**
   - Every feature implementation must align with the official 51-slide business process specification in `dokumen/` (especially Slide 35-41 for Experts, Slide 11-25 for Academy, Slide 26-34 for Knowledge Hub).
   - Detailed architectural standards are recorded in `dokumen/ENGINEERING_STANDARDS.md`.

2. **Database & Schema Integrity:**
   - Never alter database tables or columns on the fly without a corresponding timestamped SQL migration in `supabase/migrations/`.
   - Never hardcode arbitrary fallback IDs for production data entities.

3. **Security & Row Level Security (RLS):**
   - All user-facing tables must have RLS enabled with explicit policies.
   - Server functions must enforce identity checks using `requireSupabaseAuth` middleware (`context.userId`).
   - `supabaseAdmin` (service role) must only be used in server functions for legitimate system-level or admin operations, never exposed to client-side code or used as a shortcut to bypass user-level RLS.

4. **Component Modularization:**
   - Avoid bloated files exceeding 400-500 lines. Break presentation, dialogs, forms, and business logic into modular components under `src/components/` and `src/lib/`.

5. **Query Caching & High-Traffic Performance:**
   - Always configure appropriate `staleTime` and `gcTime` in `useQuery` for master/reference data to prevent unnecessary request spikes on Supabase.
   - In production, always use the Supabase Transaction Pooler (`port 6543 / Supavisor`) instead of direct connection.

6. **File Size & Storage Limits:**
   - Validate upload file sizes strictly: PDFs <= 10MB, Presentations (PPT/PPTX) <= 25MB, Images <= 2MB.
   - For document viewing, prefer direct signed URLs opened in new browser tabs for native rendering (PDF/images) or direct downloads for PPTs, rather than unstable third-party iframes.

7. **Strict Validation & Zero-Breakage Policy:**
   - Before completing any task, always verify with `npm run build` (which validates TypeScript, TanStack router routes, Vite bundle, and Nitro SSR output). Exit code must be 0.

## Pintasan Perintah User (Short Commands)

Jika user mengetik kode singkat **`cek bom waktu`** atau **`/audit`** di chat, AI wajib langsung menjalankan **Audit 360° Anti-Bom Waktu & Anti-Konflik** tanpa perlu dijelaskan panjang lebar, meliputi:
1. **Audit Celah Bug & Bom Waktu Masa Depan:** Memeriksa *edge cases*, *race condition / double-submit*, *null/undefined fallback*, karakter spesial pada query/URL, batas ukuran file, dan *cache invalidation*.
2. **Audit Konflik Database & RLS:** Memeriksa kesesuaian *unique index*, *foreign key*, *RLS policy*, tanda tangan argumen RPC PostgreSQL, serta sinkronisasi antar-tabel (`review_drafts`, `review_subjects`, `review_decisions`, `knowledge_resources`, `profiles`, `participant_biodata`, `experts`).
3. **Audit Lintas-Role & Zero-Breakage:** Memastikan alur `trainer`, `participant`, `registered_user`, dan `admin` berjalan mulus tanpa merusak fitur eksisting.
4. **Eksekusi Test Otomatis (`npm run audit:bom-waktu`):** Menjalankan `npx tsc --noEmit`, `npm run test:lifecycle`, `npm run test:kh-roles`, dan `npm run build` hingga seluruhnya lulus (`exit code 0`).
