#!/usr/bin/env bash
# Re-sign the installed Flowy bundle on the booted iOS Simulator with working
# shared-keychain entitlements, and patch the extension's Info.plist so its
# API_BASE_URL matches EXPO_PUBLIC_API_BASE_URL from .env.
#
# Why this exists:
#   `npx expo run:ios` on a Simulator passes flags to xcodebuild that strip
#   the keychain-access-groups and application-groups entitlements from the
#   installed binaries, AND it can bake a stale API_BASE_URL into the
#   extension's Info.plist if .env was different at prebuild time.
#
# Usage:
#   ./scripts/resign-sim.sh
#
# After running:
#   1. Force-quit Flowy in the Simulator (swipe it away in the app switcher).
#   2. Relaunch Flowy.
#   3. Share something.

set -euo pipefail

BUNDLE_ID="app.tryflowy.client"
APP_GROUP="group.app.tryflowy"

APP_PATH="$(xcrun simctl get_app_container booted "$BUNDLE_ID" 2>/dev/null || true)"
if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "error: $BUNDLE_ID is not installed on the booted simulator." >&2
  echo "       Run \`npx expo run:ios\` first, then re-run this script." >&2
  exit 1
fi

# Load .env so we can sync API_BASE_URL into the Info.plist.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
API_BASE_URL=""
if [[ -f "$ENV_FILE" ]]; then
  API_BASE_URL="$(grep -E '^EXPO_PUBLIC_API_BASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi

EXT="$APP_PATH/PlugIns/ShareExtension.appex"

# Patch extension Info.plist so the extension hits the same API as the JS side.
if [[ -n "$API_BASE_URL" && -f "$EXT/Info.plist" ]]; then
  current="$(/usr/libexec/PlistBuddy -c "Print :API_BASE_URL" "$EXT/Info.plist" 2>/dev/null || echo "")"
  if [[ "$current" != "$API_BASE_URL" ]]; then
    echo "Syncing extension API_BASE_URL: $current -> $API_BASE_URL"
    /usr/libexec/PlistBuddy -c "Set :API_BASE_URL $API_BASE_URL" "$EXT/Info.plist" \
      || /usr/libexec/PlistBuddy -c "Add :API_BASE_URL string $API_BASE_URL" "$EXT/Info.plist"
  fi
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/sim.entitlements" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array><string>$APP_GROUP</string></array>
  <key>keychain-access-groups</key>
  <array><string>$APP_GROUP</string></array>
</dict>
</plist>
PLIST

if [[ -d "$EXT" ]]; then
  echo "Re-signing $EXT"
  codesign -f -s - --entitlements "$TMP/sim.entitlements" "$EXT"
fi

echo "Re-signing $APP_PATH"
codesign -f -s - --entitlements "$TMP/sim.entitlements" "$APP_PATH"

echo
echo "Done. Force-quit Flowy in the Simulator, relaunch, and try sharing."
