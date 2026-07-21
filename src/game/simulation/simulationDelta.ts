import type { GameMessage } from '../engine/Message'
import type { GameEvent, GameState } from '../types'

export type AdvanceSimulationOptions = {
  /** Skip per-tick dispatch messages; return raw events for batched catch-up. */
  eventsOnly?: boolean
  /** Skip tick event emission entirely (offline catch-up fast path). */
  silent?: boolean
}

/** Result of advancing simulation by a fixed real-second delta. */
export type SimulationDeltaResult = {
  state: GameState
  messages: GameMessage[]
  events: GameEvent[]
}
