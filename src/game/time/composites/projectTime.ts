import { SECONDS_PER_GAME_DAY } from '../../constants'
import type { GameState, Project } from '../../types'
import type { AdvanceTimeResult } from '../types'
import { earliestAfter, stepBoundaryMs, wallMsForSimSec } from '../timeMath'

function projectEventBoundaries(state: GameState, project: Project): number[] {
  if (project.status !== 'active' || project.isLocked) return []
  if (project.daysRemaining <= 0) return []
  const simSec = project.daysRemaining * SECONDS_PER_GAME_DAY
  return [state.snapshotAt + wallMsForSimSec(state, simSec)]
}

/** Earliest wall-clock ms when a project deadline or late-fee event must pause simulation. */
export function timeToNextProject(project: Project, state: GameState): number {
  return earliestAfter(projectEventBoundaries(state, project), state.snapshotAt)
}

/** Probe when a project deadline or late-fee event must pause simulation. */
export function advanceProjectTime(
  project: Project,
  targetTime: number,
  state: GameState,
): AdvanceTimeResult<Project> {
  const timestamp = stepBoundaryMs(timeToNextProject(project, state), targetTime, state.snapshotAt)
  return { value: project, messages: [], timestamp }
}
