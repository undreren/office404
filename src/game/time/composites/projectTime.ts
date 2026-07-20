import { SECONDS_PER_GAME_DAY } from '../../constants'
import type { GameState, Project } from '../../types'
import type { AdvanceTimeResult } from '../types'
import { wallMsForSimSec } from '../timeMath'

function projectDeadlineMs(state: GameState, daysRemaining: number): number | null {
  if (daysRemaining <= 0) return state.snapshotAt
  const simSec = daysRemaining * SECONDS_PER_GAME_DAY
  return state.snapshotAt + wallMsForSimSec(state, simSec)
}

function probeProjectBoundaryMs(state: GameState, project: Project, targetTime: number): number {
  const from = state.snapshotAt
  if (project.status !== 'active' || project.isLocked) return targetTime

  const deadline = projectDeadlineMs(state, project.daysRemaining)
  if (deadline == null || deadline <= from || deadline > targetTime) return targetTime
  return deadline
}

/** Probe when a project deadline or late-fee event must pause simulation. */
export function advanceProjectTime(
  project: Project,
  targetTime: number,
  state: GameState,
): AdvanceTimeResult<Project> {
  const timestamp = probeProjectBoundaryMs(state, project, targetTime)
  return { value: project, messages: [], timestamp }
}
