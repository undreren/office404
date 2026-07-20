/** Idle-game cash formatting and safe math for large values. */

import type { MetaProgress } from './meta'
import { SECONDS_PER_GAME_DAY } from './constants'
import { timeDistillationMultiplier } from './prestige'

const SUFFIXES = [
  '',
  'K',
  'M',
  'B',
  'T',
  'Qa',
  'Qi',
  'Sx',
  'Sp',
  'Oc',
  'No',
  'De',
  'UDe',
  'DDe',
  'TDe',
  'QaDe',
  'QiDe',
  'SxDe',
  'SpDe',
  'OcDe',
  'NoDe',
  'Vg',
] as const

export function formatCash(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '$0'
  if (amount < 1000) return `$${Math.floor(amount)}`
  const tier = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(amount) / 3))
  const scaled = amount / Math.pow(10, tier * 3)
  const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2
  return `$${scaled.toFixed(decimals)}${SUFFIXES[tier]}`
}

export function cashGte(a: number, b: number): boolean {
  return a >= b
}

export function addCash(a: number, b: number): number {
  return a + b
}

export function subCash(a: number, b: number): number {
  return a - b
}

/** Income per game-day from all sources. */
export function estimateIncomePerGameDay(mrr: number): number {
  return mrr
}

/** Seconds of game time per real second. */
export function gameDaysPerRealSecond(meta?: MetaProgress): number {
  const mult = meta ? timeDistillationMultiplier(meta) : 1
  return mult / SECONDS_PER_GAME_DAY
}
