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

1. `browser open http://localhost:5173/?fixture=fresh-tutorial`
2. `browser snapshot -i` — read `@ref` handles
3. Click **Got it** until no onboarding modal (story → tab intro → tutorial steps)
4. You start on **Projects** — other tabs locked until tutorial ships
5. `browser snapshot -i` after each action to see new refs

## Tutorial gig (Friendly Neighbor App)

| Step | What to do |
|------|------------|
| 1 | Wait — refine agent turns requirements into tasks (game paused during modals) |
| 2 | Click **+** next to **Code** under Staffing |
| 3 | Wait — code → review → QA runs automatically |
| 4 | Click **Deliver** when the card glows ready |

Dismiss each new **Got it** tutorial modal. Leads unlock after deliver.

## Handy commands

| Goal | `browser` arg string |
|------|----------------------|
| See page | `snapshot -i` |
| Tap button | `click @eN` |
| Check title | `get title` |
| Visual check | `screenshot` |
| Done | `close` |

## Rules

- Always `snapshot -i` before clicking — refs change after navigation
- Dismiss **Got it** first; game is paused while modals are open
- Dev URL is `localhost:5173`; CI uses Playwright on `4173` — agents use dev
- Fixture `fresh-tutorial` = clean tutorial save, no localStorage fumbling
- If stuck: `browser close` then reopen

## Do not

- Raw `agent-browser` shell commands — use the pi `browser` tool
- Click locked nav tabs (Feed/Shop/Agents/Leads) before tutorial done
- Expect JSON snapshots — output is compact text with `@e1`, `@e2`, … refs
