import { AGENT_SKILL_REFERENCE_PARAMS, PLAYER_ACTION_BASE_DAYS, QUALITY_REFACTOR_PER_DAY, REFINE_SPEED_MULTIPLIER } from './constants'
import type { Agent, LoadedModel, Server } from './types'
import { getModel } from './models'

export const FIBONACCI = [0.5, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89] as const

export const LAPTOP_HOST_ID = 'laptop'

export function fibIndex(sp: number): number {
  const idx = FIBONACCI.indexOf(sp as (typeof FIBONACCI)[number])
  return idx >= 0 ? idx : 0
}

export function isFibonacci(sp: number): boolean {
  return FIBONACCI.includes(sp as (typeof FIBONACCI)[number])
}

export function formatStoryPoints(sp: number): string {
  return sp % 1 === 0 ? String(sp) : sp.toFixed(1)
}

/** One agent tick worth of progress toward a ticket. */
export function storyPointIncrement(required: number, earned: number): number {
  const remaining = required - earned
  return remaining <= 0.1 ? remaining : 0.1
}

export function pickLeadFibonacci(reputation: number): number {
  let pool: number[]
  if (reputation < 10) pool = [5, 8]
  else if (reputation < 25) pool = [8, 13]
  else pool = [13, 21, 34]
  return pool[Math.floor(Math.random() * pool.length)]
}

/** params / (params + taskSP), dampened when context > 60% full */
export function effectiveSuccessRate(
  parameters: number,
  taskSp: number,
  contextFillPct: number,
): number {
  let rate = parameters / (parameters + taskSp)
  if (contextFillPct > 60) {
    rate *= (40 - (contextFillPct - 60)) / 40
  }
  return Math.max(0, rate)
}

export function formatSuccessPct(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

export function computeQualityHit(
  taskSp: number,
  modelParameters: number,
  activeTaskCount = 1,
): number {
  const ratio = taskSp / Math.max(1, modelParameters)
  const base = Math.max(0.5, ratio * 8)
  const fragmentation = 1 + Math.log2(Math.max(1, activeTaskCount)) * 0.2
  return base * fragmentation
}

export function agentJobDurationDays(
  taskSp: number,
  projectQuality: number,
  agentParams: number,
): number {
  const qualityFactor = Math.max(0.01, projectQuality / 100)
  const skillFactor = Math.max(0.25, agentParams / AGENT_SKILL_REFERENCE_PARAMS)
  return (PLAYER_ACTION_BASE_DAYS * fibIndex(taskSp)) / qualityFactor / skillFactor
}

export function refineJobDurationDays(
  taskSp: number,
  projectQuality: number,
  agentParams: number,
): number {
  return agentJobDurationDays(taskSp, projectQuality, agentParams) / REFINE_SPEED_MULTIPLIER
}

export function reviewAccuracy(agentParams: number, taskSp: number): number {
  return agentParams / (agentParams + taskSp)
}

export function refineSuccessRate(agentParams: number, taskSp: number): number {
  return agentParams / (agentParams + taskSp)
}

export function computeRevealedQualityHit(trueHit: number, agentParams: number, taskSp: number): number {
  const accuracy = reviewAccuracy(agentParams, taskSp)
  const underestimate = 0.2 + accuracy * 0.8
  const noise = (1 - accuracy) * trueHit * 0.35 * (Math.random() - 0.2)
  return Math.max(0.5, trueHit * underestimate + noise)
}

/** Each review pass moves the estimate closer to the true quality hit. */
export function improveReviewEstimate(
  currentRevealed: number,
  trueHit: number,
  agentParams: number,
  taskSp: number,
): number {
  const accuracy = reviewAccuracy(agentParams, taskSp)
  const delta = (currentRevealed - trueHit) * accuracy * 0.35
  return Math.max(trueHit * 0.5, currentRevealed - delta)
}

export function refactorRatePerDay(agentParams: number): number {
  return QUALITY_REFACTOR_PER_DAY * (agentParams / AGENT_SKILL_REFERENCE_PARAMS)
}

export function fillAgentContext(
  agent: Agent,
  model: { contextSize: number },
  baseSpeed: number,
  deltaSec: number,
): number {
  const tok = tokensPerTick(model.contextSize) * baseSpeed * deltaSec
  agent.contextUsed += tok
  return contextFillPct(agent.contextUsed, model.contextSize)
}

export function agentIsBusy(agent: Agent): boolean {
  return agent.job !== null && agent.status !== 'compacted' && agent.status !== 'crashed'
}

export function jobStatusFor(job: Agent['job']): Agent['status'] {
  switch (job) {
    case 'code':
      return 'working'
    case 'review':
      return 'reviewing'
    case 'refactor':
      return 'refactoring'
    case 'refine':
      return 'refining'
    default:
      return 'idle'
  }
}

export function tokensPerTick(contextSizeK: number): number {
  const contextTokens = contextSizeK * 1000
  return contextTokens / 60
}

export function contextFillPct(contextUsed: number, contextSizeK: number): number {
  const contextTokens = contextSizeK * 1000
  if (contextTokens <= 0) return 0
  return (contextUsed / contextTokens) * 100
}

export function getHostGpus(hostId: string, servers: Server[], rackGpus: Record<string, number>): number {
  if (hostId === LAPTOP_HOST_ID) return 1
  const server = servers.find((s) => s.id === hostId)
  return server ? (rackGpus[server.tier] ?? 1) : 0
}

export function getHostRam(hostId: string, servers: Server[], rackRam: Record<string, number>): number {
  if (hostId === LAPTOP_HOST_ID) return 4
  const server = servers.find((s) => s.id === hostId)
  return server ? (rackRam[server.tier] ?? 0) : 0
}

export function activeAgentsOnHost(agents: Agent[], hostId: string): Agent[] {
  return agents.filter(
    (a) => a.serverId === hostId && agentIsBusy(a) && getModel(a.modelId)?.kind === 'local',
  )
}

export function agentTickSpeed(agent: Agent, agents: Agent[], servers: Server[], rackGpus: Record<string, number>): number {
  const model = getModel(agent.modelId)
  if (!model) return 0
  if (model.kind === 'cloud') return 1
  if (!agent.serverId) return 0

  const hostAgents = activeAgentsOnHost(agents, agent.serverId)
  const gpus = getHostGpus(agent.serverId, servers, rackGpus)
  const share = hostAgents.length > 0 ? gpus / hostAgents.length : gpus
  return Math.min(1, share)
}

export function ramForLoadedModel(
  modelId: string,
  agents: Agent[],
  loadedModelId: string,
): number {
  const model = getModel(modelId)
  if (!model) return 0
  const activeTasks = agents.filter((a) => a.loadedModelId === loadedModelId && a.job === 'code').length
  return model.loadRam + activeTasks * (model.loadRam / 2)
}

export function computeHostUsedRam(
  hostId: string,
  loadedModels: LoadedModel[],
  agents: Agent[],
): number {
  return loadedModels
    .filter((lm) => lm.hostId === hostId)
    .reduce((sum, lm) => sum + ramForLoadedModel(lm.modelId, agents, lm.id), 0)
}

export function computeTotalUsedRam(loadedModels: LoadedModel[], agents: Agent[], servers: Server[]): number {
  const hosts = [LAPTOP_HOST_ID, ...servers.map((s) => s.id)]
  return hosts.reduce((sum, hostId) => sum + computeHostUsedRam(hostId, loadedModels, agents), 0)
}

export function computeTotalAvailableRam(servers: Server[], rackRam: Record<string, number>): number {
  return 4 + servers.reduce((sum, s) => sum + (rackRam[s.tier] ?? 0), 0)
}

export function getAgentParameters(agent: Agent): number {
  return getModel(agent.modelId)?.parameters ?? 1
}

export function getTaskQualityParameters(task: { completedByAgentId: string | null }, agents: Agent[]): number {
  if (!task.completedByAgentId) return 1
  const agent = agents.find((a) => a.id === task.completedByAgentId)
  return agent ? getAgentParameters(agent) : 1
}
