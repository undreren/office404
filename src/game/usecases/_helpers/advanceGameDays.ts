import { SECONDS_PER_GAME_DAY } from '../../constants'
import { timeElapsed } from '../../messages'
import type { GameState } from '../../types'
import { dispatchChain } from './dispatchChain'

/** Advance until a lead spawns without waiting on a cooldown timer. */
export function advanceUntilLeadSpawns(state: GameState, at: number): GameState {
  return dispatchChain(state, [timeElapsed(at, 0.01 * SECONDS_PER_GAME_DAY)])
}

export function advanceGameDays(state: GameState, days: number, at: number): GameState {
  return dispatchChain(state, [timeElapsed(at, days * SECONDS_PER_GAME_DAY)])
}
