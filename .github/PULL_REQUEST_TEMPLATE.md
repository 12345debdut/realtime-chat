<!--
  PR template — keep it tight. CI gates the rest.
-->

## Summary

<!-- 1–3 bullets. What changes, why. Link the issue if there is one. -->

-

## Screenshots / demo

<!-- Mobile changes: screenshots or a short screen-recording. Server-only changes: delete this section. -->

## Test plan

- [ ] `yarn ci` passes locally
- [ ] Manually verified on iOS simulator (for mobile changes)
- [ ] Manually verified against a local server (for backend changes)
- [ ] New tests added where behavior changed

## Risks & rollback

<!--
  Anything subtle? DB migration? Irreversible data change?
  If this needs a backout plan, state it in one sentence.
-->

## Checklist

- [ ] No secrets or personal info in the diff
- [ ] `@rtc/contracts` rebuilt if the schema changed
- [ ] Prisma migration file included and idempotent
- [ ] README / package docs updated if user-facing
