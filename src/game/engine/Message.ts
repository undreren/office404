import type { GameState } from '../types'

export interface GameMessage {
  readonly at: number
  apply(state: GameState): GameState
}
