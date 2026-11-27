#!/usr/bin/env bash
set -euo pipefail

if [[ $# != 1 || ! -f "$1" || "$(uname -s)" != Darwin ]]; then
    echo "Usage on macOS: bash build-and-stage.sh /path/to/PoemWidget.mobileprovision" >&2
    exit 1
fi

profile="$1"
source_dir="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$source_dir/../../.." && pwd)"
ios_dir="$root/nativeResources/ios"
plugins="$root/uni_modules/poem-widget/utssdk/app-ios/Plugins"
group="group.com.poementer.app.widgets"
bundle_id="com.poementer.app.PoemWidget"
plist_buddy=/usr/libexec/PlistBuddy
mkdir -p "$root/unpackage"
build_dir="$(mktemp -d "$root/unpackage/poem-widget-ios.XXXXXX")"

profile_plist="$build_dir/widget-profile.plist"
security cms -D -i "$profile" -o "$profile_plist"
team="$("$plist_buddy" -c 'Print :TeamIdentifier:0' "$profile_plist")"
profile_name="$("$plist_buddy" -c 'Print :Name' "$profile_plist")"
profile_id="$("$plist_buddy" -c 'Print :Entitlements:application-identifier' "$profile_plist")"
if [[ "$profile_id" != "$team.$bundle_id" ]] ||
    ! "$plist_buddy" -c 'Print :Entitlements:com.apple.security.application-groups' "$profile_plist" | grep -Fqx "    $group"; then
    echo "The Widget profile must match $bundle_id and include $group." >&2
    exit 1
fi

identity="Apple Distribution"
if [[ "$("$plist_buddy" -c 'Print :Entitlements:get-task-allow' "$profile_plist" 2>/dev/null || true)" == true ]]; then
    identity="Apple Development"
fi
version="$(node -p 'require(process.argv[1]).versionName' "$root/manifest.json")"
build="$(node -p 'require(process.argv[1]).versionCode' "$root/manifest.json")"

xcodebuild -project "$source_dir/PoemWidget.xcodeproj" -target PoemWidget -configuration Release -sdk iphoneos \
    DEVELOPMENT_TEAM="$team" CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="$identity" \
    PROVISIONING_PROFILE_SPECIFIER="$profile_name" MARKETING_VERSION="$version" CURRENT_PROJECT_VERSION="$build" \
    CONFIGURATION_BUILD_DIR="$build_dir" OBJROOT="$build_dir/intermediates" SYMROOT="$build_dir/products" build
codesign --verify --strict "$build_dir/PoemWidget.appex"

if [[ -f "$ios_dir/UniApp.entitlements" ]]; then
    host_entitlements="$build_dir/UniApp.entitlements"
    cp "$ios_dir/UniApp.entitlements" "$host_entitlements"
    if ! "$plist_buddy" -c 'Print :com.apple.security.application-groups' "$host_entitlements" >/dev/null 2>&1; then
        "$plist_buddy" -c 'Add :com.apple.security.application-groups array' "$host_entitlements"
    fi
    if ! "$plist_buddy" -c 'Print :com.apple.security.application-groups' "$host_entitlements" | grep -Fqx "    $group"; then
        "$plist_buddy" -c "Add :com.apple.security.application-groups:0 string $group" "$host_entitlements"
    fi
else
    host_entitlements="$source_dir/PoemWidget.entitlements"
fi

node - "$ios_dir/ios-extension.json" "$source_dir/ios-extension.json" "$build_dir/ios-extension.json" <<'NODE'
const fs = require('node:fs');
const [destination, template, output] = process.argv.slice(2);
const existing = fs.existsSync(destination) ? JSON.parse(fs.readFileSync(destination, 'utf8')) : {};
const widget = JSON.parse(fs.readFileSync(template, 'utf8'));
fs.writeFileSync(output, JSON.stringify({ ...existing, ...widget }, null, 2) + '\n');
NODE

mkdir -p "$ios_dir" "$plugins"
if [[ -d "$plugins/PoemWidget.appex" ]]; then
    mv "$plugins/PoemWidget.appex" "$build_dir/previous.appex"
fi
if ! ditto "$build_dir/PoemWidget.appex" "$plugins/PoemWidget.appex"; then
    if [[ -d "$build_dir/previous.appex" ]]; then
        ditto "$build_dir/previous.appex" "$plugins/PoemWidget.appex"
    fi
    exit 1
fi
cp "$profile" "$ios_dir/PoemWidget.mobileprovision"
cp "$host_entitlements" "$ios_dir/UniApp.entitlements"
cp "$build_dir/ios-extension.json" "$ios_dir/ios-extension.json"
echo "PoemWidget.appex is ready for HBuilderX packaging."
