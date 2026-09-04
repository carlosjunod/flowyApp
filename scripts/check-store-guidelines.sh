#!/usr/bin/env bash
# App Store Review Guideline 3.1.3: outside the US storefront an app may not
# steer users to a purchase method other than in-app purchase. This scans the
# user-visible copy of the billing surfaces for the phrases that get apps
# rejected.
#
# Comments are stripped before scanning: a comment explaining the rule is not
# copy a reviewer sees. Only the billing surfaces are scanned, because the rest
# of the app legitimately says things like "discount" about a scanned receipt.
#
# 3.1.3(b) permits telling an existing subscriber where their subscription is
# billed — that reports status, it does not offer another way to buy. The one
# such string is allowlisted below by exact match.
set -uo pipefail
cd "$(dirname "$0")/.."

FILES=("app/(app)/paywall.tsx" src/components/billing/*.tsx src/lib/plans.ts)
BANNED='tryflowy\.app|web price|discount|% off|cheaper|save 2[0-9]%|buy on|visit our site|in your browser'
ALLOWED="Billed on the web"

status=0
for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  hits=$(sed -E 's://.*::' "$f" | grep -nEi "$BANNED" | grep -vF "$ALLOWED" || true)
  if [ -n "$hits" ]; then
    echo "$hits" | sed "s|^|$f:|"
    status=1
  fi
done

if [ "$status" -ne 0 ]; then
  echo ""
  echo "FAIL: steering copy found in a billing surface (Guideline 3.1.3)."
  exit 1
fi
echo "OK: no steering copy in the billing surfaces."
