import { SECONDS_PER_GAME_DAY } from '../../constants'
import type { GameState } from '../../types'
import type { AdvanceTimeResult } from '../types'
import { wallMsForSimSec } from '../timeMath'

/** Probe when synthetic lead cooldown crosses zero. */
export function advanceLeadPipelineTime(state: GameState, targetTime: number): AdvanceTimeResult<GameState> {
  const from = state.snapshotAt
  if (targetTime <= from || !state.tutorialDone || state.syntheticLeadCooldown <= 0) {
    return { value: state, messages: [], timestamp: targetTime }
  }

  const simSec = state.syntheticLeadCooldown * SECONDS_PER_GAME_DAY
  const at = from + wallMsForSimSec(state, simSec)
  const timestamp = at <= targetTime ? at : targetTime
  return { value: state, messages: [], timestamp }
}
