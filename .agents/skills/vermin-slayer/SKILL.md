---
name: vermin-slayer
description: Bug-fix workflow — document the bug with a failing test before changing production code. Use when fixing bugs, regressions, or incorrect behavior.
---

Slay vermin in order: **reproduce → red test → fix → green**.

Do not patch production code until a test proves the bug exists and will stay dead.

## When to use

- Any bug fix or regression
- Behavior that should have been covered but was not
- User reports incorrect game logic, save/hydrate issues, or UI breakage

Skip only for typos, copy tweaks, or one-line fixes where a test would assert the obvious.

## Workflow

1. **Reproduce** — confirm the bug locally (fixture URL, saved state, or minimal setup).
2. **Document** — write a test that fails for the wrong behavior and passes for the correct one.
3. **Red** — run the targeted test; it must fail before you fix anything.
4. **Fix** — smallest change that makes the test pass.
5. **Green** — re-run the test plus `npm test` (and `npm run test:e2e` if UI-facing).

## Where tests live

| Bug type | Prefer |
|----------|--------|
| Game logic, dispatch, simulation | `src/game/usecases/<kebab-case-name>.test.ts` |
| Spec-backed behavior | Add `docs/usecases/<kebab-case-name>.md` (Given / When / Then) then mirror in the test |
| Persist / fixtures / runtime | Colocated `*.test.ts` under `src/runtime/` |
| React component behavior | `src/components/<Name>.test.tsx` |
| Full UI flow / onboarding | `e2e/` Playwright spec |

Use existing helpers: `initialPlaying`, `dispatchChain`, `T0`, fixtures in `src/runtime/fixtures/`.

Name files after the invariant, e.g. `deliver-blocked-when-not-ready`, not `fix-bug-123`.

## Test shape

```ts
describe('bug-short-description', () => {
  it('matches use case invariants', () => {
    const before = /* minimal state showing the bug */
    const after = /* action or tick chain */
    expect(/* wrong behavior is gone */).toBe(/* correct */)
  })
})
```

For flaky or seed-dependent bugs, pin the seed and comment why (see `bug-at-qa-creates-fix-task.test.ts`).

## PR notes

- First commit (or first logical chunk): failing test only, if the fix is large.
- PR bullets: what broke, what the test locks in, how verified (`npm test`, fixture, e2e).
