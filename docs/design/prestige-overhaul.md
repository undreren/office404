# Prestige & Hallucination Overhaul

Design spec from grilling session (Jul 2026). Full implementation target.

## Core loop

- **Prestige** replaces $10M win. Retire at personal cash threshold → earn hallucination points → new run.
- Only **hallucination points / meta unlocks** persist (plus `highestRungEver`, `retirementCount`, `singularityCount`).
- **Singularity ending** (Dyson + psychosis): meta wipe, NG+ cosmetics, optional uncle tutorial again.

## Retirement & hallucination points

- Personal threshold: `$1M × 1.1^retirementCount`.
- Global ladder rung `k`: `$1M × 1.1^(k-1)`.
- Points on retire = new rungs crossed above `highestRungEver` (not re-grinding old rungs).
- Cash-only gate (not MRR valuation).

## Hallucination shop (level-based, exponential cost per category)

Tracks: model (4B→5B…), context, compaction, starting capital, in-house unlock, procurement, customer, PM, project slots, fine-tunes, etc.

## Mid-run economy

- **RAM** = +1 agent slot, exponential cash cost, housing-gated.
- **GPU** = +1 tick/sec global pool, uncapped split across active workers.
- **Model** = prestige-only; baseline 4B recalibrated to old 1B power (`effectiveParams = params/4`).
- **(params/SP)²** penalty on code/test; sqrt on refine/review.
- Client tasks max **89 SP**; big gigs = many requirements. Payment = total SP × formula.
- **Plateau signal**: next major upgrade ≥ **2 hours** of income.

## In-house product

- Unlocked via hallucinations (expensive; mid-late meta).
- Same pipeline; **Ship** adds MRR: `sqrt(SP) × baseRate × (1 + 0.02 × featuresShipped)`.
- Uncapped monolith SP (not 89 cap).

## Automation agents

All useful **without** hallucinations; hallucination tiers amplify.

| Agent | Base | Hallucination |
|-------|------|---------------|
| Conductor | Per-project auto-staff | Super-conductor (cross-project) |
| PM | +1 slot, deadline UI | Dup project, parallel reqs, product slots |
| Sales | Auto-accept real leads | Synthetic accept/deliver |
| Marketing | Faster/bigger real leads | Synthetic rate (needs customer) |
| Customer | Lead enrichment, +10% negotiate | Synthetic multiplier for marketing |
| Accounting | +% client pay | Tax code in-house mini-gigs |
| Procurement | Auto-buy <10% cash | Hallucinate upgrade types |

## Compaction handoff

On overflow: task unassigned (progress kept), agent reboots 30s (reducible via meta).

## Housing (12 tiers)

Cardboard → … → Dyson Sphere (~3 decillion move). Decimal cash formatting.

## Rep

Floor 0, no game over. Rep 0 = trash leads (tiny SP, low pay).

## Tutorial

**Your Uncle's Totally Legal Web Shop** — once per singularity cycle. Prestige runs start with $200 + meta capital bonuses.

## Unhinged text

Copy derangement scales with total hallucinations earned across all runs.
