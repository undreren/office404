import type { GameState, Project } from '../../types'
import type { AdvanceTimeResult } from '../types'
import { findNextBoundaryMs } from '../nextBoundary'

/** Probe when a project would next emit a time-driven event (deadline, task completion, etc.). */
export function advanceProjectTime(
  project: Project,
  targetTime: number,
  state: GameState,
): AdvanceTimeResult<Project> {
  const scoped: GameState = { ...state, projects: [project] }
  const boundary = findNextBoundaryMs(scoped, targetTime)
  return { value: project, messages: [], timestamp: boundary }
}
