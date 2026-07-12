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

## Golden rule

**Never `click @eN` from a prior `snapshot -i`.** Refs die between separate tool calls. Use **`find testid …`** (auto-clicks) or a single **`job`** batch (open + find + wait in one call).

## Fast tutorial playtest (recommended)

Use the **ready-for-code** fixture — skips waiting for refine:

```
http://localhost:5173/?fixture=tutorial-ready-for-code&skipOnboarding=1
```

### One `job` batch (copy this shape)

```json
{
  "job": {
    "steps": [
      { "action": "open", "url": "http://localhost:5173/?fixture=tutorial-ready-for-code&skipOnboarding=1" },
      { "action": "args", "args": ["find", "testid", "onboarding-dismiss"] },
      { "action": "args", "args": ["find", "testid", "staffing-add-code-proj-1"] },
      { "action": "wait", "milliseconds": 15000 },
      { "action": "args", "args": ["snapshot", "-i"] }
    ]
  }
}
```

`find testid` **auto-clicks** when it finds the element. `"Element not found"` on `onboarding-dismiss` is **good** — no modal blocking the game.

## Full tutorial from scratch

```
http://localhost:5173/?fixture=fresh-tutorial&skipOnboarding=1
```

`skipOnboarding=1` skips story + tab intros **and** tutorial step modals. Game still needs real time to refine requirements.

| Step | What to do |
|------|------------|
| 1 | `find testid onboarding-dismiss` — dismiss any modal first (game **paused** while modal open) |
| 2 | Wait in **5–10s** chunks; `snapshot -i` until header shows **Day 1 - …** (clock advances from `Day 0 - 08:00 AM`) and tasks appear |
| 3 | `find testid staffing-add-code-proj-1` when enabled (not disabled in snapshot) |
| 4 | Wait — code → review → QA runs automatically |
| 5 | `find testid deliver-proj-1` when card glows ready |

**Why "Add code" is disabled:** the lone agent may still be refining, or all agents are busy. Wait for a day tick (~5–10s real time) and snapshot again. Do **not** wait 60s in one call — wrapper times out at ~35s.

## Stable testids

| Action | `find testid` value |
|--------|---------------------|
| Dismiss Got it modal | `onboarding-dismiss` |
| Staff coder (+ Code) | `staffing-add-code-proj-1` |
| Staff refine / review / test | `staffing-add-refine-proj-1`, `staffing-add-review-proj-1`, `staffing-add-test-proj-1` |
| Deliver tutorial gig | `deliver-proj-1` |

Project id is `proj-1` for the tutorial gig.

## Handy commands

| Goal | Args |
|------|------|
| Open game | `open http://localhost:5173/?fixture=tutorial-ready-for-code&skipOnboarding=1` |
| Dismiss modal | `find testid onboarding-dismiss` |
| Staff coder | `find testid staffing-add-code-proj-1` |
| Deliver | `find testid deliver-proj-1` |
| See page | `snapshot -i` (read only — do not click refs from this output in the **next** call) |
| Done | `close` |

## Rules

- **`find testid` only** for clicks — not `click @eN`, not `click --text`, not `semanticAction`
- Dismiss modals **before** waiting for game progress
- Dev URL is `localhost:5173`; CI uses Playwright on `4173`
- If tab drifts to `about:blank`: `close` then reopen with `sessionMode=fresh`
- Keep waits ≤10s per call; chain in a `job` if you need longer

## Do not

- Raw `agent-browser` shell commands — use the pi `browser` tool
- Click locked nav tabs (Feed/Shop/Agents/Leads) before tutorial done
- Trust `@eN` refs across separate tool calls
- Use `get text body` — unknown command; use `snapshot -i` instead
