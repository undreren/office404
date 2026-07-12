---
name: agent-browser-test
description: Test Office 404 in a real browser via pi-agent-browser. Use when a local model needs to play, verify UI, or QA the game without Playwright.
---

Ultra-short playbook for small models (e.g. gemma4:26b) using [pi-agent-browser](https://github.com/normful/pi-agent-browser).

## Setup (once)

```bash
pi install npm:pi-agent-browser
npm install && npm run dev
```

First `browser` call auto-installs `agent-browser` + Chromium if missing.

## Test loop (repeat)

1. `browser open http://localhost:5173/?fixture=fresh-tutorial&skipOnboarding=1` (or full onboarding URL below)
2. Dismiss any modal: `browser find testid onboarding-dismiss` (repeat until “Element not found”)
3. You start on **Projects** — other tabs locked until tutorial ships
4. `browser snapshot -i` after each action to see new refs for in-page buttons

### Dismiss onboarding (use this — snapshot refs fail on modals)

**Preferred:** `find testid onboarding-dismiss` — it **auto-clicks** the Got it button. No separate `click @eN` needed.

```
browser find testid onboarding-dismiss
```

Run again after each modal (story intro → tab intro → tutorial steps). Stop when find returns “Element not found”.

**Do not** use `click @e3` / `click text=Got it` / `semanticAction` from a prior `snapshot -i` — refs are stale between tool calls on this app.

**Skip story + tab intros** (start on Projects, tutorial step modals still appear):

`http://localhost:5173/?fixture=fresh-tutorial&skipOnboarding=1`

Dismiss step modals with `find testid onboarding-dismiss` as they appear.

## Tutorial gig (Friendly Neighbor App)

| Step | What to do |
|------|------------|
| 1 | Wait — refine agent turns requirements into tasks (game paused during modals) |
| 2 | Click **+** next to **Code** under Staffing (`find role button` + name filter, or snapshot ref) |
| 3 | Wait — code → review → QA runs automatically |
| 4 | Click **Deliver** when the card glows ready |

Dismiss each new **Got it** tutorial modal. Leads unlock after deliver.

## Handy commands

| Goal | `browser` arg string |
|------|----------------------|
| See page | `snapshot -i` |
| Dismiss modal | `find testid onboarding-dismiss` (auto-clicks) |
| Tap button | `click @eN` (after fresh `snapshot -i`) |
| Check title | `get title` |
| Visual check | `screenshot` |
| Done | `close` |

## Rules

- Use `find testid onboarding-dismiss` for modals — it auto-clicks; do **not** use `click --text`, `click --role`, or `semanticAction`
- Do **not** trust `@eN` refs from a prior `snapshot` for modal buttons — use `find testid` only
- Dismiss **Got it** first; game is paused while modals are open
- Dev URL is `localhost:5173`; CI uses Playwright on `4173` — agents use dev
- Fixture `fresh-tutorial` = clean tutorial save, no localStorage fumbling
- If stuck: `browser close` then reopen with `sessionMode=fresh`

## Do not

- Raw `agent-browser` shell commands — use the pi `browser` tool
- Click locked nav tabs (Feed/Shop/Agents/Leads) before tutorial done
- Expect JSON snapshots — output is compact text with `@e1`, `@e2`, … refs
- Use `click --text "Got it"` or `click --role button --name "Got it"` — they fail on this app
