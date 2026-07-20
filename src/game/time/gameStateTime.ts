import type { GameState } from '../types'
import type { AdvanceTimeResult } from './types'
import { advanceGameStateStep } from './catchUp'
import { advanceAgentTime } from './composites/agentTime'
import { advanceCalendarTime } from './composites/calendarTime'
import { advanceLeadPipelineTime } from './composites/leadTime'
import { advanceProjectTime } from './composites/projectTime'
import { mergeAdvanceResults, syncChildAdvances } from './syncChildren'

export { advanceAgentTime } from './composites/agentTime'
export { advanceProjectTime } from './composites/projectTime'
export { advanceCalendarTime } from './composites/calendarTime'
export { advanceLeadPipelineTime } from './composites/leadTime'

/** Negotiate the next simulation step horizon from composite boundary probes. */
export function negotiateStepBoundary(state: GameState, targetTime: number): number {
  const childResults = [
    advanceCalendarTime(state, targetTime),
    advanceLeadPipelineTime(state, targetTime),
    ...state.projects.map((project) => advanceProjectTime(project, targetTime, state)),
    ...state.agents.map((agent) => advanceAgentTime(agent, targetTime, state)),
  ]
  return mergeAdvanceResults(childResults).timestamp
}

/**
 * Advance game state toward targetTime (unix ms) by one synchronized step.
 * Composites negotiate the step horizon; simulation emits tick events as messages.
 */
export function advanceTime(state: GameState, targetTime: number): AdvanceTimeResult<GameState> {
  return advanceGameStateStep(state, targetTime)
}

/** Synchronize agent composite probes (used when agents must re-negotiate after a partial step). */
export function syncAgentAdvances(
  state: GameState,
  targetTime: number,
): ReturnType<typeof syncChildAdvances<import('../types').Agent>> {
  const originals = state.agents
  const firstPass = originals.map((agent) => advanceAgentTime(agent, targetTime, state))
  return syncChildAdvances(originals, firstPass, (agent, ts) => advanceAgentTime(agent, ts, state))
}
