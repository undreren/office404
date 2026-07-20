import type { GameMessage } from '../engine/Message'
import type { GameState } from '../types'

/** Result of advancing simulation by a fixed real-second delta. */
export type SimulationDeltaResult = {
  state: GameState
  messages: GameMessage[]
}
