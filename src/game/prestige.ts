import type { MetaProgress } from './meta'
import { getHallucinationLevel } from './meta'
import { STARTING_CAPITAL_BONUS_PER_LEVEL } from './constants'

export { getHallucinationLevel } from './meta'

export const LADDER_BASE_CASH = 1_000_000
export const LADDER_GROWTH = 1.1
export const PLATEAU_HOURS = 2
export const PRESTIGE_START_CASH = 200

export const PIPELINE_HALLUCINATION_MAX_LEVEL = 4
export const TIME_DISTILLATION_MAX_LEVEL = 5
export const GPU_EFFICIENCY_HALLUCINATION_MAX_LEVEL = 4
export const RAM_EFFICIENCY_HALLUCINATION_MAX_LEVEL = 5
export const AFFORDABLE_HOUSING_MAX_LEVEL = 9

export const PIPELINE_HALLUCINATION_TRACKS = ['refine', 'code', 'review', 'test'] as const
export type PipelineHallucinationTrack = (typeof PIPELINE_HALLUCINATION_TRACKS)[number]

/** Hallucination shop tracks and costs. */
export const HALLUCINATION_TRACKS = [
  'model',
  'context',
  'compaction',
  'time_distillation',
  'starting_capital',
  'starting_ram',
  'starting_gpu',
  'affordable_housing',
  'gpu_efficiency',
  'ram_efficiency',
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
    description:
      '+1B effective parameters per level (4B base). Higher token output per second and more RAM per agent.',
  },
  context: {
    label: 'Context window',
    tagline: "It's not forgetting — it's prioritizing.",
    description: 'Multiplies agent context capacity: 4,000 × (1 + level) tokens (4k → 8k → 12k …).',
  },
  compaction: {
    label: 'Faster compaction',
    tagline: 'Turn the existential crisis down to a brisk panic.',
    description: '−5s context reboot time per level after overflow (30s base, 5s minimum).',
  },
  time_distillation: {
    label: 'Time distillation',
    tagline: 'Distill models that can distill time.',
    maxLevel: 5,
    description: '+1× game time speed per level (1 day/min base → 2, 3, … days/min). Rent, deadlines, and agents all run hotter.',
  },
  starting_capital: {
    label: 'Starting capital',
    tagline: 'Inherited trauma, inherited liquidity.',
    description: `+$${STARTING_CAPITAL_BONUS_PER_LEVEL.toLocaleString()} cash immediately on purchase, and on each new run after retirement.`,
  },
  starting_ram: {
    label: 'Starting RAM',
    tagline: 'Pre-installed headcount. No interview loop.',
    description:
      '+10 GB RAM immediately on purchase, and on each new run after retirement. Free capacity — does not count toward shop RAM limits or pricing.',
  },
  starting_gpu: {
    label: 'Starting GPU',
    tagline: 'Silicon you definitely paid for. Probably.',
    description:
      '+1 GPU tick immediately on purchase, and on each new run after retirement. Free capacity — does not count toward shop GPU limits or pricing.',
  },
  affordable_housing: {
    label: 'Affordable Housing',
    tagline: 'Rent control, but the controller is a language model.',
    maxLevel: AFFORDABLE_HOUSING_MAX_LEVEL,
    description: '−10% rent and move-in costs per level (90% off at max).',
  },
  gpu_efficiency: {
    label: 'CUDA mirage',
    tagline: 'The benchmark said 4090. The invoice said hope.',
    description:
      '+0.25× effective GPU count per level (1× base). Your silicon works harder because you believe in it.',
    maxLevel: GPU_EFFICIENCY_HALLUCINATION_MAX_LEVEL,
  },
  ram_efficiency: {
    label: 'Quantized dreams',
    tagline: '4-bit weights, 100% confidence.',
    description:
      '−0.1× model RAM footprint per level (1× base). Models need less RAM when you squint at the tensor chart.',
    maxLevel: RAM_EFFICIENCY_HALLUCINATION_MAX_LEVEL,
  },
  in_house: {
    label: 'In-house product',
    tagline: 'Build your own pyramid scheme. Call it a platform.',
    description:
      'Level 1 unlocks the Product tab. Each level adds +1 concurrent in-house product slot. Ship features for MRR (√SP × $8/day base, scaled by housing).',
  },
  procurement: {
    label: 'Procurement AI',
    tagline: 'One-click regret purchases.',
    maxLevel: 1,
    description:
      'Unlock the procurement specialist without buying the vibing course. When assigned, auto-buys housing, RAM, GPU, fine-tunes, and courses costing ≤10% of cash.',
  },
  customer: {
    label: 'Customer agent',
    tagline: 'The leads are coming from inside the GPU.',
    description:
      'Unlock the customer specialist. When assigned, +10% negotiated pay per level on accepted leads. Level 3+ unlocks Singularity at Dyson Sphere. Enables synthetic leads with Marketing.',
  },
  project_manager: {
    label: 'Project manager',
    tagline: 'Agile ceremonies, but the stand-up is just you crying.',
    description:
      'Unlock the PM specialist. When assigned, auto-delivers completed client projects. Each level adds +1 in-house product slot (requires In-house). Does not add client project slots.',
  },
  project_slots: {
    label: 'Client project slots',
    tagline: 'More Jira boards. Same amount of sleep.',
    description: '+1 concurrent client project slot per level. Independent of the PM specialist.',
  },
  refine: {
    label: 'Idealized requirements',
    tagline: 'The brief was perfect. You merely discovered it.',
    description:
      'Splits new projects into smaller requirement chunks for longer — high-SP gigs need more reputation to appear.',
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
    description: 'Review spawns −1 comment task per level (minimum zero).',
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
    maxLevel: 1,
    description:
      'Unlock the sales specialist without buying the vibing course. When assigned, auto-accepts eligible real leads; also accepts synthetic leads.',
  },
  marketing: {
    label: 'Marketing boost',
    tagline: 'Our funnel is optimized. We do not discuss the funnel.',
    description:
      'Unlock the marketing specialist. When assigned, +10% lead scope per level and faster synthetic lead spawns (requires Customer hallucination).',
  },
  accounting: {
    label: 'Accounting tricks',
    tagline: 'Creative deductions since Tuesday.',
    description:
      'Unlock the accounting specialist. When assigned, +5% client payout per level on delivery.',
  },
  super_conductor: {
    label: 'Super conductor',
    tagline: 'One babysitter to rule them all.',
    maxLevel: 1,
    description:
      'While the PM specialist is on duty, client projects use conductor automation without staffing a conductor agent.',
  },
}

const TRACK_BASE_COST: Record<HallucinationTrack, number> = {
  model: 1,
  context: 1,
  compaction: 2,
  time_distillation: 2,
  starting_capital: 1,
  starting_ram: 2,
  starting_gpu: 2,
  affordable_housing: 1,
  gpu_efficiency: 2,
  ram_efficiency: 2,
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

/** Cash required to earn the next hallucination point on retirement. */
export function nextHallucinationPointCashThreshold(highestRungEver: number): number {
  return rungCashThreshold(highestRungEver + 1)
}

/** @deprecated Prefer nextHallucinationPointCashThreshold — kept for call-site clarity. */
export function personalRetirementThreshold(highestRungEver: number): number {
  return nextHallucinationPointCashThreshold(highestRungEver)
}

/** New hallucination points from this retirement cash. */
export function hallucinationPointsFromRetirement(cash: number, highestRungEver: number): number {
  const cleared = rungsClearedByCash(cash)
  return Math.max(0, cleared - highestRungEver)
}

export function nextHighestRung(cash: number, highestRungEver: number): number {
  return Math.max(highestRungEver, rungsClearedByCash(cash))
}

export function canRetire(cash: number, highestRungEver: number): boolean {
  return cash >= nextHallucinationPointCashThreshold(highestRungEver)
}

export function hallucinationUpgradeCost(track: HallucinationTrack, currentLevel: number): number {
  if (track === 'affordable_housing') return currentLevel + 1
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

export function gpuEfficiencyHallucinationMultiplier(meta: MetaProgress): number {
  return (
    1 +
    Math.min(getHallucinationLevel(meta, 'gpu_efficiency'), GPU_EFFICIENCY_HALLUCINATION_MAX_LEVEL) *
      0.25
  )
}

export function ramEfficiencyHallucinationMultiplier(meta: MetaProgress): number {
  return (
    1 -
    Math.min(getHallucinationLevel(meta, 'ram_efficiency'), RAM_EFFICIENCY_HALLUCINATION_MAX_LEVEL) *
      0.1
  )
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
  return getHallucinationLevel(meta, 'starting_capital') * STARTING_CAPITAL_BONUS_PER_LEVEL
}

export function startingRamBonus(meta: MetaProgress): number {
  return getHallucinationLevel(meta, 'starting_ram')
}

export function startingGpuBonus(meta: MetaProgress): number {
  return getHallucinationLevel(meta, 'starting_gpu')
}

export function compactionDurationSec(meta: MetaProgress): number {
  const level = getHallucinationLevel(meta, 'compaction')
  return Math.max(5, 30 - level * 5)
}

/** Multiplier on in-game time speed (days per real minute). Base 1, +1 per level. */
export function timeDistillationMultiplier(meta: MetaProgress): number {
  return 1 + Math.min(getHallucinationLevel(meta, 'time_distillation'), TIME_DISTILLATION_MAX_LEVEL)
}

export function hasInHouseUnlocked(meta: MetaProgress): boolean {
  return getHallucinationLevel(meta, 'in_house') >= 1
}

/** Base client columns before Parallel Vibes bonus. */
export function baseClientProjectSlots(meta: MetaProgress): number {
  return 1 + getHallucinationLevel(meta, 'project_slots')
}

export function parallelVibesTier(vibingCourseTiers: Partial<Record<string, number>>): number {
  return vibingCourseTiers.vibe_slots ?? 0
}

/** Upper bound for the Status slider — base slots plus Parallel Vibes tier. */
export function maxClientProjectSlotsCap(
  meta: MetaProgress,
  vibingCourseTiers: Partial<Record<string, number>> = {},
): number {
  return baseClientProjectSlots(meta) + parallelVibesTier(vibingCourseTiers)
}

/** Concurrent client gigs: base + prestige slots, plus player setting when Parallel Vibes is owned. */
export function maxClientProjectSlots(
  meta: MetaProgress,
  vibingCourseTiers: Partial<Record<string, number>> = {},
  maxClientProjects?: number,
): number {
  const base = baseClientProjectSlots(meta)
  const tier = parallelVibesTier(vibingCourseTiers)
  if (tier <= 0) return base
  const cap = base + tier
  const setting = maxClientProjects ?? base
  return Math.min(Math.max(setting, base), cap)
}

export function maxProductProjectSlots(meta: MetaProgress): number {
  if (!hasInHouseUnlocked(meta)) return 0
  return 1 + getHallucinationLevel(meta, 'in_house') - 1 + getHallucinationLevel(meta, 'project_manager')
}
