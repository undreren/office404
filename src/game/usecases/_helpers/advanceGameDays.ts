import { LEAD_SPAWN_INTERVAL_DAYS, SECONDS_PER_GAME_DAY } from '../../constants'
import { timeElapsed } from '../../messages'
import type { GameState } from '../../types'
import { dispatchChain } from './dispatchChain'

/** Advance until lead spawn cooldown fires without expiring the new lead in the same tick. */
export function advanceUntilLeadSpawns(state: GameState, at: number): GameState {
  const almost = LEAD_SPAWN_INTERVAL_DAYS - 0.01
  let next = dispatchChain(state, [timeElapsed(at, almost * SECONDS_PER_GAME_DAY)])
  next = dispatchChain(next, [timeElapsed(at + 1, 0.01 * SECONDS_PER_GAME_DAY)])
  return next
}

export function advanceGameDays(state: GameState, days: number, at: number): GameState {
  return dispatchChain(state, [timeElapsed(at, days * SECONDS_PER_GAME_DAY)])
}
