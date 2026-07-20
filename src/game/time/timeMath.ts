import { SECONDS_PER_GAME_DAY, TICK_INTERVAL_MS } from '../constants'
import { timeDistillationMultiplier } from '../prestige'
import type { GameState } from '../types'

/** Wall-clock ms when no further simulation events are scheduled. */
export const TIME_NEVER = Number.POSITIVE_INFINITY

/** Earliest timestamp strictly after `afterMs`, or TIME_NEVER when none. */
export function earliestAfter(boundaries: readonly number[], afterMs: number): number {
  const future = boundaries.filter((t) => Number.isFinite(t) && t > afterMs)
  if (future.length === 0) return TIME_NEVER
  return Math.min(...future)
}

/** Catch-up step horizon: min(target, next event), or target when nothing is scheduled. */
export function stepBoundaryMs(timeToNext: number, targetTime: number, afterMs: number): number {
  if (!Number.isFinite(timeToNext) || timeToNext <= afterMs) return targetTime
  return Math.min(targetTime, timeToNext)
}

/** Real milliseconds corresponding to simulated seconds at the current distillation rate. */
export function wallMsForSimSec(state: GameState, simSec: number): number {
  const distillation = timeDistillationMultiplier(state.meta)
  if (distillation <= 0) return Number.POSITIVE_INFINITY
  return (simSec / distillation) * 1000
}

/** Simulated seconds for a wall-clock millisecond span. */
export function simSecForWallMs(state: GameState, wallMs: number): number {
  return (wallMs / 1000) * timeDistillationMultiplier(state.meta)
}

export function gameDayAt(state: GameState): number {
  return state.gameDay
}

export function isCaughtUp(state: GameState, now: number): boolean {
  return now - state.snapshotAt < TICK_INTERVAL_MS
}

export function clampTarget(state: GameState, targetTime: number): number {
  return Math.max(state.snapshotAt, targetTime)
}

export function gameSecElapsedAt(state: GameState): number {
  return state.gameDay * SECONDS_PER_GAME_DAY
}
