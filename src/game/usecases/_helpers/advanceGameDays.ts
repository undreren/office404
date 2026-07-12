import { SECONDS_PER_GAME_DAY } from '../../constants'
import { timeElapsed } from '../../messages'
import type { GameState } from '../../types'
import { dispatchChain } from './dispatchChain'

export function advanceGameDays(state: GameState, days: number, at: number): GameState {
  return dispatchChain(state, [timeElapsed(at, days * SECONDS_PER_GAME_DAY)])
}
