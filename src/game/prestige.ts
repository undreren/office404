import type { MetaProgress } from './meta'
import { getHallucinationLevel } from './meta'

export { getHallucinationLevel } from './meta'

export const LADDER_BASE_CASH = 1_000_000
export const LADDER_GROWTH = 1.1
export const RETIREMENT_THRESHOLD_GROWTH = 1.1
export const PLATEAU_HOURS = 2
export const PRESTIGE_START_CASH = 200

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
  'fine_tune',
  'sales',
  'marketing',
  'accounting',
  'super_conductor',
] as const

export type HallucinationTrack = (typeof HALLUCINATION_TRACKS)[number]

const TRACK_BASE_COST: Record<HallucinationTrack, number> = {
  model: 1,
  context: 1,
  compaction: 2,
  starting_capital: 1,
  in_house: 3,
  procurement: 2,
  project_manager: 2,
  project_slots: 2,
  fine_tune: 1,
  customer: 5,
  sales: 2,
  marketing: 2,
  accounting: 2,
  super_conductor: 2,
}

const TRACK_COST_MULT = 2

export function hallucinationUpgradeCost(track: HallucinationTrack, currentLevel: number): number {
  const base = TRACK_BASE_COST[track]
  return Math.ceil(base * Math.pow(TRACK_COST_MULT, currentLevel))
}

export function canBuyHallucinationUpgrade(
  meta: MetaProgress,
  track: HallucinationTrack,
): boolean {
  const level = getHallucinationLevel(meta, track)
  const cost = hallucinationUpgradeCost(track, level)
  return meta.hallucinationPoints >= cost
}

export function buyHallucinationUpgrade(
  meta: MetaProgress,
  track: HallucinationTrack,
): MetaProgress | null {
  const level = getHallucinationLevel(meta, track)
  const cost = hallucinationUpgradeCost(track, level)
  if (meta.hallucinationPoints < cost) return null
  return {
    ...meta,
    hallucinationPoints: meta.hallucinationPoints - cost,
    hallucinationLevels: { ...meta.hallucinationLevels, [track]: level + 1 },
  }
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

export function maxClientProjectSlots(meta: MetaProgress, vibingPmTiers: number): number {
  return 1 + vibingPmTiers + getHallucinationLevel(meta, 'project_slots')
}

export function maxProductProjectSlots(meta: MetaProgress): number {
  if (!hasInHouseUnlocked(meta)) return 0
  return 1 + getHallucinationLevel(meta, 'in_house') - 1 + getHallucinationLevel(meta, 'project_manager')
}
