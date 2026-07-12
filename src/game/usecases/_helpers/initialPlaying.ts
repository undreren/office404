import { createInitialState } from '../../simulation/gameLogic'
import type { GameState } from '../../types'
import { SEED, T0 } from './testConstants'

export function initialPlaying(seed: number = SEED): GameState {
  return createInitialState(T0, seed)
}
