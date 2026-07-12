import { LEAD_SPAWN_INTERVAL_DAYS } from '../../constants'
import type { GameState } from '../../types'
import { advanceGameDays } from './advanceGameDays'
import { initialPlaying } from './initialPlaying'
import { SEED, T0 } from './testConstants'

export function stateWithAvailableLead(seed: number = SEED): GameState {
  const state = initialPlaying(seed)
  return advanceGameDays(state, LEAD_SPAWN_INTERVAL_DAYS, T0 + 1000)
}
