# Office 404: Intelligence Not Found

A darkly comedic **idle game PWA** where you run a one-man freelance AI agency in a glitching corporate hellscape.

Host agents on fictional cloud vendors — **Anthropomorphic**, **ObstinateAI**, and **PreCursor** — while burning through tokens, fighting server fires, soothing angry clients, and choosing between coding sprints and zoning out to preserve your sanity.

## Play locally

```bash
npm install
npm run dev
```

Open the dev server URL on your phone or desktop. For the full PWA experience (install prompt, offline play), use a production build:

```bash
npm run build
npm run preview
```

## Core mechanics (v0.1)

| Resource | Role |
|----------|------|
| **Tokens** | Fuel for AI agents — drains continuously per deployed agent |
| **Sanity** | Your mental buffer — sprints drain it, zoning out restores it |
| **Credits** | Client money — spend on agents, servers, token packs |
| **Code Progress** | Ship features to earn credits and reputation |

### Vendors

- **Anthropomorphic** — Premium output, dramatic personalities, steep token burn
- **ObstinateAI** — Cheap but stubborn; agents occasionally refuse tasks
- **PreCursor** — Fast and productive, with a worrying crash rate

### Events

- Agent crashes (memory wiped on reboot)
- Server fires (agents on that rack go offline)
- "Self-awareness" episodes
- Token price surcharges
- Passive client deadline pressure

Progress saves automatically to `localStorage`. Returning after being away applies offline progress (capped at 8 hours).

## Tech stack

- **Vite + React + TypeScript**
- **Zustand** for game state & persistence
- **vite-plugin-pwa** for installable mobile PWA support

## Project structure

```
src/
  game/          # Types, constants, vendors, store, tick logic
  components/    # UI panels
  hooks/         # Game tick & offline progress
```

## Roadmap ideas

- Prestige / "Pivot to B2B" reset layer
- Client contracts with real deadlines
- Agent memory fragments & personality evolution
- Mini-events and narrative choices
- Sound design (notification pings, crash sounds, elevator muzak)

---

*One-man agency · Infinite deadlines · Questionable architecture*
