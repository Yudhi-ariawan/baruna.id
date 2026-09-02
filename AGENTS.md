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
