#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || -z "$1" ]]; then
  echo "Usage: $0 \"commit message\"" >&2
  exit 2
fi

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "Refusing backup: current branch must be main." >&2
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Refusing backup: remote origin is not configured." >&2
  exit 1
fi

if ! git check-ignore -q .env; then
  echo "Refusing backup: .env is not ignored." >&2
  exit 1
fi

node node_modules/vite/bin/vite.js build
git add --all

if git diff --cached --quiet; then
  echo "No changes to commit."
  exit 0
fi

if git diff --cached --name-only | grep -Eq '(^|/)(\.env($|\.)|.*\.(pem|key|p12|pfx)$)'; then
  echo "Refusing backup: a secret-bearing file appears to be staged." >&2
  exit 1
fi

git commit -m "$1"
git push origin main
