import { SECONDS_PER_GAME_DAY } from '../../constants'
import type { GameState } from '../../types'
import type { AdvanceTimeResult } from '../types'
import { earliestAfter, stepBoundaryMs, TIME_NEVER, wallMsForSimSec } from '../timeMath'

function calendarEventBoundaries(state: GameState): number[] {
  if (state.rentDueInDays <= 0) return []
  const simSec = state.rentDueInDays * SECONDS_PER_GAME_DAY
  return [state.snapshotAt + wallMsForSimSec(state, simSec)]
}

/** Earliest wall-clock ms when calendar-driven events (rent) must pause simulation. */
export function timeToNextCalendar(state: GameState): number {
  const boundaries = calendarEventBoundaries(state)
  if (boundaries.length === 0) return TIME_NEVER
  return earliestAfter(boundaries, state.snapshotAt)
}

/** Probe when calendar-driven events (rent) must pause simulation. */
export function advanceCalendarTime(state: GameState, targetTime: number): AdvanceTimeResult<GameState> {
  const from = state.snapshotAt
  if (targetTime <= from) return { value: state, messages: [], timestamp: from }

  const timestamp = stepBoundaryMs(timeToNextCalendar(state), targetTime, from)
  return { value: state, messages: [], timestamp }
}
