#!/usr/bin/env bash
set -euo pipefail

# Each generator serializes its own runs and owns distinct output files.
# Rebase tolerates other generators and human pushes; never force-push or add -A.
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add -- "$@"
if git diff --cached --quiet; then
  echo 'Profile assets are already current.'
  exit 0
fi
git commit -m "Refresh ${PROFILE_ASSET_KIND:-profile} assets"
for attempt in 1 2 3; do
  git pull --rebase origin "${PROFILE_BRANCH:?Missing default branch}"
  if git push origin "HEAD:${PROFILE_BRANCH}"; then
    exit 0
  fi
done
echo 'Unable to publish after three attempts; no history was overwritten.' >&2
exit 1
