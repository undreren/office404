import { CATCHUP_MAX_STEP_MS, SECONDS_PER_GAME_DAY } from '../constants'
import { bestOfNStackMultiplier, taskTokensRequired } from '../mechanics'
import { compactionDurationSec } from '../prestige'
import {
  agentsPerTaskForProject,
  dispatchRefineTarget,
  stackIndexOnTask,
} from '../projects'
import type { Agent, GameState } from '../types'
import { agentOutputTokensPerSec, contextTokensForState } from '../simulation/tokenSimulation'
import { wallMsForSimSec } from './timeMath'

function candidate(boundaries: number[], targetTime: number, fromTime: number): number {
  const finite = boundaries.filter((t) => Number.isFinite(t) && t > fromTime && t <= targetTime)
  if (finite.length === 0) return targetTime
  return Math.min(targetTime, ...finite)
}

function compactionEndMs(state: GameState, agent: Agent): number | null {
  if (agent.status !== 'compacting' || agent.compactingRemainingSec <= 0) return null
  return state.snapshotAt + wallMsForSimSec(state, agent.compactingRemainingSec)
}

function contextOverflowMs(state: GameState, agent: Agent, agents: Agent[]): number | null {
  if (!agent.job || agent.job === 'conductor' || agent.isAutomation) return null
  if (agent.status === 'compacting' || agent.status === 'compacted' || agent.status === 'crashed') {
    return null
  }
  const tokens = contextTokensForState(state)
  if (agent.contextUsed >= tokens) return state.snapshotAt

  const tokensPerSec = agentOutputTokensPerSec(state, agent, agent.job, agents)
  if (tokensPerSec <= 0) return null

  const remaining = tokens - agent.contextUsed
  const simSecToFill = remaining / tokensPerSec
  return state.snapshotAt + wallMsForSimSec(state, simSecToFill)
}

function conductorMoveEndMs(state: GameState, agent: Agent, agents: Agent[]): number | null {
  if (agent.job !== 'conductor' || (agent.conductorMoveRemaining ?? 0) <= 0) return null
  const tokensPerSec = agentOutputTokensPerSec(state, agent, 'conductor', agents)
  if (tokensPerSec <= 0) return null
  const simSec = (agent.conductorMoveRemaining ?? 0) / tokensPerSec
  return state.snapshotAt + wallMsForSimSec(state, simSec)
}

function taskRoleCompleteMs(
  state: GameState,
  agent: Agent,
  agents: Agent[],
  earned: number,
  required: number,
  targetId?: string | null,
): number | null {
  if (!agent.job || agent.job === 'conductor' || agent.isAutomation) return null
  if (earned >= required) return state.snapshotAt
  const tokensPerSec = agentOutputTokensPerSec(state, agent, agent.job, agents)
  if (tokensPerSec <= 0) return null
  const stackIdx =
    targetId && agent.projectId
      ? stackIndexOnTask(agents, agent.projectId, agent.job, targetId, agent.id)
      : 0
  const simSec = (required - earned) / (tokensPerSec * bestOfNStackMultiplier(stackIdx))
  return state.snapshotAt + wallMsForSimSec(state, simSec)
}

function refineCompleteMs(state: GameState, agent: Agent, agents: Agent[]): number | null {
  if (agent.job !== 'refine' || !agent.projectId) return null
  const project = state.projects.find((p) => p.id === agent.projectId)
  if (!project || project.status !== 'active' || project.isLocked) return null

  const perTask = agentsPerTaskForProject(project, 'refine', agents, state.vibingCourseTiers)
  const target = dispatchRefineTarget(project, agent.id, agents, perTask, new Map())
  if (!target) return null

  const targetSp =
    target.kind === 'requirement' ? target.requirement.storyPoints : target.task.storyPointsRequired
  const savedProgress =
    target.kind === 'requirement'
      ? target.requirement.refineJobProgress ?? 0
      : target.task.refineJobProgress ?? 0
  const required = taskTokensRequired(targetSp, 'refine')
  const targetId = target.kind === 'requirement' ? target.requirement.id : target.task.id
  return taskRoleCompleteMs(state, agent, agents, savedProgress, required, targetId)
}

function nextRentBoundaryMs(state: GameState, targetTime: number): number | null {
  if (state.rentDueInDays <= 0) return state.snapshotAt
  const simSec = state.rentDueInDays * SECONDS_PER_GAME_DAY
  const at = state.snapshotAt + wallMsForSimSec(state, simSec)
  return at <= targetTime ? at : null
}

function projectDeadlineMs(state: GameState, daysRemaining: number): number | null {
  if (daysRemaining <= 0) return state.snapshotAt
  const simSec = daysRemaining * SECONDS_PER_GAME_DAY
  return state.snapshotAt + wallMsForSimSec(state, simSec)
}

/** Earliest wall-clock time at which simulation must pause before targetTime. */
export function findNextBoundaryMs(state: GameState, targetTime: number): number {
  if (state.phase !== 'playing') return targetTime

  const from = state.snapshotAt
  if (targetTime <= from) return from

  const boundaries: number[] = [from + CATCHUP_MAX_STEP_MS]

  const rentAt = nextRentBoundaryMs(state, targetTime)
  if (rentAt != null) boundaries.push(rentAt)

  for (const project of state.projects) {
    if (project.status !== 'active' || project.isLocked) continue
    const deadline = projectDeadlineMs(state, project.daysRemaining)
    if (deadline != null) boundaries.push(deadline)
  }

  const contextTokens = contextTokensForState(state)
  const compactDuration = compactionDurationSec(state.meta)

  for (const agent of state.agents) {
    const compactEnd = compactionEndMs(state, agent)
    if (compactEnd != null) boundaries.push(compactEnd)

    const conductorEnd = conductorMoveEndMs(state, agent, state.agents)
    if (conductorEnd != null) boundaries.push(conductorEnd)

    const overflow = contextOverflowMs(state, agent, state.agents)
    if (overflow != null) boundaries.push(overflow)

    if (agent.job === 'refine') {
      const at = refineCompleteMs(state, agent, state.agents)
      if (at != null) boundaries.push(at)
    }

    if (agent.job === 'code' && agent.taskId) {
      const task = state.projects.flatMap((p) => p.tasks).find((t) => t.id === agent.taskId)
      if (task) {
        const required = taskTokensRequired(task.storyPointsRequired, 'code')
        const at = taskRoleCompleteMs(
          state,
          agent,
          state.agents,
          task.storyPointsEarned,
          required,
          task.id,
        )
        if (at != null) boundaries.push(at)
      }
    }

    if (agent.job === 'review' && agent.taskId) {
      const task = state.projects.flatMap((p) => p.tasks).find((t) => t.id === agent.taskId)
      if (task) {
        const required = taskTokensRequired(task.storyPointsRequired, 'review')
        const earned = task.reviewJobProgress ?? 0
        const at = taskRoleCompleteMs(state, agent, state.agents, earned, required, task.id)
        if (at != null) boundaries.push(at)
      }
    }

    if (agent.job === 'test' && agent.taskId) {
      const task = state.projects.flatMap((p) => p.tasks).find((t) => t.id === agent.taskId)
      if (task) {
        const required = taskTokensRequired(task.storyPointsRequired, 'test')
        const at = taskRoleCompleteMs(
          state,
          agent,
          state.agents,
          task.testStoryPointsEarned,
          required,
          task.id,
        )
        if (at != null) boundaries.push(at)
      }
    }

    if (agent.contextUsed >= contextTokens && agent.status !== 'compacting') {
      boundaries.push(state.snapshotAt + wallMsForSimSec(state, compactDuration))
    }
  }

  if (state.tutorialDone && state.syntheticLeadCooldown > 0) {
    const simSec = state.syntheticLeadCooldown * SECONDS_PER_GAME_DAY
    boundaries.push(state.snapshotAt + wallMsForSimSec(state, simSec))
  }

  return candidate(boundaries, targetTime, from)
}
