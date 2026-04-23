# @rtc/mobile

React Native 0.85 (bare CLI, New Architecture on) — the client for Realtime Chat.

## Stack

- **React Native 0.85**, New Arch (Fabric, TurboModules, Bridgeless)
- **WatermelonDB** — SQLite via JSI; the source of truth for chat data
- **Reanimated 4** + **Gesture Handler 2** — UI-thread animations and gestures
- **FlashList** — virtualized message list
- **Zustand** — ephemeral UI state (never persistent)
- **TanStack Query** — REST request dedup + retries
- **socket.io-client** — realtime
- **MMKV** — fast KV for flags, last-seen, privacy cache
- **react-native-keychain** — refresh tokens at rest (encrypted)
- **axios** — HTTP with auth refresh interceptor
- **Zod** via `@rtc/contracts` — boundary validation

## Layout

```
src/
├── app/              # App root, providers, navigation host
├── navigation/       # React Navigation stack config
├── foundation/
│   ├── network/      # axios client + refresh interceptor
│   ├── storage/      # MMKV + Keychain wrappers
│   └── ui/           # primitives (Text, PressableScale, theme)
├── features/
│   ├── auth/         # login, register, refresh, restoreUser
│   ├── chat/         # FlashList, MessageBubble, InputBar, TypingDots, useChatRoom
│   ├── connections/  # friend requests, ConnectionRequestCard
│   ├── privacy/      # PrivacyScreen, privacyStore, privacyRepository
│   ├── profile/      # read-only ProfileScreen
│   ├── settings/     # SettingsScreen, PersonalInfoScreen
│   └── users/        # user search
├── lib/              # helpers (format, mask)
├── ui/               # cross-feature UI components
└── __tests__/        # jest
```

Each feature follows a `data/` (repository, API) + `presentation/` (screens, components, hooks, state) split.

## Prerequisites

- Node.js **22.11+**
- Yarn **3.6.4** (via corepack)
- Xcode 16+ with iOS 18 simulator
- Ruby 3.3+ + Bundler (for CocoaPods; system Ruby is too old)
- Android Studio + Android SDK 34+

## First-time setup

```bash
# from repo root
yarn install
yarn workspace @rtc/contracts build

# install iOS pods
cd apps/mobile/ios && bundle install && bundle exec pod install && cd ../..
```

## Run

```bash
# Metro
yarn workspace @rtc/mobile start --reset-cache

# iOS
yarn workspace @rtc/mobile ios --simulator="iPhone 15 Pro"

# Android
yarn workspace @rtc/mobile android
```

`RTC_ENV=dev|prod` at Metro start flips between localhost and the fly.io URL.

## Tests + typecheck

```bash
yarn workspace @rtc/mobile typecheck
yarn workspace @rtc/mobile test
```

## Key patterns

**Optimistic send.** Every `message.send` generates a UUID `clientId`, renders instantly, and reconciles on server ack. Offline? The outbox holds it; the sync engine drains when the socket reconnects.

**Local DB is the source of truth.** Components subscribe to WatermelonDB observables. Network writes *into* the DB; the UI re-renders because the observable fired.

**Privacy-aware actions.** `useTypingIndicator` and `useChatRoom` check MMKV privacy flags before emitting socket events. The server also enforces this server-side.

**Read-only profile, dedicated editor.** `ProfileScreen` displays but never edits. All edits flow through `PersonalInfoScreen` (settings) with per-field bottom sheets, validation, and server-side error surfacing.

**Backward-compatible cache.** `AuthRepository.restoreUser()` backfills any missing fields (privacy, personal info) when hydrating a user cached before those fields existed.
