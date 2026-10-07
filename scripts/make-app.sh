#!/bin/bash
# Builds "Bronze Dawn.app" in build/. Ad-hoc signed so it runs on this Mac.
# For other Macs, sign with a Developer ID and notarize (see README).
set -euo pipefail
cd "$(dirname "$0")/.."
# Universal (Apple silicon + Intel) when the toolchain can, otherwise this Mac's architecture.
if swift build -c release --arch arm64 --arch x86_64 >/dev/null 2>&1; then
  BIN=.build/apple/Products/Release/BronzeDawn
else
  swift build -c release
  BIN=$(swift build -c release --show-bin-path)/BronzeDawn
fi
APP="build/Bronze Dawn.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/BronzeDawn"
cp data/rules.json "$APP/Contents/Resources/rules.json"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Bronze Dawn</string>
  <key>CFBundleDisplayName</key><string>Bronze Dawn</string>
  <key>CFBundleIdentifier</key><string>local.bronzedawn.game</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundleExecutable</key><string>BronzeDawn</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.strategy-games</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
codesign --force --sign - "$APP" >/dev/null
echo "Built $APP"
