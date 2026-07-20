import type { Agent, GameState } from '../types'
import type { AdvanceTimeResult } from './types'
import { findNextBoundaryMs } from './nextBoundary'
import { advanceGameStateStep } from './catchUp'

/**
 * Advance game state toward targetTime (unix ms) by one synchronized step.
 * Composites negotiate the step horizon via findNextBoundaryMs; simulation runs once per step.
 */
export function advanceTime(state: GameState, targetTime: number): AdvanceTimeResult<GameState> {
  return advanceGameStateStep(state, targetTime)
}

/** Probe when an agent would next emit a time-driven event (compaction, task done, etc.). */
export function advanceAgentTime(agent: Agent, targetTime: number, state: GameState): AdvanceTimeResult<Agent> {
  const scoped: GameState = { ...state, agents: [agent] }
  const boundary = findNextBoundaryMs(scoped, targetTime)
  return { value: agent, messages: [], timestamp: boundary }
}
