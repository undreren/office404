import type { GameState } from '../../types'
import { initialPlaying } from './initialPlaying'

/** Single-agent capacity: starter laptop can only host one agent. */
export function stateAtAgentCapacity(seed?: number): GameState {
  return initialPlaying(seed)
}
