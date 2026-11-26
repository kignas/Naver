#!/usr/bin/env bash
# Publish (or repair) a Navereat release. Idempotent by design:
#   * release exists  -> assets are re-uploaded with --clobber
#   * release is draft -> it is published, then the assets are uploaded
#   * release missing  -> created on TARGET_SHA with both APKs attached
# GitHub API failures are retried with exponential backoff (5 s -> 120 s,
# 10 attempts by default) because releases occasionally answer HTTP 500 for
# minutes while the rest of the API is healthy.
#
# Env:
#   GH_TOKEN, GH_REPO    provided by the workflow (${{ github.token }})
#   TAG                  release tag, e.g. v1.0.58                    (required)
#   FILES                space separated APK paths                    (required)
#   TITLE                release title            (default "Navereat $TAG")
#   NOTES_FILE           markdown notes file                          (optional)
#   TARGET_SHA           commit for a tag that does not exist yet     (optional)
#   SIMULATE_FAILURES    aim the first N attempts at a bogus host     (default 0)
#   MAX_ATTEMPTS         default 10
#   INITIAL_DELAY        default 5 seconds
#   MAX_DELAY            default 120 seconds
#
# Only HTTP status codes and attempt numbers are printed; the token stays in
# gh's own environment and is never echoed.
set -uo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GH_REPO:?GH_REPO is required}"
: "${TAG:?TAG is required}"
: "${FILES:?FILES is required}"

TITLE="${TITLE:-Navereat $TAG}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-10}"
delay="${INITIAL_DELAY:-5}"
max_delay="${MAX_DELAY:-120}"
simulate="${SIMULATE_FAILURES:-0}"

release_status() {
  local out
  out=$(gh api --include "repos/$GH_REPO/releases/tags/$TAG" 2>/dev/null) || true
  printf '%s\n' "$out" | head -1 | awk '{print $2}'
}

is_draft() {
  local draft
  draft=$(gh api "repos/$GH_REPO/releases/tags/$TAG" --jq '.isDraft' 2>/dev/null) || return 1
  [ "$draft" = "true" ]
}

backoff() {
  [ "$attempt" -ge "$MAX_ATTEMPTS" ] && return 0
  echo "sleeping ${delay}s before the next attempt"
  sleep "$delay"
  delay=$(( delay * 2 > max_delay ? max_delay : delay * 2 ))
}

attempt=0
while [ "$attempt" -lt "$MAX_ATTEMPTS" ]; do
  attempt=$((attempt + 1))

  if [ "$attempt" -le "$simulate" ]; then
    export GH_HOST="invalid.example.invalid"
    echo "attempt $attempt/$MAX_ATTEMPTS: simulating an unreachable API (GH_HOST=invalid.example.invalid)"
  else
    unset GH_HOST 2>/dev/null || true
  fi

  status=$(release_status)
  echo "attempt $attempt/$MAX_ATTEMPTS: GET /releases/tags/$TAG -> ${status:-no response}"

  case "$status" in
    200)
      if is_draft; then
        echo "release exists as a draft; publishing it"
        if ! gh release edit "$TAG" --draft=false --title "$TITLE" >/dev/null 2>&1; then
          echo "draft publish failed"
          backoff
          continue
        fi
      fi
      # shellcheck disable=SC2086 # FILES is a deliberate word list
      if gh release upload "$TAG" $FILES --clobber >/dev/null 2>&1; then
        echo "assets uploaded (overwritten) on the existing release $TAG"
        if [ -n "${NOTES_FILE:-}" ] && [ -f "$NOTES_FILE" ]; then
          gh release edit "$TAG" --title "$TITLE" --notes-file "$NOTES_FILE" >/dev/null 2>&1 \
            || echo "notes update failed; assets are published"
        fi
        exit 0
      fi
      echo "asset upload failed"
      backoff
      ;;
    404)
      create_args=(release create "$TAG" --title "$TITLE")
      if [ -n "${TARGET_SHA:-}" ]; then
        create_args+=(--target "$TARGET_SHA")
      fi
      if [ -n "${NOTES_FILE:-}" ] && [ -f "$NOTES_FILE" ]; then
        create_args+=(--notes-file "$NOTES_FILE")
      else
        create_args+=(--notes "Navereat $TAG")
      fi
      # shellcheck disable=SC2086 # FILES is a deliberate word list
      if gh "${create_args[@]}" $FILES >/dev/null 2>&1; then
        echo "release created for $TAG with the APKs attached"
        exit 0
      fi
      # A create that failed after the release row was written lands on the 200
      # path next time round, which is why the loop re-reads the status.
      echo "release create failed"
      backoff
      ;;
    *)
      echo "transient API error"
      backoff
      ;;
  esac
done

echo "::error title=Release publish failed::Gave up after $MAX_ATTEMPTS attempts. The APKs are in this run's artifacts (Navereat-apks): ${RUN_URL:-this run} — download them with: gh run download ${RUN_ID:-<run id>} -n Navereat-apks"
exit 1
