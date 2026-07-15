import { CONDUCTOR_MOVE_TOKEN_COST } from '../constants'
import {
  agentContextTokenCapacity,
  agentTokensPerSec,
  bestOfNStackMultiplier,
  contextFillMultiplier,
  fillAgentContextFromOutput,
  getAgentParameters,
  getFineTuneLevel,
  gpuShareForAgents,
  taskTokensRequired,
  tokenProgressIncrement,
  totalGpuTicks,
} from '../mechanics'
import { fineTuneId } from '../models'
import { getHallucinationLevel } from '../prestige'
import type { Agent, AgentJob, GameState, Project, Task, TaskWorkRole } from '../types'
import { dispatchableAgents } from '../projects'

export function contextTokensForState(state: Pick<GameState, 'meta' | 'contextRamLevel'>): number {
  return agentContextTokenCapacity(
    state.contextRamLevel ?? 0,
    getHallucinationLevel(state.meta, 'context'),
  )
}

export function agentOutputTokensPerSec(
  state: Pick<GameState, 'meta' | 'purchasedFineTunes' | 'fineTuneTiers' | 'gpuTickPurchases' | 'agents'>,
  _agent: Agent,
  job: AgentJob,
  agents: Agent[],
): number {
  const modelTierIndex = getHallucinationLevel(state.meta, 'model')
  const params = paramsForJob(state, job)
  const level = getFineTuneLevel(
    state.fineTuneTiers,
    state.purchasedFineTunes,
    fineTuneId(modelTierIndex, job === 'conductor' ? 'conductor' : job),
  )
  const gpuShare = gpuShareForAgents(agents, totalGpuTicks(state))
  return agentTokensPerSec(params, level, gpuShare)
}

function paramsForJob(
  state: Pick<GameState, 'meta' | 'purchasedFineTunes' | 'fineTuneTiers'>,
  job: AgentJob,
): number {
  return getAgentParameters(
    state.meta,
    state.purchasedFineTunes,
    job,
    getHallucinationLevel(state.meta, 'model'),
    state.fineTuneTiers,
  )
}

export { stackIndexOnTask } from '../projects'

export function applyOutputTokensToContext(
  agent: Agent,
  outputTokens: number,
  vibingCourses: string[],
): void {
  fillAgentContextFromOutput(agent, outputTokens, contextFillMultiplier(vibingCourses))
}

export function progressTaskTokens(
  task: Task,
  role: TaskWorkRole,
  earned: number,
  tokensPerSec: number,
  deltaSec: number,
  stackIndex: number,
): number {
  const required = taskTokensRequired(task.storyPointsRequired, role)
  return Math.min(
    required,
    earned +
      tokenProgressIncrement(required, earned, tokensPerSec, deltaSec, bestOfNStackMultiplier(stackIndex)),
  )
}

export function conductorMoveStep(
  conductor: Agent,
  tokensPerSec: number,
  deltaSec: number,
  vibingCourses: string[],
): number {
  const produced = tokensPerSec * deltaSec
  applyOutputTokensToContext(conductor, produced, vibingCourses)
  return Math.max(0, (conductor.conductorMoveRemaining ?? 0) - produced)
}

export function queueConductorMove(
  conductor: Agent,
): Agent {
  return {
    ...conductor,
    conductorMoveRemaining: CONDUCTOR_MOVE_TOKEN_COST,
    status: 'conducting',
  }
}

export function effectiveAgentsPerTask(
  project: Project,
  job: AgentJob,
  agents: Agent[],
  bestOfTier: number,
  taskCount: number,
): number {
  if (bestOfTier <= 0) return 1
  const workers = dispatchableAgents(agents, project.id, job)
  if (workers.length <= taskCount) return 1
  return 1 + bestOfTier
}
