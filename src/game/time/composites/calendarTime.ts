import { SECONDS_PER_GAME_DAY } from '../../constants'
import type { GameState } from '../../types'
import type { AdvanceTimeResult } from '../types'
import { wallMsForSimSec } from '../timeMath'

function nextRentBoundaryMs(state: GameState, targetTime: number): number | null {
  if (state.rentDueInDays <= 0) return state.snapshotAt
  const simSec = state.rentDueInDays * SECONDS_PER_GAME_DAY
  const at = state.snapshotAt + wallMsForSimSec(state, simSec)
  return at <= targetTime ? at : null
}

/** Probe when calendar-driven events (rent) must pause simulation. */
export function advanceCalendarTime(state: GameState, targetTime: number): AdvanceTimeResult<GameState> {
  const from = state.snapshotAt
  if (targetTime <= from) return { value: state, messages: [], timestamp: from }

  const rentAt = nextRentBoundaryMs(state, targetTime)
  const timestamp = rentAt ?? targetTime
  return { value: state, messages: [], timestamp }
}
