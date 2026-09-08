#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
SHARE_BUILD=$(mktemp -d /tmp/flowy-share-harness.XXXXXX)
SHARE_APP="$SHARE_BUILD/FlowySharePreview.app"
mkdir -p "$SHARE_APP"
cat plugins/shareExtensionTemplate/ShareViewController.swift scripts/share-extension-harness.swift > "$SHARE_BUILD/SharePreview.swift"
cp node_modules/@expo-google-fonts/instrument-serif/400Regular/InstrumentSerif_400Regular.ttf "$SHARE_APP/"
cat > "$SHARE_APP/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>app.tryflowy.sharepreview</string>
<key>CFBundleName</key><string>Flowy Share Preview</string>
<key>CFBundleExecutable</key><string>FlowySharePreview</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>LSRequiresIPhoneOS</key><true/>
<key>UILaunchScreen</key><dict/>
<key>UIDeviceFamily</key><array><integer>1</integer><integer>2</integer></array>
</dict></plist>
PLIST
xcrun swiftc -parse-as-library -sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" \
  -target "$(uname -m)-apple-ios15.1-simulator" "$SHARE_BUILD/SharePreview.swift" -o "$SHARE_APP/FlowySharePreview"
xcrun simctl install booted "$SHARE_APP"
xcrun simctl terminate booted app.tryflowy.sharepreview >/dev/null 2>&1 || true
xcrun simctl launch booted app.tryflowy.sharepreview "$@"
printf 'Preview bundle: %s\n' "$SHARE_APP"
if [[ " ${*} " == *" --test "* ]]; then
  SHARE_CONTAINER=$(xcrun simctl get_app_container booted app.tryflowy.sharepreview data)
  rm -f "$SHARE_CONTAINER/Documents/share-checks.txt"
  for attempt in {1..15}; do
    if [[ -f "$SHARE_CONTAINER/Documents/share-checks.txt" ]]; then
      cat "$SHARE_CONTAINER/Documents/share-checks.txt"
      exit 0
    fi
    sleep 1
  done
  echo 'Native checks did not finish. Inspect the simulator crash log.' >&2
  exit 1
fi
