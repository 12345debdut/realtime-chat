# ADR 0001 — React Native New Architecture on day one

## Context
React Native 0.76+ makes the New Architecture (Fabric renderer, TurboModules,
Bridgeless mode) the default for new apps. Older legacy-bridge apps still work
but see increasing friction: library authors are targeting the New Arch, and
the async bridge hurts animation-heavy screens by introducing variable latency.

This project is a chat app with a gesture/animation showcase — the frame
budget on the UI thread is the single most important quality bar.

## Options considered
1. **Stay on the legacy bridge.** Safer library support but worse gesture
   latency and nothing to brag about.
2. **Adopt New Architecture immediately.** Fabric + TurboModules + Bridgeless.
   All first-party libs used here (Reanimated 3, Gesture Handler 2,
   WatermelonDB JSI adapter, MMKV, Keychain) already support it.

## Decision
Go New Architecture from the first commit. The template default in RN 0.85
already enables it, so there is no downgrade path we need to defend.

## Consequences
- Reanimated worklets run against the Fabric scheduler — smoother springs.
- WatermelonDB uses the JSI-backed SQLite adapter (`jsi: true`), bypassing
  the async bridge for DB reads/writes. Large chat histories stay fluid.
- Any third-party native module we add must declare New Architecture support
  (check `"newArchEnabled": true` in its `package.json`/`react-native.config.js`).
- Debugging the bridge itself disappears — Flipper support is reduced, so we
  lean on Reactotron and Chrome DevTools for JS inspection.
