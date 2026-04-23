# Historical planning docs

These were the implementation plans for specific April 2026 milestones. They are preserved here for traceability — a reviewer who wonders "why does the server do X that way?" can read the doc that drove the decision — but nothing in them is actionable anymore.

Everything listed as P0 / P1 in these documents has landed in `main`. See `CHANGELOG.md` and `docs/adr/` for the current state.

| Doc                                   | Date       | Author (persona)        | Status                      |
| ------------------------------------- | ---------- | ----------------------- | --------------------------- |
| `2026-04-10-backend-architecture.md`  | 2026-04-10 | Staff Backend Engineer  | All items shipped           |
| `2026-04-10-frontend-architecture.md` | 2026-04-10 | Staff Frontend Engineer | All items shipped           |
| `2026-04-10-product-spec.md`          | 2026-04-10 | Product                 | Superseded — see note below |

### Note on the product spec

The April-2026 product spec drove several P0 features (Sent tab, Revoke, user-list filtering, `connection:request:revoked` socket event) — all shipped. Since then the product has **diverged** from that spec:

- **Now in the product, not in the spec:** group rooms, tags, full privacy settings (read receipts / online status / typing indicators with bilateral enforcement), personal information editing.
- **In the spec "What Needs to Be Built" section, now shipped:** everything.
- **In the spec "Out of Scope for v1" list, now shipped anyway:** group rooms.

Treat the spec as a historical planning doc. The README + ADRs are the current product description.

## How to read these

- Treat them as archaeology, not documentation.
- If an item in one of these docs _disagrees_ with the current code, the **code wins**. The docs describe intent at a point in time.
- If you want the "why" of a particular choice, start in `docs/adr/` instead — those are living decisions.

## When to archive a new doc here

Move a planning doc into `docs/archive/` when every P0 + P1 item it lists is either shipped, explicitly deprioritized, or split into smaller docs. Prefix the filename with the doc's origination date (`YYYY-MM-DD-`) so chronology stays scannable.
