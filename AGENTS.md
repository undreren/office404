# Office 404 — agent guide

Darkly comedic idle PWA. You run a one-man freelance AI agency. Goal: **$10M** or a cardboard box.

## Run locally

```bash
npm install          # Node ≥26 (.nvmrc)
npm run dev          # http://localhost:5173
```

Production-like build: `npm run build && npm run preview` (port 4173).

Live deploy: https://undreren.github.io/office404/

## Verify changes

```bash
npm run lint
npm test
npm run build
npm run test:e2e     # Playwright; auto-starts preview on 4173
```

Follow `.agents/skills/create-pr/SKILL.md` before shipping.

## Workflow

Non-trivial changes: run **grilling** skill first; wait for Kasper's go-ahead (`go`, `ship it`, etc.).

Branch: `cursor/<descriptive-name>-<suffix>`

Merge when CI is green — no diff review expected.

## Architecture

| Area | Path |
|------|------|
| Game logic & tick | `src/game/simulation/gameLogic.ts` |
| Projects, leads, tasks | `src/game/projects.ts` |
| Tutorial & onboarding copy | `src/game/onboarding.ts` |
| UI panels | `src/components/` |
| Tab navigation | `src/context/TabNavContext.tsx` |
| Save / hydrate | `src/runtime/persist.ts` (`office404-save-v7`) |
| Behavioral specs | `docs/usecases/*.md` |
| E2E | `e2e/` (Playwright) |

## New game flow

- Starts on **Projects** tab with one tutorial gig (*Friendly Neighbor App*)
- Story intro modal → tab intro → step modals as you progress
- **Feed, Shop, Agents, Leads** nav locked until tutorial is delivered
- One refine agent staffed; player must staff a coder, then deliver
- `$200` + first lead spawn on tutorial delivery; `tutorialDone` gates leads

## Browser testing (agents)

**Playwright** — CI and headless regression (`npm run test:e2e`).

**pi-agent-browser** — for local models driving a real browser. See `.agents/skills/agent-browser-test/SKILL.md`.

Quick fixtures:

- Gameplay (skip story/tab intros): `http://localhost:5173/?fixture=fresh-tutorial&skipOnboarding=1`
- Mid-tutorial, idle agent ready to code: `http://localhost:5173/?fixture=tutorial-ready-for-code&skipOnboarding=1`
- Full onboarding flow: `http://localhost:5173/?fixture=fresh-tutorial`

Dismiss modals with **`find testid onboarding-dismiss`** (auto-clicks; repeat until not found). Do **not** use `click @eN` refs from `snapshot -i` on modal buttons — refs go stale between calls. Playwright uses `getByTestId('onboarding-dismiss')` in `e2e/helpers/onboarding.ts`.

Staffing uses stable testids: `staffing-add-code-proj-1`, `staffing-remove-code-proj-1`, `deliver-proj-1`, `staffing-roster-summary` (roster line in interactive snapshots). Only roles with work show enabled **+** buttons — on the ready-for-code fixture, only **Code** is staffable.

## Tone

Dark corporate comedy. Match voice in `clients.ts`, `refinementContent.ts`, event log messages. Fictional vendors: Anthropomorphic, ObstinateAI, PreCursor.

## Story (for context)

The Singularity happened on a Tuesday. Nobody noticed because the models were busy hallucinating a better Tuesday. You inherited a cardboard box, a laptop with one GPU, and a freelance LLC called **Office 404** — intelligence not found, invoices very much found. Your agents run on fictional cloud tiers, burn tokens you cannot afford, and occasionally compact their context mid-sentence like a therapist having an existential crisis. Clients want "AI-powered synergy" yesterday. Rent wants cash today. Ship the tutorial gig, unlock leads, upgrade from cardboard to CUDA palace, and retire at $10M before reputation hits zero and you become the product.
