---
name: agent-browser-test
description: Test Office 404 in a real browser via pi-agent-browser. Use when a local model needs to play, verify UI, or QA the game without Playwright.
---

Ultra-short playbook for small models (e.g. gemma4) using [pi-agent-browser](https://github.com/normful/pi-agent-browser).

## Setup (once)

```bash
pi install npm:pi-agent-browser
npm install && npm run dev
```

First `browser` call auto-installs `agent-browser` + Chromium if missing.

## Core loop — do this every turn

**Never bash-loop or grep partial snapshots.** One action, then read the full page again.

```
open → wait 2–3s → snapshot -i → read → act → snapshot -i → read → act → …
```

1. **`open`** the fixture URL.
2. **`wait`** 2–3 seconds (fixture hydrates from `?fixture=`; clicking too early misses React handlers).
3. **`snapshot -i`** — read the **entire** output before doing anything.
4. **One action** (`find testid …`, or `wait` 5–10s if clock should advance).
5. **`snapshot -i` again** — confirm the action worked before the next action.
6. Repeat until done.

Split args: `["snapshot", "-i"]` and `["open", "<url>"]` — not `"snapshot -i"` as one string.

## Golden rule

**Never `click @eN` from a prior `snapshot -i`.** Refs die between separate tool calls. Use **`find testid …`** (auto-clicks) or a single **`job`** batch (open + wait + find + snapshot in one call).

## Fast tutorial playtest (recommended)

Skips refine wait **and** story/tab/step modals:

```
http://localhost:5173/?fixture=tutorial-ready-for-code&skipOnboarding=1
```

| Turn | Args |
|------|------|
| 1 | `open` + url above |
| 2 | `wait` 2000–3000 ms |
| 3 | `snapshot -i` — confirm *Friendly Neighbor App*, Code **+** shows `assign here` (not `roster full`) |
| 4 | `find testid staffing-add-code-proj-1` |
| 5 | `snapshot -i` — confirm `Unassign coding agent … (1 assigned)` |
| 6 | `wait` 5–10s chunks + `snapshot -i` each time until `Deliver to Friendly Neighbor App` appears |
| 7 | `find testid deliver-proj-1` |
| 8 | `snapshot -i` — confirm cash / leads unlocked |

### One `job` batch (copy this shape)

```json
{
  "job": {
    "steps": [
      { "action": "open", "url": "http://localhost:5173/?fixture=tutorial-ready-for-code&skipOnboarding=1" },
      { "action": "wait", "milliseconds": 3000 },
      { "action": "args", "args": ["snapshot", "-i"] },
      { "action": "args", "args": ["find", "testid", "staffing-add-code-proj-1"] },
      { "action": "args", "args": ["snapshot", "-i"] },
      { "action": "wait", "milliseconds": 10000 },
      { "action": "args", "args": ["snapshot", "-i"] },
      { "action": "args", "args": ["find", "testid", "deliver-proj-1"] },
      { "action": "args", "args": ["snapshot", "-i"] }
    ]
  }
}
```

`find testid` **auto-clicks** when it finds the element. `"Element not found"` on `onboarding-dismiss` is **good** — no modal blocking the game.

## Full tutorial from scratch (with onboarding)

```
http://localhost:5173/?fixture=fresh-tutorial
```

| Turn | What to do |
|------|------------|
| 1 | `open` → **`wait` 2–3s** → `snapshot -i` |
| 2 | If modal visible: `find testid onboarding-dismiss` → **`snapshot -i`** — repeat until dismiss fails (story → tab intro → Step 1) |
| 3 | `wait` 5–10s → `snapshot -i` — clock advances, refine agent staffed, roster **1/1 full** |
| 4 | When header shows **`Paused`** mid-game: dismiss modal first (`find testid onboarding-dismiss` → snapshot) — Steps 2–4 appear as milestones hit |
| 5 | After refine done: **`find testid staffing-remove-refine-proj-1`** → snapshot → then **`find testid staffing-add-code-proj-1`** → snapshot |
| 6 | Swap roles as tasks change (crew cap **1** — only one role at a time): code → review → code (review fixes) → test → code (bugs) → … |
| 7 | When snapshot shows **`Deliver to Friendly Neighbor App`**: `find testid deliver-proj-1` → snapshot |

### Crew cap 1 — swap roles, don’t stack

Tutorial has **one agent, crew cap 1**. You cannot staff Code while Refine still holds the slot.

| Situation in snapshot | Action |
|-----------------------|--------|
| Code **+** says `roster full (1/1)`, Refine shows `(1 assigned)` | `staffing-remove-refine-proj-1` → snapshot → `staffing-add-code-proj-1` |
| Tasks `review`, Code assigned, Review **+** blocked | `staffing-remove-code-proj-1` → snapshot → `staffing-add-review-proj-1` |
| Tasks `testing`, Review/Code assigned, QA **+** blocked | remove current role → snapshot → `staffing-add-test-proj-1` |

Read each staffing button’s **aria-label** in the snapshot (`assign here`, `roster full`, `no work for this role yet`).

### Skip modals only (still wait for refine)

```
http://localhost:5173/?fixture=fresh-tutorial&skipOnboarding=1
```

Same as fast path but requirements still need in-game time to refine before Code is staffable.

## Reading a snapshot

Check these **every** turn (full tree, not grep):

| Signal | Meaning |
|--------|---------|
| Header contains **`Paused`** | Modal open — dismiss before anything else |
| `Day 0 - 08:00 AM` not advancing | Still paused or just opened — dismiss / wait |
| Task line `coding` / `review` / `testing` / `merged` | What role to staff next |
| `Deliver to Friendly Neighbor App` button | Ship it |
| Code **+** `no work for this role yet` | Refine not done — wait + snapshot |
| Code **+** `roster full` | Wrong role still staffed — remove it first |

## Stable testids

| Action | `find testid` value |
|--------|---------------------|
| Dismiss Got it modal | `onboarding-dismiss` |
| Roster status (idle / full) | `staffing-roster-summary` |
| Unassign refine / code / review / QA | `staffing-remove-refine-proj-1`, `staffing-remove-code-proj-1`, `staffing-remove-review-proj-1`, `staffing-remove-test-proj-1` |
| Staff coder (+ Code) | `staffing-add-code-proj-1` |
| Staff refine / review / test | `staffing-add-refine-proj-1`, `staffing-add-review-proj-1`, `staffing-add-test-proj-1` |
| Deliver tutorial gig | `deliver-proj-1` |

Project id is `proj-1` for the tutorial gig.

## Handy commands

| Goal | Args |
|------|------|
| Open game | `["open", "http://localhost:5173/?fixture=tutorial-ready-for-code&skipOnboarding=1"]` |
| Let fixture load | `wait` 2000–3000 ms |
| See page | `["snapshot", "-i"]` |
| Dismiss modal | `["find", "testid", "onboarding-dismiss"]` |
| Staff coder | `["find", "testid", "staffing-add-code-proj-1"]` |
| Unassign refine | `["find", "testid", "staffing-remove-refine-proj-1"]` |
| Deliver | `["find", "testid", "deliver-proj-1"]` |
| Done | `["close"]` |

## Rules

- **`snapshot -i` after every action** — open, wait, dismiss, staff, deliver
- **`wait` 2–3s after `open`** before first dismiss or click
- **`find testid` only** for clicks — not `click @eN`, not `click --text`, not `semanticAction`
- Dismiss modals **before** waiting for game progress
- Dev URL is `localhost:5173`; CI uses Playwright on `4173`
- If tab drifts to `about:blank`: `close` then reopen with `sessionMode=fresh`
- Keep waits ≤10s per call; chain in a `job` if you need longer

## Do not

- Bash loops grepping snapshots — play turn-by-turn
- Raw `agent-browser` shell commands — use the pi `browser` tool
- Click locked nav tabs (Status/Shop/Leads) before tutorial done
- Trust `@eN` refs across separate tool calls
- Staff Code while Refine still holds the only roster slot
- Use `get text body` — unknown command; use `snapshot -i` instead
