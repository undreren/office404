import { SECONDS_PER_GAME_DAY, TICK_INTERVAL_MS } from '../constants'
import { timeDistillationMultiplier } from '../prestige'
import type { GameState } from '../types'

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
