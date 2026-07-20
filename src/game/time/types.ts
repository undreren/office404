import type { GameMessage } from '../engine/Message'

/** Result of advancing a composite toward a wall-clock target (unix ms). */
export interface AdvanceTimeResult<T> {
  value: T
  messages: GameMessage[]
  timestamp: number
}

export type AdvanceTimeFn<T> = (value: T, targetTime: number) => AdvanceTimeResult<T>
