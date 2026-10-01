#!/bin/sh
# Vercel Ignored Build Step (vercel.json "ignoreCommand"): exit 0 skips the build, exit 1 builds.
# Skips when the commit message has [skip deploy], or when everything since the last successful
# deployment is docs (docs/**, *.md). docs/changelog.md is the exception: /changelog reads it.

case "$VERCEL_GIT_COMMIT_MESSAGE" in
  *"[skip deploy]"*) echo "Skip: [skip deploy] in the commit message."; exit 0 ;;
esac

prev="$VERCEL_GIT_PREVIOUS_SHA"
if [ -z "$prev" ] || ! git cat-file -e "$prev^{commit}" 2>/dev/null; then
  echo "Build: no previous deployment in the clone to compare with."
  exit 1
fi

changed=$(git diff --name-only "$prev" HEAD) || exit 1
if [ -z "$changed" ]; then
  echo "Build: nothing changed since $prev (redeploy)."
  exit 1
fi
if echo "$changed" | grep -qx "docs/changelog.md"; then
  echo "Build: docs/changelog.md changed."
  exit 1
fi
if echo "$changed" | grep -vE '^docs/|\.md$' | grep -q .; then
  echo "Build: code changed."
  exit 1
fi

echo "Skip: only docs changed since $prev."
exit 0
