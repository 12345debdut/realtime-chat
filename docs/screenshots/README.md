# Screenshots

Source of truth for every screenshot referenced from the main README and per-package READMEs.

## Naming convention

```
<platform>-<screen>.png
```

- `<platform>` — `ios` or `android`
- `<screen>` — kebab-case screen name

Both platforms are welcome; the README grid uses `ios-*` by default because iOS simulator screenshots are sharper out of the box.

## Required set (for the main README "Screens" grid)

The main README references these nine filenames. Capture them once, replace as the UI evolves.

| Row        | Filename                  | What to show                                                                          |
| ---------- | ------------------------- | ------------------------------------------------------------------------------------- |
| Onboarding | `ios-login.png`           | Login screen, blank form                                                              |
| Onboarding | `ios-register.png`        | Register screen, blank form                                                           |
| Onboarding | `ios-chat-list-empty.png` | Chat list, no rooms yet — shows empty-state illustration + pull-to-refresh affordance |
| Core       | `ios-chat-room.png`       | Chat room with ~5 messages, one from each side, a typing-indicator dots if possible   |
| Core       | `ios-new-chat.png`        | New-chat search with 2–3 users rendered                                               |
| Core       | `ios-connections.png`     | Connections screen on the "Received" tab with one pending request visible             |
| You        | `ios-profile.png`         | Read-only profile screen with a filled-in user                                        |
| You        | `ios-personal-info.png`   | Personal Info screen with the bottom-sheet open on the Bio field                      |
| You        | `ios-privacy.png`         | Privacy screen showing all three toggles                                              |

## How to capture (iOS simulator)

### One-off, manual

1. Boot the simulator via Xcode or `yarn workspace @rtc/mobile ios`.
2. Navigate to the screen you want.
3. Press **⌘ + S** — Xcode saves a PNG to Desktop.
4. Rename per the convention above and move into this directory.

### Batch, via script

From the repo root:

```sh
bash scripts/capture-screenshots.sh
```

The script is interactive: it tells you which screen to navigate to, waits for you to press Enter, captures, moves on. Takes ~3 minutes for the full set. Requires the simulator to already be booted with the app running.

Underneath the hood it calls `xcrun simctl io booted screenshot <file>`, which is Xcode's recommended capture command and produces 3×-density PNGs.

## Size / format guidance

- **Format:** PNG. Don't convert to JPG — the UI has fine typography and solid-color surfaces where JPEG artefacts show up immediately.
- **Aspect:** keep the native simulator output; don't crop. GitHub renders them at sensible sizes via the README's table layout.
- **Device:** iPhone 15 Pro or iPhone 16 Pro. Avoid iPhone SE / older models — their aspect ratio is off for a modern demo.
- **Status bar:** cleanest if you use `xcrun simctl status_bar` to set a consistent time (`9:41`) and full battery. The `capture-screenshots.sh` script does this automatically.

## Light vs. dark mode

Pick one (light) and stick to it across the grid. A mixed grid looks inconsistent. If you want a "dark mode available" callout, drop ONE extra pair (`ios-chat-room-dark.png`) and link it in the main README caption, rather than duplicating every screen.

## What NOT to put here

- Full device frames (Apple MockUps, MockuPhone, etc.). They take double the bytes and look dated in 2026. Raw simulator PNGs are what modern READMEs use.
- Recordings / GIFs bigger than 2 MB. If you want motion, put a YouTube / Loom / Imgur link in the README caption. Large GIFs balloon the repo and load slowly on mobile network.
- Real user data. The sample account handle + display name in any screenshot must be fake (`alice`, `bob`, etc.).

## Updating the README when a screenshot lands

Open `README.md`, find the "Screens" section, and uncomment the `<img>` line for the filename you just dropped. The commented form is:

```markdown
<!-- <img src="docs/screenshots/ios-login.png" width="220" alt="Login screen" /> -->
```

Remove the `<!-- -->` once the file exists and the image renders.
