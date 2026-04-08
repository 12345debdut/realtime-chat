# ADR 0004 — Zustand for UI state, TanStack Query for server state

## Context
Most of the "state" in this app isn't UI state at all — it's persisted
rows observed from WatermelonDB, or server responses cached by TanStack
Query. What remains is small: auth status, typing indicators, input
drafts, ephemeral modals.

## Decision
- **WatermelonDB** owns domain data (rooms, messages, memberships).
- **TanStack Query** owns request/response caching for REST endpoints.
- **Zustand** owns the remaining ephemeral UI state.
- **Redux is intentionally not used.**

## Consequences
- No reducer boilerplate for the 80% of state that doesn't need it.
- Each store is small and colocated with its feature slice.
- Redux DevTools are not available, but Reactotron covers the Zustand
  use case adequately for a single-engineer project.
