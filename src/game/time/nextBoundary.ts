import { CATCHUP_MAX_STEP_MS } from '../constants'
import type { GameState } from '../types'
import { advanceAgentTime } from './composites/agentTime'
import { advanceCalendarTime } from './composites/calendarTime'
import { advanceLeadPipelineTime } from './composites/leadTime'
import { advanceProjectTime } from './composites/projectTime'
import { mergeAdvanceResults } from './syncChildren'

function candidate(boundaries: number[], targetTime: number, fromTime: number): number {
  const finite = boundaries.filter((t) => Number.isFinite(t) && t > fromTime && t <= targetTime)
  if (finite.length === 0) return targetTime
  return Math.min(targetTime, ...finite)
}

/** Earliest wall-clock time at which simulation must pause before targetTime. */
export function findNextBoundaryMs(state: GameState, targetTime: number): number {
  if (state.phase !== 'playing') return targetTime

  const from = state.snapshotAt
  if (targetTime <= from) return from

  const childResults = [
    advanceCalendarTime(state, targetTime),
    advanceLeadPipelineTime(state, targetTime),
    ...state.projects.map((project) => advanceProjectTime(project, targetTime, state)),
    ...state.agents.map((agent) => advanceAgentTime(agent, targetTime, state)),
  ]

  const { timestamp: childBoundary } = mergeAdvanceResults(childResults)
  return candidate([childBoundary, from + CATCHUP_MAX_STEP_MS], targetTime, from)
}
