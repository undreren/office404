import type { GameState } from '../types'
import { timeToNextGameState } from './gameStateTime'
import { stepBoundaryMs } from './timeMath'

/** Earliest wall-clock time at which simulation must pause before targetTime. */
export function findNextBoundaryMs(state: GameState, targetTime: number): number {
  if (state.phase !== 'playing') return targetTime

  const from = state.snapshotAt
  if (targetTime <= from) return from

  return stepBoundaryMs(timeToNextGameState(state), targetTime, from)
}
