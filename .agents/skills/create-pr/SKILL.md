---
name: create-pr
description: Pre-PR checklist before commit, push, and opening a pull request. Use when preparing to ship work, opening a PR, or finishing an implementation task.
---

Run this checklist before commit, push, and PR. Do not open a PR until every item passes.

## Pre-flight

- [ ] Branch name follows `cursor/<descriptive-name>-<suffix>`
- [ ] Diff is focused — no drive-by refactors or unrelated changes
- [ ] Code matches existing style in the touched files

## Local verification (mirror CI)

Run in order:

1. `npm run lint`
2. `npm test`
3. `npm run build`
4. `npx playwright install --with-deps chromium` (first run or after Playwright upgrade)
5. `npm run test:e2e`

All must pass before pushing.

## Commit and push

- [ ] Commit message describes what changed and why
- [ ] `git push -u origin <branch>`

## Pull request

- [ ] PR body uses short bullets only: what broke, what changed, how verified
- [ ] Do not wait for diff review — merge when CI is green
- [ ] Ping Kasper only for blocked CI, ambiguous product calls, or external setup

## Branch protection (repo admin)

PRs should not merge when CI fails. On GitHub, require the **CI** workflow as a status check on `main` under branch protection rules.
