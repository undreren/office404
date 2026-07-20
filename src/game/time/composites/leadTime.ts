import { SECONDS_PER_GAME_DAY } from '../../constants'
import type { GameState } from '../../types'
import type { AdvanceTimeResult } from '../types'
import { earliestAfter, stepBoundaryMs, wallMsForSimSec } from '../timeMath'

function leadPipelineEventBoundaries(state: GameState): number[] {
  if (!state.tutorialDone || state.syntheticLeadCooldown <= 0) return []
  const simSec = state.syntheticLeadCooldown * SECONDS_PER_GAME_DAY
  return [state.snapshotAt + wallMsForSimSec(state, simSec)]
}

/** Earliest wall-clock ms when synthetic lead cooldown crosses zero. */
export function timeToNextLeadPipeline(state: GameState): number {
  return earliestAfter(leadPipelineEventBoundaries(state), state.snapshotAt)
}

/** Probe when synthetic lead cooldown crosses zero. */
export function advanceLeadPipelineTime(state: GameState, targetTime: number): AdvanceTimeResult<GameState> {
  const from = state.snapshotAt
  if (targetTime <= from) return { value: state, messages: [], timestamp: from }

  const timestamp = stepBoundaryMs(timeToNextLeadPipeline(state), targetTime, from)
  return { value: state, messages: [], timestamp }
}
