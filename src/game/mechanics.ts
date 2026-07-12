import {
  AGENT_SKILL_REFERENCE_PARAMS,
  BASE_GPU,
  BASE_RAM_GB,
  COMPACT_DURATION_SEC,
  PLAYER_ACTION_BASE_DAYS,
  PR_QUALITY_PER_COMMENT,
  PROMPT_ENGINEERING_PR_BOOST,
  REFINE_SPEED_MULTIPLIER,
  REVIEW_CODE_TIME_FRACTION,
  SECONDS_PER_GAME_DAY,
  LEAD_SPAWN_INTERVAL_DAYS,
  LEAD_SPAWN_INTERVAL_MIN_DAYS,
  SP_PROGRESS_DAY_DIVISOR,
  SP_PROGRESS_PER_B_PARAM,
  TEST_SPEED_MULTIPLIER,
} from './constants'
import { getModelTier, MODEL_TIERS } from './models'
import { GPU_UPGRADES, RAM_UPGRADES } from './upgrades'
import type { Agent, AgentJob, FineTuneRole, GameState, Task } from './types'
import type { Rng } from './rng'

export const FIBONACCI = [0.5, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89] as const

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

/** Polynomial SP/day growth — productivity rises as the calendar advances. */
export function spProgressTimeMultiplier(gameDay: number): number {
  const t = gameDay / SP_PROGRESS_DAY_DIVISOR
  return 1 + t * t
}

export function storyPointProgressPerTick(parameters: number, gameDay = 0): number {
  return parameters * SP_PROGRESS_PER_B_PARAM * spProgressTimeMultiplier(gameDay)
}

export function storyPointIncrement(
  required: number,
  earned: number,
  parameters: number,
  gameDay = 0,
): number {
  const remaining = required - earned
  if (remaining <= 0) return 0
  const step = storyPointProgressPerTick(parameters, gameDay)
  return Math.min(remaining, step)
}

/** Reputation and calendar push lead sizes upward over time. */
export function pickLeadFibonacci(rng: Rng, reputation: number, gameDay = 0): number {
  let minIdx: number
  if (reputation < 10) minIdx = 3
  else if (reputation < 25) minIdx = 5
  else minIdx = 6

  const repBoost = Math.floor(reputation / 15)
  const dayBoost = Math.floor(Math.pow(gameDay / 50, 1.3))
  const maxIdx = Math.min(FIBONACCI.length - 1, minIdx + 2 + repBoost + dayBoost)

  const pool: number[] = []
  for (let i = minIdx; i <= maxIdx; i++) {
    pool.push(FIBONACCI[i])
  }
  return rng.pick(pool)
}

/** Higher reputation and later calendar → leads arrive more often. */
export function leadSpawnIntervalDays(reputation: number, gameDay: number): number {
  const repFactor = 1 + reputation / 20
  const dayFactor = 1 + Math.pow(gameDay / 90, 1.5) * 0.75
  const interval = LEAD_SPAWN_INTERVAL_DAYS / (repFactor * dayFactor)
  return Math.max(LEAD_SPAWN_INTERVAL_MIN_DAYS, interval)
}

export function formatSpPerTick(parameters: number, gameDay = 0): string {
  return `${storyPointProgressPerTick(parameters, gameDay).toFixed(1)} SP/tick`
}

/** Base PR quality when coding completes (0–100). */
export function computePrBaseQuality(
  parameters: number,
  taskSp: number,
  promptEngineering = false,
): number {
  const capability = parameters / (parameters + taskSp)
  const base = Math.min(100, Math.max(5, Math.round(capability * 70)))
  if (!promptEngineering) return base
  return Math.min(100, base + PROMPT_ENGINEERING_PR_BOOST)
}

export function prQualityAfterComments(base: number, resolvedCount: number): number {
  return Math.min(100, base + resolvedCount * PR_QUALITY_PER_COMMENT)
}

/** Bug-free chance at QA = prQuality%. */
export function rollBugAtQa(rng: Rng, prQuality: number): boolean {
  return rng.float() >= prQuality / 100
}

export function agentJobDurationDays(taskSp: number, agentParams: number): number {
  const skillFactor = Math.max(0.25, agentParams / AGENT_SKILL_REFERENCE_PARAMS)
  return (PLAYER_ACTION_BASE_DAYS * fibIndex(taskSp)) / skillFactor
}

export function estimatedCodeDurationDays(taskSp: number, agentParams: number): number {
  const progressPerTick = storyPointProgressPerTick(agentParams)
  const expectedTicks = taskSp / Math.max(0.01, progressPerTick)
  return expectedTicks / SECONDS_PER_GAME_DAY
}

export function reviewJobDurationDays(taskSp: number, agentParams: number): number {
  const days =
    estimatedCodeDurationDays(taskSp, agentParams) * REVIEW_CODE_TIME_FRACTION
  return Math.max(PLAYER_ACTION_BASE_DAYS / 10, days)
}

export function refineJobDurationDays(taskSp: number, agentParams: number, splitMode = false): number {
  const base = agentJobDurationDays(taskSp, agentParams) / REFINE_SPEED_MULTIPLIER
  return splitMode ? base * 3 : base
}

export function reviewCommentSpawnCount(rng: Rng, taskSp: number): number {
  let count = 1 + rng.int(0, 2)
  if (taskSp >= 13) count = Math.max(count, 3)
  if (taskSp >= 8) count = Math.max(count, 3)
  return Math.min(4, Math.max(1, count))
}

export function testStoryPointIncrement(
  required: number,
  earned: number,
  parameters: number,
  gameDay = 0,
): number {
  const remaining = required - earned
  if (remaining <= 0) return 0
  const step = storyPointProgressPerTick(parameters, gameDay) * TEST_SPEED_MULTIPLIER
  return Math.min(remaining, step)
}

export function fillAgentContext(
  agent: Agent,
  contextSizeK: number,
  baseSpeed: number,
  deltaSec: number,
  contextMultiplier = 1,
): number {
  const contextTokens = contextSizeK * 1000
  const tok = (contextTokens / 60) * baseSpeed * deltaSec * contextMultiplier
  agent.contextUsed += tok
  return contextFillPct(agent.contextUsed, contextSizeK)
}

export function contextFillPct(contextUsed: number, contextSizeK: number): number {
  const contextTokens = contextSizeK * 1000
  if (contextTokens <= 0) return 0
  return (contextUsed / contextTokens) * 100
}

/** Context fill for UI — drains from 100% to 0% while compacting. */
export function agentContextDisplayPct(
  agent: Pick<Agent, 'status' | 'contextUsed' | 'compactingRemainingSec'>,
  contextSizeK: number,
): number {
  if (agent.status === 'compacting' && COMPACT_DURATION_SEC > 0) {
    return (agent.compactingRemainingSec / COMPACT_DURATION_SEC) * 100
  }
  return contextFillPct(agent.contextUsed, contextSizeK)
}

export function agentIsBusy(agent: Agent): boolean {
  return (
    agent.job !== null &&
    agent.job !== 'conductor' &&
    agent.status !== 'compacting' &&
    agent.status !== 'compacted' &&
    agent.status !== 'crashed' &&
    agent.status !== 'idle'
  )
}

export function agentIsWorking(agent: Agent): boolean {
  return agentIsBusy(agent) || agent.status === 'conducting'
}

export function agentUsesGpu(agent: Agent): boolean {
  return agentIsWorking(agent) && agent.job !== 'conductor'
}

export function jobStatusFor(job: Agent['job']): Agent['status'] {
  switch (job) {
    case 'code':
      return 'working'
    case 'review':
      return 'reviewing'
    case 'refine':
      return 'refining'
    case 'test':
      return 'testing'
    case 'conductor':
      return 'conducting'
    default:
      return 'idle'
  }
}

export function agentRoleLabel(job: AgentJob): string {
  switch (job) {
    case 'code':
      return 'Coder'
    case 'review':
      return 'Reviewer'
    case 'refine':
      return 'Refiner'
    case 'test':
      return 'Tester'
    case 'conductor':
      return 'Conductor'
  }
}

export function agentWorkProgressPct(
  agent: Pick<Agent, 'job' | 'status' | 'jobProgress' | 'jobDuration'>,
  task: Pick<Task, 'storyPointsRequired' | 'storyPointsEarned' | 'testStoryPointsEarned'> | null,
): number | null {
  if (agent.status === 'idle' || agent.status === 'compacting' || agent.job === 'conductor') {
    return null
  }
  if (agent.job === 'code' && task) {
    return Math.min(100, (task.storyPointsEarned / task.storyPointsRequired) * 100)
  }
  if (agent.job === 'test' && task) {
    return Math.min(100, (task.testStoryPointsEarned / task.storyPointsRequired) * 100)
  }
  if ((agent.job === 'refine' || agent.job === 'review') && agent.jobDuration > 0) {
    return Math.min(100, (agent.jobProgress / agent.jobDuration) * 100)
  }
  return null
}

export function formatAgentDutyLabel(
  agent: Pick<Agent, 'job' | 'status' | 'taskId' | 'projectId'>,
  projectClientName: string | undefined,
  taskTitle: string | undefined,
): string {
  if (!agent.job) return 'Idle'
  const client = projectClientName ?? 'project'
  if (agent.status === 'idle') return `Idle (${agentRoleLabel(agent.job)}): ${client}`
  if (agent.status === 'compacting') return `Compacting: ${client}`
  if (agent.job === 'conductor') return `Conducting: ${client}`
  if (agent.job === 'refine') return `Refining: ${client}`
  if (agent.job === 'review') return `Reviewing PRs: ${client}`
  if (agent.job === 'test') {
    return taskTitle ? `Testing: ${taskTitle}` : `Testing: ${client}`
  }
  return `Coding: ${taskTitle ?? client}`
}

export function getTotalRam(state: Pick<GameState, 'purchasedRamUpgrades'>): number {
  const bonus = RAM_UPGRADES.filter((u) => state.purchasedRamUpgrades.includes(u.id)).reduce(
    (sum, u) => sum + u.ramGb,
    0,
  )
  return BASE_RAM_GB + bonus
}

export function getTotalGpus(state: Pick<GameState, 'purchasedGpuUpgrades'>): number {
  const bonus = GPU_UPGRADES.filter((u) => state.purchasedGpuUpgrades.includes(u.id)).reduce(
    (sum, u) => sum + u.gpus,
    0,
  )
  return BASE_GPU + bonus
}

export function ramPerAgent(modelTierIndex: number): number {
  return getModelTier(modelTierIndex)?.ramPerAgent ?? MODEL_TIERS[0].ramPerAgent
}

export function usedRam(agentCount: number, modelTierIndex: number): number {
  return agentCount * ramPerAgent(modelTierIndex)
}

export function maxAgents(totalRam: number, modelTierIndex: number): number {
  const per = ramPerAgent(modelTierIndex)
  return per > 0 ? Math.floor(totalRam / per) : 0
}

export function canUpgradeModelTier(totalRam: number, currentTierIndex: number): boolean {
  const next = getModelTier(currentTierIndex + 1)
  if (!next) return false
  return totalRam >= next.ramPerAgent
}

export function agentTickSpeed(agents: Agent[], totalGpus: number): number {
  const active = agents.filter(agentUsesGpu)
  if (active.length === 0) return 1
  return Math.min(1, totalGpus / active.length)
}

export function getAgentParameters(
  modelTierIndex: number,
  fineTunes: string[],
  job: AgentJob | null,
): number {
  const base = getModelTier(modelTierIndex)?.parameters ?? 1
  if (!job || job === 'conductor') return base
  const tuneId = `tune-${modelTierIndex}-${job}`
  if (fineTunes.includes(tuneId)) {
    return base * (1 + 0.12)
  }
  return base
}

export function hasFineTune(
  fineTunes: string[],
  tierIndex: number,
  role: FineTuneRole,
): boolean {
  return fineTunes.includes(`tune-${tierIndex}-${role}`)
}

export function averageDeliveryQuality(tasks: { prQuality: number | null; status: string; isReviewComment: boolean }[]): number {
  const merged = tasks.filter((t) => !t.isReviewComment && t.status === 'merged' && t.prQuality !== null)
  if (merged.length === 0) return 0
  return merged.reduce((sum, t) => sum + (t.prQuality ?? 0), 0) / merged.length
}

export function contextFillMultiplier(vibingCourses: string[]): number {
  return vibingCourses.includes('context_optimization') ? 0.65 : 1
}

export function hasPromptEngineering(vibingCourses: string[]): boolean {
  return vibingCourses.includes('prompt_engineering')
}

export function hasConductorCourse(vibingCourses: string[]): boolean {
  return vibingCourses.includes('conductor')
}
