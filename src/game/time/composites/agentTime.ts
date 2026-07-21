import { bestOfNStackMultiplier, taskTokensRequired } from '../../mechanics'
import { compactionDurationSec } from '../../prestige'
import {
  agentsPerTaskForProject,
  dispatchRefineTarget,
  stackIndexOnTask,
} from '../../projects'
import type { Agent, GameState, Project, Task } from '../../types'
import { agentOutputTokensPerSec, contextTokensForState } from '../../simulation/tokenSimulation'
import type { AdvanceTimeResult } from '../types'
import { earliestAfter, stepBoundaryMs, wallMsForSimSec } from '../timeMath'

export type TimeProbeCache = {
  tasksById: Map<string, Task>
  projectsById: Map<string, Project>
}

export function buildTimeProbeCache(state: GameState): TimeProbeCache {
  const tasksById = new Map<string, Task>()
  const projectsById = new Map<string, Project>()
  for (const project of state.projects) {
    projectsById.set(project.id, project)
    for (const task of project.tasks) {
      tasksById.set(task.id, task)
    }
  }
  return { tasksById, projectsById }
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

function refineCompleteMs(
  state: GameState,
  agent: Agent,
  agents: Agent[],
  cache: TimeProbeCache,
): number | null {
  if (agent.job !== 'refine' || !agent.projectId) return null
  const project = cache.projectsById.get(agent.projectId)
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

function agentEventBoundaries(state: GameState, agent: Agent, cache: TimeProbeCache): number[] {
  const boundaries: number[] = []
  const contextTokens = contextTokensForState(state)
  const compactDuration = compactionDurationSec(state.meta)

  const compactEnd = compactionEndMs(state, agent)
  if (compactEnd != null) boundaries.push(compactEnd)

  const conductorEnd = conductorMoveEndMs(state, agent, state.agents)
  if (conductorEnd != null) boundaries.push(conductorEnd)

  const overflow = contextOverflowMs(state, agent, state.agents)
  if (overflow != null) boundaries.push(overflow)

  if (agent.job === 'refine') {
    const at = refineCompleteMs(state, agent, state.agents, cache)
    if (at != null) boundaries.push(at)
  }

  if (agent.job === 'code' && agent.taskId) {
    const task = cache.tasksById.get(agent.taskId)
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
    const task = cache.tasksById.get(agent.taskId)
    if (task) {
      const required = taskTokensRequired(task.storyPointsRequired, 'review')
      const earned = task.reviewJobProgress ?? 0
      const at = taskRoleCompleteMs(state, agent, state.agents, earned, required, task.id)
      if (at != null) boundaries.push(at)
    }
  }

  if (agent.job === 'test' && agent.taskId) {
    const task = cache.tasksById.get(agent.taskId)
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

  return boundaries
}

/** Earliest wall-clock ms when this agent emits a time-driven simulation event. */
export function timeToNextAgent(agent: Agent, state: GameState, cache?: TimeProbeCache): number {
  const probeCache = cache ?? buildTimeProbeCache(state)
  return earliestAfter(agentEventBoundaries(state, agent, probeCache), state.snapshotAt)
}

/** Probe when this agent would next emit a time-driven simulation event. */
export function advanceAgentTime(
  agent: Agent,
  targetTime: number,
  state: GameState,
): AdvanceTimeResult<Agent> {
  const timestamp = stepBoundaryMs(timeToNextAgent(agent, state), targetTime, state.snapshotAt)
  return { value: agent, messages: [], timestamp }
}
