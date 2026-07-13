import type { MetaProgress } from './meta'
import { getHallucinationLevel } from './meta'

export { getHallucinationLevel } from './meta'

export const LADDER_BASE_CASH = 1_000_000
export const LADDER_GROWTH = 1.1
export const RETIREMENT_THRESHOLD_GROWTH = 1.1
export const PLATEAU_HOURS = 2
export const PRESTIGE_START_CASH = 200

export const PIPELINE_HALLUCINATION_MAX_LEVEL = 4

export const PIPELINE_HALLUCINATION_TRACKS = ['refine', 'code', 'review', 'test'] as const
export type PipelineHallucinationTrack = (typeof PIPELINE_HALLUCINATION_TRACKS)[number]

/** Hallucination shop tracks and costs. */
export const HALLUCINATION_TRACKS = [
  'model',
  'context',
  'compaction',
  'starting_capital',
  'in_house',
  'procurement',
  'customer',
  'project_manager',
  'project_slots',
  'refine',
  'code',
  'review',
  'test',
  'sales',
  'marketing',
  'accounting',
  'super_conductor',
] as const

export type HallucinationTrack = (typeof HALLUCINATION_TRACKS)[number]

export interface HallucinationTrackDef {
  label: string
  tagline: string
  description: string
  maxLevel?: number
}

export const HALLUCINATION_TRACK_DEFS: Record<HallucinationTrack, HallucinationTrackDef> = {
  model: {
    label: 'Model tier',
    tagline: 'Bigger brains. Bigger invoices.',
    description: 'Unlock the next prestige model tier — more parameters, faster story points, wider context.',
  },
  context: {
    label: 'Context window',
    tagline: "It's not forgetting — it's prioritizing.",
    description: '+4k context per level before agents compact and reboot mid-sentence.',
  },
  compaction: {
    label: 'Faster compaction',
    tagline: 'Turn the existential crisis down to a brisk panic.',
    description: 'Agents recover from context overflow faster after each reboot.',
  },
  starting_capital: {
    label: 'Starting capital',
    tagline: 'Inherited trauma, inherited liquidity.',
    description: '+$500 starting cash per level on every new run after retirement.',
  },
  in_house: {
    label: 'In-house product',
    tagline: 'Build your own pyramid scheme. Call it a platform.',
    description: 'Unlock the Product tab and ship features for recurring MRR.',
  },
  procurement: {
    label: 'Procurement AI',
    tagline: 'One-click regret purchases.',
    description: 'Hallucinate new upgrade categories the procurement agent can auto-buy.',
  },
  customer: {
    label: 'Customer agent',
    tagline: 'The leads are coming from inside the GPU.',
    description: 'Synthetic lead multiplier and deeper customer-agent psychosis.',
  },
  project_manager: {
    label: 'Project manager',
    tagline: 'Agile ceremonies, but the stand-up is just you crying.',
    description: 'Duplicate client projects, parallel requirements, extra product slots.',
  },
  project_slots: {
    label: 'Client project slots',
    tagline: 'More Jira boards. Same amount of sleep.',
    description: '+1 concurrent client project per level.',
  },
  refine: {
    label: 'Idealized requirements',
    tagline: 'The brief was perfect. You merely discovered it.',
    description:
      'New projects spawn finer requirement chunks for longer — 89 SP monsters need much more rep to appear.',
    maxLevel: PIPELINE_HALLUCINATION_MAX_LEVEL,
  },
  code: {
    label: 'Better architecture',
    tagline: 'Microservices, macro delusions.',
    description: '+10% effective parameters on coding tasks per level. Stacks with cash fine-tunes.',
    maxLevel: PIPELINE_HALLUCINATION_MAX_LEVEL,
  },
  review: {
    label: 'Rubber-stamp engine',
    tagline: 'LGTM. Literally. No notes.',
    description: 'Review spawns −1 comment per level (minimum zero). Hallucinated quality, fewer nitpicks.',
    maxLevel: PIPELINE_HALLUCINATION_MAX_LEVEL,
  },
  test: {
    label: 'Coverage theater',
    tagline: 'We already tested that. In a previous timeline.',
    description:
      '+15% chance per level to instant-complete QA when a tester picks up a merged PR. Bug rolls still apply.',
    maxLevel: PIPELINE_HALLUCINATION_MAX_LEVEL,
  },
  sales: {
    label: 'Sales automation',
    tagline: 'Closed-Won Bot 3000.',
    description: 'Auto-accept synthetic leads and hallucinate deliverable ghost gigs.',
  },
  marketing: {
    label: 'Marketing boost',
    tagline: 'Our funnel is optimized. We do not discuss the funnel.',
    description: 'Faster synthetic lead spawn and bigger marketing hallucinations.',
  },
  accounting: {
    label: 'Accounting tricks',
    tagline: 'Creative deductions since Tuesday.',
    description: 'Unlock tax-code in-house mini-gigs and juicier payment hallucinations.',
  },
  super_conductor: {
    label: 'Super conductor',
    tagline: 'One babysitter to rule them all.',
    description: 'Cross-project conductor automation. (Coming soon — points accepted, delusion delivered later.)',
  },
}

const TRACK_BASE_COST: Record<HallucinationTrack, number> = {
  model: 1,
  context: 1,
  compaction: 2,
  starting_capital: 1,
  in_house: 3,
  procurement: 2,
  project_manager: 2,
  project_slots: 2,
  refine: 2,
  code: 2,
  review: 2,
  test: 2,
  customer: 5,
  sales: 2,
  marketing: 2,
  accounting: 2,
  super_conductor: 2,
}

const TRACK_COST_MULT = 2

export function isPipelineHallucinationTrack(track: HallucinationTrack): track is PipelineHallucinationTrack {
  return (PIPELINE_HALLUCINATION_TRACKS as readonly string[]).includes(track)
}

export function hallucinationTrackMaxLevel(track: HallucinationTrack): number | null {
  return HALLUCINATION_TRACK_DEFS[track].maxLevel ?? null
}

/** Rung k (1-based) cash threshold: 1M × 1.1^(k-1). */
export function rungCashThreshold(rung: number): number {
  if (rung <= 0) return 0
  return LADDER_BASE_CASH * Math.pow(LADDER_GROWTH, rung - 1)
}

/** Count ladder rungs cleared by cash amount. */
export function rungsClearedByCash(cash: number): number {
  if (cash < LADDER_BASE_CASH) return 0
  return Math.floor(Math.log(cash / LADDER_BASE_CASH) / Math.log(LADDER_GROWTH)) + 1
}

export function personalRetirementThreshold(retirementCount: number): number {
  return LADDER_BASE_CASH * Math.pow(RETIREMENT_THRESHOLD_GROWTH, retirementCount)
}

/** New hallucination points from this retirement cash. */
export function hallucinationPointsFromRetirement(cash: number, highestRungEver: number): number {
  const cleared = rungsClearedByCash(cash)
  return Math.max(0, cleared - highestRungEver)
}

export function nextHighestRung(cash: number, highestRungEver: number): number {
  return Math.max(highestRungEver, rungsClearedByCash(cash))
}

export function canRetire(cash: number, retirementCount: number): boolean {
  return cash >= personalRetirementThreshold(retirementCount)
}

export function hallucinationUpgradeCost(track: HallucinationTrack, currentLevel: number): number {
  const base = TRACK_BASE_COST[track]
  return Math.ceil(base * Math.pow(TRACK_COST_MULT, currentLevel))
}

export function canBuyHallucinationUpgrade(
  meta: MetaProgress,
  track: HallucinationTrack,
): boolean {
  const level = getHallucinationLevel(meta, track)
  const maxLevel = hallucinationTrackMaxLevel(track)
  if (maxLevel !== null && level >= maxLevel) return false
  const cost = hallucinationUpgradeCost(track, level)
  return meta.hallucinationPoints >= cost
}

export function buyHallucinationUpgrade(
  meta: MetaProgress,
  track: HallucinationTrack,
): MetaProgress | null {
  const level = getHallucinationLevel(meta, track)
  const maxLevel = hallucinationTrackMaxLevel(track)
  if (maxLevel !== null && level >= maxLevel) return null
  const cost = hallucinationUpgradeCost(track, level)
  if (meta.hallucinationPoints < cost) return null
  return {
    ...meta,
    hallucinationPoints: meta.hallucinationPoints - cost,
    hallucinationLevels: { ...meta.hallucinationLevels, [track]: level + 1 },
  }
}

export function refineHallucinationLevel(meta: MetaProgress): number {
  return Math.min(getHallucinationLevel(meta, 'refine'), PIPELINE_HALLUCINATION_MAX_LEVEL)
}

export function reviewHallucinationLevel(meta: MetaProgress): number {
  return Math.min(getHallucinationLevel(meta, 'review'), PIPELINE_HALLUCINATION_MAX_LEVEL)
}

export function codeHallucinationParamMultiplier(meta: MetaProgress): number {
  return 1 + Math.min(getHallucinationLevel(meta, 'code'), PIPELINE_HALLUCINATION_MAX_LEVEL) * 0.1
}

export function instantTestHallucinationChance(meta: MetaProgress): number {
  return Math.min(getHallucinationLevel(meta, 'test'), PIPELINE_HALLUCINATION_MAX_LEVEL) * 0.15
}

/** Prestige model params: 4B + 1B per model hallucination level. */
export function prestigeModelParams(meta: MetaProgress): number {
  return 4 + getHallucinationLevel(meta, 'model')
}

/** Effective params for SP — matches model size (4B → 4, 5B → 5, …). */
export function effectiveModelParams(meta: MetaProgress): number {
  return prestigeModelParams(meta)
}

export function startingCapitalBonus(meta: MetaProgress): number {
  return getHallucinationLevel(meta, 'starting_capital') * 500
}

export function compactionDurationSec(meta: MetaProgress): number {
  const level = getHallucinationLevel(meta, 'compaction')
  return Math.max(5, 30 - level * 5)
}

export function hasInHouseUnlocked(meta: MetaProgress): boolean {
  return getHallucinationLevel(meta, 'in_house') >= 1
}

/** Concurrent client gigs: one free slot, +1 per assigned PM, +hallucination project_slots. */
export function maxClientProjectSlots(meta: MetaProgress, assignedPmAgents: number): number {
  return 1 + assignedPmAgents + getHallucinationLevel(meta, 'project_slots')
}

export function maxProductProjectSlots(meta: MetaProgress): number {
  if (!hasInHouseUnlocked(meta)) return 0
  return 1 + getHallucinationLevel(meta, 'in_house') - 1 + getHallucinationLevel(meta, 'project_manager')
}
