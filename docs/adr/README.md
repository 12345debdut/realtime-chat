# Architecture Decision Records

Short write-ups of the most consequential design choices in this project. Each ADR answers: *what did we decide, what did we give up, and what would a future maintainer need to know to revisit it safely?*

## Index

| # | Title | Status |
|---|---|---|
| [0001](./0001-watermelondb-as-mobile-source-of-truth.md) | WatermelonDB as the mobile source of truth | Accepted |
| [0002](./0002-bilateral-privacy-model.md) | Bilateral privacy model for read receipts, presence, and typing | Accepted |
| [0003](./0003-public-user-schema.md) | `PublicUserSchema` to prevent personal-info leaks | Accepted |

## When to write a new ADR

- A decision that changes data flow, trust boundaries, or the shape of the wire format.
- A technology choice with a plausible alternative that would have been reasonable.
- A trade-off where the *non-obvious* option was picked and a future contributor would reasonably ask "why not X?"

A commit message is too transient. A code comment is too local. An ADR lives next to the codebase, is discoverable by filename, and survives context loss between maintainers.

## What a good ADR looks like

- **One decision per file.** Don't bundle.
- **Alternatives rejected.** At least one, with a reason that's about this project, not a generic platitude.
- **Consequences.** Both sides. An ADR that lists only positives is hiding something.
- **Implementation touchpoints.** File paths that the decision couples to. Helps the next person find everything they'd need to change if they revisit it.

Template: copy the shape of `0001-watermelondb-as-mobile-source-of-truth.md`.
