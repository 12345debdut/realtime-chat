#!/usr/bin/env bash
#
# Interactive iOS-simulator screenshot capture for the README "Screens" grid.
# Walks you through the nine screens listed in docs/screenshots/README.md,
# one at a time: navigate on the simulator, press Enter in this terminal,
# the script captures and moves on.
#
# Prerequisites:
#   - iOS simulator booted with @rtc/mobile running (yarn workspace @rtc/mobile ios)
#   - xcrun on PATH (ships with Xcode command-line tools)
#
# Output: PNGs written to docs/screenshots/ with the conventional names.
#
set -euo pipefail

cd "$(dirname "$0")/.."

OUT_DIR="docs/screenshots"
mkdir -p "$OUT_DIR"

# Verify simulator is up before we start walking the user through nine prompts.
if ! xcrun simctl list devices booted 2>/dev/null | grep -q '(Booted)'; then
  echo "✗ No booted iOS simulator found."
  echo "  Boot one first: yarn workspace @rtc/mobile ios"
  exit 1
fi

# Consistent status bar — no developer's wall-clock time, no drained battery.
# Matches what Apple does for App Store marketing screenshots.
echo "→ Normalizing status bar (time 9:41, full battery, full signal)…"
xcrun simctl status_bar booted override \
  --time "9:41" \
  --dataNetwork "wifi" \
  --wifiMode "active" \
  --wifiBars 3 \
  --cellularMode "active" \
  --cellularBars 4 \
  --batteryState "charged" \
  --batteryLevel 100 \
  >/dev/null 2>&1 || true

capture() {
  local filename="$1"
  local prompt="$2"
  echo ""
  echo "──────────────────────────────────────────────"
  echo "  📸  $filename"
  echo "     $prompt"
  echo "──────────────────────────────────────────────"
  read -r -p "     Press Enter when ready (or type s to skip)… " ans
  if [[ "$ans" == "s" ]]; then
    echo "     skipped"
    return
  fi
  xcrun simctl io booted screenshot "$OUT_DIR/$filename"
  echo "     ✓ saved $OUT_DIR/$filename"
}

# The order matches the README grid: onboarding, core, you.
capture "ios-login.png"            "Navigate to the Login screen. Fields blank."
capture "ios-register.png"         "Navigate to Register. Fields blank."
capture "ios-chat-list-empty.png"  "Log out and log back in as a brand-new user so the chat list is empty. Show the empty-state illustration."
capture "ios-chat-room.png"        "Open a chat room with ~5 messages, both sides visible. Typing dots welcome if you can time it."
capture "ios-new-chat.png"         "Compose a new chat. Search with 2–3 user results visible."
capture "ios-connections.png"      "Connections screen. 'Received' tab with at least one pending request."
capture "ios-profile.png"          "Profile screen — a filled-in user (bio, avatar)."
capture "ios-personal-info.png"    "Settings → Personal Information. Open the bottom-sheet editor on the Bio field so the sheet is visible."
capture "ios-privacy.png"          "Settings → Privacy & Security. All three toggles visible."

# Restore the real status bar when we're done so continued dev work doesn't
# look frozen at 9:41.
echo ""
echo "→ Restoring native status bar…"
xcrun simctl status_bar booted clear >/dev/null 2>&1 || true

echo ""
echo "✓ Done. Captured PNGs in $OUT_DIR/"
echo ""
echo "  Next:"
echo "    1. Eyeball each file — any that look wrong, re-capture manually with ⌘S and rename."
echo "    2. Open README.md, find the 'Screens' section, uncomment the <img> lines for each file you captured."
echo "    3. Commit: git add $OUT_DIR README.md && git commit -m 'docs: add app screenshots to README'"
