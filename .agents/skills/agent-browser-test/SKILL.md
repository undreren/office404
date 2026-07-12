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
3. Dismiss onboarding (see below) until no modal
4. You start on **Projects** — other tabs locked until tutorial ships
5. `browser snapshot -i` after each action to see new refs

### Dismiss onboarding (use this — refs are unreliable on modals)

**Preferred:** stable test id, not snapshot refs.

```
browser find testid onboarding-dismiss
browser click @eN
```

Run `find` again after each dismiss — the ref changes. Repeat until `find` returns nothing.

**Batch job** (snapshot + click in one call — refs stay valid):

```json
{
  "job": {
    "steps": [
      { "action": "open", "url": "http://localhost:5173/?fixture=fresh-tutorial" },
      { "action": "wait", "milliseconds": 2000 },
      { "action": "find", "selector": "testid onboarding-dismiss" },
      { "action": "click", "selector": "@eN" }
    ]
  }
}
```

Replace `@eN` with the ref from the find step in the same batch.

**Skip modals entirely** (gameplay only):

`http://localhost:5173/?fixture=fresh-tutorial&skipOnboarding=1`

Tutorial step modals can still appear as you progress — dismiss those with `find testid onboarding-dismiss`.

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
| Dismiss modal | `find testid onboarding-dismiss` then `click @eN` |
| Tap button | `click @eN` (after fresh `snapshot -i`) |
| Check title | `get title` |
| Visual check | `screenshot` |
| Done | `close` |

## Rules

- Use `find testid onboarding-dismiss` for modals — do **not** use `click --text` or `click --role` (unsupported)
- Do **not** trust `@eN` refs from a prior `snapshot` for modal buttons — use `find` or a batch job
- Dismiss **Got it** first; game is paused while modals are open
- Dev URL is `localhost:5173`; CI uses Playwright on `4173` — agents use dev
- Fixture `fresh-tutorial` = clean tutorial save, no localStorage fumbling
- If stuck: `browser close` then reopen with `sessionMode=fresh`

## Do not

- Raw `agent-browser` shell commands — use the pi `browser` tool
- Click locked nav tabs (Feed/Shop/Agents/Leads) before tutorial done
- Expect JSON snapshots — output is compact text with `@e1`, `@e2`, … refs
- Use `click --text "Got it"` or `click --role button --name "Got it"` — they fail on this app
