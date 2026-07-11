# Office 404: Intelligence Not Found

A darkly comedic **idle game PWA** where you run a one-man freelance AI agency in a glitching corporate hellscape.

Host agents on fictional cloud vendors — **Anthropomorphic**, **ObstinateAI**, and **PreCursor** — while burning through tokens, fighting server fires, soothing angry clients, and vibing while your agents do literally everything else.

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

## Deployment (GitHub Pages)

The game deploys automatically to GitHub Pages on every push to `main`.

**Live URL:** https://undreren.github.io/office404/

### One-time repo setup

1. Open **Settings → Pages** in the GitHub repo
2. Under **Build and deployment → Source**, choose **GitHub Actions**
3. Merge to `main` — the `Deploy to GitHub Pages` workflow builds and publishes `dist/`

### How it works

| Piece | Purpose |
|-------|---------|
| `BASE_PATH=/office404/` | Vite asset paths for project-site hosting |
| `npm run build:pages` | Production build with the GitHub Pages base path |
| `.github/workflows/deploy-pages.yml` | CI build + deploy via `actions/deploy-pages` |

Test the Pages build locally before pushing:

```bash
npm run build:pages
npm run preview:pages
# open http://localhost:4173/office404/
```

### Notes

- **PWA install** works on the deployed URL; the service worker and manifest use the `/office404/` scope.
- **Saves** are per-origin — local dev and GitHub Pages keep separate `localStorage`.
- A custom domain can be added later under **Settings → Pages** without code changes (set `BASE_PATH=/` when using a root domain).

## Core mechanics (v0.2)

**Freelance survival expansion** — solo dev, multiple clients, agents, and the slow march toward $10M or a cardboard box.

| Resource | Role |
|----------|------|
| **Cash** | Rent, tokens, hardware, apartment upgrades — paid on project completion (lump sum) |
| **Tokens** | Fabulous5 cloud agents burn per tick; dry wallet = agents stop |
| **Sanity** | Everything stressful drains it; **Vibe** (smoke break) restores it |
| **Reputation** | On-time delivery up, missed deadlines & expired leads down — zero rep + no work = game over |
| **Net worth** | Cash + refurbished rack value — hit **$10M** to retire |

### Player actions

- **Vibe** — smoke break; sanity ↑; the only thing you're qualified for

### Agent jobs (assign idle agents)

- **Code** — story points on tickets; bigger models succeed more often
- **Review** — one pass per PR (~half expected coding time); spawns absurd review comments that coders must address to reduce merge damage
- **Refine** — split big tickets; small models botch it sometimes
- **Refactor** — slowly raises project quality while assigned (always available on active projects)
- **Test** — QA each merged task as it lands; 5× faster than coding

### Manager actions

- **Merge / Just Merge** — sign off on PRs after review (resolved comments reduce quality hit; Just Merge skips all of that)

### Agents

- **Local shelf models** — free, RAM-hungry, capped tick speed
- **Fabulous5 cloud** — tokens per tick, 1 tick/sec, actually useful
- **Context window** fills per tick; overflow → auto-compaction (30s pause, context reset)
- One agent per ticket; parallelism via Refine only

### Projects & clients

- Multiple concurrent projects with per-project **quality** and **deadlines**
- Leads expire; ghosting them hurts reputation
- Late delivery: rep hit, late fee, extension — escalating shame
- Scripted tutorial gig on day one

### Hardware & housing

- **Mark Mini → Mark STFU.io → CUDA Cluster** server racks
- Apartment size caps rack slots; bigger flat = higher rent + more RAM
- GPU upgrades boost local tick speed (hard capped)

Progress saves automatically to `localStorage` (`office404-save-v2`). Returning after being away applies offline progress (capped at 8 hours).

## Tech stack

- **Vite + React + TypeScript**
- **Zustand** for game state & persistence
- **vite-plugin-pwa** for installable mobile PWA support

## Project structure

```
src/
  game/          # Types, constants, models, projects, store, tick logic
  components/    # UI panels
  hooks/         # Game tick & offline progress
```

## Roadmap ideas

- **Blood, Sweat and Fears** DLC — hardware repair, more pain
- Prestige / "Pivot to B2B" reset layer
- Agent memory fragments & personality evolution
- Mini-events and narrative choices
- Sound design (notification pings, crash sounds, elevator muzak)

---

*Solo freelance · Multiple deadlines · Questionable merges*
