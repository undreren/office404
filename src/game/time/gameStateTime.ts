import type { GameState } from '../types'
import type { AdvanceTimeResult } from './types'
import { advanceGameStateStep } from './catchUp'
import { advanceAgentTime, buildTimeProbeCache, timeToNextAgent } from './composites/agentTime'
import { advanceCalendarTime, timeToNextCalendar } from './composites/calendarTime'
import { advanceLeadPipelineTime, timeToNextLeadPipeline } from './composites/leadTime'
import { advanceProjectTime, timeToNextProject } from './composites/projectTime'
import { mergeAdvanceResults, syncChildAdvances } from './syncChildren'
import { TIME_NEVER } from './timeMath'

export { advanceAgentTime, timeToNextAgent } from './composites/agentTime'
export { advanceProjectTime, timeToNextProject } from './composites/projectTime'
export { advanceCalendarTime, timeToNextCalendar } from './composites/calendarTime'
export { advanceLeadPipelineTime, timeToNextLeadPipeline } from './composites/leadTime'

/** Earliest wall-clock ms when any child composite must pause simulation. */
export function timeToNextGameState(state: GameState): number {
  if (state.phase !== 'playing') return TIME_NEVER

  const probeCache = buildTimeProbeCache(state)
  const childTimes = [
    timeToNextCalendar(state),
    timeToNextLeadPipeline(state),
    ...state.projects.map((project) => timeToNextProject(project, state)),
    ...state.agents.map((agent) => timeToNextAgent(agent, state, probeCache)),
  ]
  const finite = childTimes.filter((t) => Number.isFinite(t))
  if (finite.length === 0) return TIME_NEVER
  return Math.min(...finite)
}

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
