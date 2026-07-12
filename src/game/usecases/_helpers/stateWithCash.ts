import type { GameState } from '../../types'

export function stateWithCash(state: GameState, amount: number): GameState {
  return { ...state, cash: amount }
}
