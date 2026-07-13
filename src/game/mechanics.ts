import {
  AGENT_SKILL_REFERENCE_PARAMS,
  BASE_AGENT_SLOTS,
  BASE_GPU_TICKS,
  COMPACT_DURATION_SEC,
  GPU_TICK_BASE_COST,
  GPU_TICK_COST_MULT,
  MAX_CLIENT_TASK_SP,
  PLAYER_ACTION_BASE_DAYS,
  PR_QUALITY_PER_COMMENT,
  PROMPT_ENGINEERING_PR_BOOST,
  RAM_SLOT_BASE_COST,
  RAM_SLOT_COST_MULT,
  REFINE_SPEED_MULTIPLIER,
  REVIEW_CODE_TIME_FRACTION,
  SECONDS_PER_GAME_DAY,
  SP_PROGRESS_DAY_DIVISOR,
  SP_PROGRESS_PER_B_PARAM,
  TEST_SPEED_MULTIPLIER,
  REP_ZERO_PAY_MULT,
  MRR_BASE_RATE,
} from './constants'
import { HOUSING_CONFIG } from './housing'
import { FINE_TUNE_BONUS } from './models'
import type { MetaProgress } from './meta'
import { getHallucinationLevel } from './meta'
import { codeHallucinationParamMultiplier, effectiveModelParams, maxClientProjectSlots } from './prestige'
import type { Agent, AgentJob, FineTuneRole, GameState, Project, Task } from './types'
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

export function spProgressTimeMultiplier(gameDay: number): number {
  const t = gameDay / SP_PROGRESS_DAY_DIVISOR
  return 1 + t * t
}

/** Quadratic penalty when model params < task SP. */
export function paramsSpSpeedMultiplier(effectiveParams: number, taskSp: number, power = 2): number {
  if (taskSp <= 0) return 1
  const ratio = effectiveParams / taskSp
  return Math.min(1, Math.pow(ratio, power))
}

export function storyPointProgressPerTick(
  effectiveParams: number,
  gameDay = 0,
  taskSp = 4,
): number {
  const base = effectiveParams * SP_PROGRESS_PER_B_PARAM * spProgressTimeMultiplier(gameDay)
  return base * paramsSpSpeedMultiplier(effectiveParams, taskSp, 2)
}

export function storyPointIncrement(
  required: number,
  earned: number,
  effectiveParams: number,
  gameDay = 0,
): number {
  const remaining = required - earned
  if (remaining <= 0) return 0
  const step = storyPointProgressPerTick(effectiveParams, gameDay, required)
  return Math.min(remaining, step)
}

export function leadScopeForReputation(reputation: number): { minTotal: number; maxTotal: number } {
  const rep = Math.max(0, reputation)
  const minTotal = 3 + Math.floor(rep / 4)
  const spread = 2 + Math.floor(rep / 6)
  return { minTotal, maxTotal: minTotal + spread }
}

/** Max SP per requirement — ramps slowly with rep so Fib splits stay digestible. */
export function maxRequirementSpForReputation(
  reputation: number,
  refineHallucinationLevel = 0,
): number {
  const rep = Math.max(0, reputation)
  const level = Math.max(0, refineHallucinationLevel)
  const divisor = 5 + level * 5
  return Math.min(MAX_CLIENT_TASK_SP, Math.max(1, 1 + Math.floor(rep / divisor)))
}

/** Lead total SP roll — reputation only, slow ramp. */
export function pickLeadTotalStoryPoints(rng: Rng, reputation: number): number {
  const { minTotal, maxTotal } = leadScopeForReputation(reputation)
  if (maxTotal <= minTotal) return minTotal
  return minTotal + rng.int(0, maxTotal - minTotal)
}

export function countActiveClientProjects(projects: Project[]): number {
  return projects.filter((p) => p.kind === 'client' && p.status === 'active' && !p.isLocked).length
}

/** PM course tiers only count toward client project slots while the specialist is assigned. */
export function effectiveVibingPmTiers(
  state: Pick<GameState, 'assignedSpecialistRoles' | 'vibingCourseTiers'>,
): number {
  if (!state.assignedSpecialistRoles.includes('project_manager')) return 0
  return state.vibingCourseTiers.project_manager ?? 0
}

/** How many available leads we want — one per empty client project slot. */
export function clientLeadPipelineTarget(
  meta: MetaProgress,
  vibingPmTiers: number,
  projects: Project[],
): number {
  const maxSlots = maxClientProjectSlots(meta, vibingPmTiers)
  return Math.max(0, maxSlots - countActiveClientProjects(projects))
}

export function formatSpPerTick(effectiveParams: number, gameDay = 0, taskSp = 4): string {
  return `${storyPointProgressPerTick(effectiveParams, gameDay, taskSp).toFixed(2)} SP/tick`
}

const GAME_DAY_START_HOUR = 8

export function formatGameClock(gameDay: number): string {
  const dayNumber = Math.floor(gameDay)
  const dayFraction = gameDay - dayNumber
  const totalMinutes = GAME_DAY_START_HOUR * 60 + dayFraction * 24 * 60
  const hours24 = Math.floor(totalMinutes / 60) % 24
  const minutes = Math.floor(totalMinutes % 60)
  const period = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 || 12
  const hh = String(hours12).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  return `Day ${dayNumber} - ${hh}:${mm} ${period}`
}

export function computePrBaseQuality(
  effectiveParams: number,
  taskSp: number,
  promptEngineering = false,
): number {
  const capability = effectiveParams / (effectiveParams + taskSp)
  const base = Math.min(100, Math.max(5, Math.round(capability * 70)))
  if (!promptEngineering) return base
  return Math.min(100, base + PROMPT_ENGINEERING_PR_BOOST)
}

export function prQualityAfterComments(base: number, resolvedCount: number): number {
  return Math.min(100, base + resolvedCount * PR_QUALITY_PER_COMMENT)
}

export function rollBugAtQa(rng: Rng, prQuality: number): boolean {
  return rng.float() >= prQuality / 100
}

export function agentJobDurationDays(taskSp: number, agentParams: number): number {
  const skillFactor = Math.max(0.25, agentParams / AGENT_SKILL_REFERENCE_PARAMS)
  const spPenalty = Math.max(0.25, Math.sqrt(paramsSpSpeedMultiplier(agentParams, taskSp, 2)))
  return (PLAYER_ACTION_BASE_DAYS * fibIndex(Math.min(taskSp, MAX_CLIENT_TASK_SP))) / (skillFactor * spPenalty)
}

export function estimatedCodeDurationDays(taskSp: number, agentParams: number): number {
  const progressPerTick = storyPointProgressPerTick(agentParams, 0, taskSp)
  const expectedTicks = taskSp / Math.max(0.01, progressPerTick)
  return expectedTicks / SECONDS_PER_GAME_DAY
}

export function reviewJobDurationDays(taskSp: number, agentParams: number): number {
  const days = estimatedCodeDurationDays(taskSp, agentParams) * REVIEW_CODE_TIME_FRACTION
  return Math.max(PLAYER_ACTION_BASE_DAYS / 10, days)
}

export function refineJobDurationDays(taskSp: number, agentParams: number): number {
  const spPenalty = Math.max(0.25, Math.sqrt(paramsSpSpeedMultiplier(agentParams, taskSp, 2)))
  return agentJobDurationDays(taskSp, agentParams) / REFINE_SPEED_MULTIPLIER / spPenalty
}

export function reviewCommentSpawnCount(
  rng: Rng,
  taskSp: number,
  reviewHallucinationLevel = 0,
): number {
  let count = 1 + rng.int(0, 2)
  if (taskSp >= 13) count = Math.max(count, 3)
  if (taskSp >= 8) count = Math.max(count, 3)
  const rolled = Math.min(4, Math.max(1, count))
  return Math.max(0, rolled - Math.max(0, reviewHallucinationLevel))
}

export function testStoryPointIncrement(
  required: number,
  earned: number,
  effectiveParams: number,
  gameDay = 0,
): number {
  const remaining = required - earned
  if (remaining <= 0) return 0
  const step = storyPointProgressPerTick(effectiveParams, gameDay, required) * TEST_SPEED_MULTIPLIER
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

export function agentContextDisplayPct(
  agent: Pick<Agent, 'status' | 'contextUsed' | 'compactingRemainingSec'>,
  contextSizeK: number,
  compactDuration = COMPACT_DURATION_SEC,
): number {
  if (agent.status === 'compacting' && compactDuration > 0) {
    return (agent.compactingRemainingSec / compactDuration) * 100
  }
  return contextFillPct(agent.contextUsed, contextSizeK)
}

export function agentIsBusy(agent: Agent): boolean {
  return (
    agent.job !== null &&
    !agent.isAutomation &&
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
    case 'procurement':
      return 'procuring'
    case 'sales':
      return 'selling'
    case 'marketing':
      return 'marketing'
    case 'customer':
      return 'idle'
    case 'accounting':
      return 'accounting'
    case 'project_manager':
      return 'managing'
    case 'offline':
      return 'offline'
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
    case 'procurement':
      return 'Procurement'
    case 'sales':
      return 'Sales'
    case 'marketing':
      return 'Marketing'
    case 'customer':
      return 'Customer'
    case 'accounting':
      return 'Accounting'
    case 'project_manager':
      return 'Project Manager'
    case 'offline':
      return 'Offline'
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
  agent: Pick<Agent, 'job' | 'status' | 'taskId' | 'projectId' | 'isAutomation' | 'automationJob'>,
  projectClientName: string | undefined,
  taskTitle: string | undefined,
): string {
  if (agent.isAutomation && agent.automationJob) {
    return automationAgentDutyLabel(agent.automationJob as AutomationAgentJob)
  }
  if (!agent.job) return 'Idle'
  const client = projectClientName ?? 'project'
  if (agent.status === 'idle') return `Idle (${agentRoleLabel(agent.job)}): ${client}`
  if (agent.status === 'compacting') return `Rebooting: ${client}`
  if (agent.job === 'conductor') return `Conducting: ${client}`
  if (agent.job === 'refine') return `Refining: ${client}`
  if (agent.job === 'review') return `Reviewing PRs: ${client}`
  if (agent.job === 'test') {
    return taskTitle ? `Testing: ${taskTitle}` : `Testing: ${client}`
  }
  return `Coding: ${taskTitle ?? client}`
}

/** Project view: role and client are redundant (section header + card title). */
export function formatAgentProjectViewDutyLabel(
  agent: Pick<Agent, 'job' | 'status' | 'taskId' | 'projectId'>,
  taskTitle: string | undefined,
): string | null {
  if (!agent.job) return null
  if (agent.status === 'compacting') return 'Rebooting'
  if (agent.status === 'idle') return null
  if (agent.job === 'test' || agent.job === 'code') return taskTitle ?? null
  return null
}

export function totalAgentSlots(state: Pick<GameState, 'agentSlotPurchases'>): number {
  return BASE_AGENT_SLOTS + state.agentSlotPurchases
}

export function totalGpuTicks(state: Pick<GameState, 'gpuTickPurchases'>): number {
  return BASE_GPU_TICKS + state.gpuTickPurchases
}

export function ramSlotCost(purchases: number): number {
  return Math.round(RAM_SLOT_BASE_COST * Math.pow(RAM_SLOT_COST_MULT, purchases))
}

export function gpuTickCost(purchases: number): number {
  return Math.round(GPU_TICK_BASE_COST * Math.pow(GPU_TICK_COST_MULT, purchases))
}

export function maxAgentSlotPurchases(apartment: GameState['apartment']): number {
  return HOUSING_CONFIG[apartment].maxRamPurchases - BASE_AGENT_SLOTS
}

export function maxGpuTickPurchases(apartment: GameState['apartment']): number {
  return HOUSING_CONFIG[apartment].maxGpuPurchases - BASE_GPU_TICKS
}

export function maxAgents(state: GameState): number {
  return totalAgentSlots(state)
}

export function agentTickSpeed(agents: Agent[], totalTicks: number): number {
  const active = agents.filter(agentUsesGpu)
  if (active.length === 0) return totalTicks
  return totalTicks / active.length
}

export function getFineTuneLevel(
  fineTuneTiers: Partial<Record<string, number>>,
  purchasedFineTunes: string[],
  fineTuneIdKey: string,
): number {
  return fineTuneTiers[fineTuneIdKey] ?? (purchasedFineTunes.includes(fineTuneIdKey) ? 1 : 0)
}

export function getAgentParameters(
  meta: MetaProgress,
  fineTunes: string[],
  job: AgentJob | null,
  modelTierIndex: number,
  fineTuneTiers: Partial<Record<string, number>> = {},
): number {
  let base = effectiveModelParams(meta)
  if (!job || job === 'conductor' || agentIsAutomationJob(job)) return base
  if (job === 'code') {
    base *= codeHallucinationParamMultiplier(meta)
  }
  const tuneId = `tune-${modelTierIndex}-${job}`
  const level = getFineTuneLevel(fineTuneTiers, fineTunes, tuneId)
  if (level > 0) {
    return base * (1 + FINE_TUNE_BONUS * level)
  }
  return base
}

export const AUTOMATION_AGENT_JOBS = [
  'procurement',
  'sales',
  'marketing',
  'customer',
  'accounting',
  'project_manager',
  'offline',
] as const satisfies readonly AgentJob[]

export type AutomationAgentJob = (typeof AUTOMATION_AGENT_JOBS)[number]

export function agentIsAutomationJob(job: AgentJob): boolean {
  return (AUTOMATION_AGENT_JOBS as readonly string[]).includes(job)
}

export function isAutomationAgentUnlocked(
  state: Pick<GameState, 'vibingCourses' | 'meta'>,
  job: AutomationAgentJob,
): boolean {
  if (state.vibingCourses.includes(job)) return true
  return getHallucinationLevel(state.meta, job) > 0
}

export function unlockedAutomationJobs(
  state: Pick<GameState, 'vibingCourses' | 'meta'>,
): AutomationAgentJob[] {
  return AUTOMATION_AGENT_JOBS.filter((job) => isAutomationAgentUnlocked(state, job))
}

export function hasActiveAutomationAgent(agents: Agent[], job: AutomationAgentJob): boolean {
  return agents.some((a) => a.isAutomation && a.automationJob === job && a.job === job)
}

export function automationAgentDutyLabel(job: AutomationAgentJob): string {
  switch (job) {
    case 'procurement':
      return 'Procuring upgrades'
    case 'sales':
      return 'Closing leads & shipping'
    case 'marketing':
      return 'Marketing funnel crimes'
    case 'customer':
      return 'Customer psychosis ops'
    case 'accounting':
      return 'Creative accounting'
    case 'project_manager':
      return 'Portfolio ceremonies'
    case 'offline':
      return 'Hallucinating elapsed time'
  }
}

export function hasFineTune(
  fineTunes: string[],
  tierIndex: number,
  role: FineTuneRole,
  fineTuneTiers: Partial<Record<string, number>> = {},
): boolean {
  return getFineTuneLevel(fineTuneTiers, fineTunes, `tune-${tierIndex}-${role}`) > 0
}

export function averageDeliveryQuality(
  tasks: { prQuality: number | null; status: string; isReviewComment: boolean }[],
): number {
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

export function hasAutoConductorCourse(vibingCourses: string[]): boolean {
  return vibingCourses.includes('auto_conductor')
}

export function hasOfflineCourse(vibingCourses: string[]): boolean {
  return vibingCourses.includes('offline')
}

export function refinementTier(
  tiers: Partial<Record<string, number>>,
  vibingCourses: string[],
): number {
  return tiers.refinement ?? (vibingCourses.includes('refinement') ? 1 : 0)
}

/** Auto-split chance when refining requirements (25% per tier, capped at 100%). */
export function refinementAutoSplitChance(refinementTierLevel: number): number {
  if (refinementTierLevel <= 0) return 0
  return Math.min(1, refinementTierLevel * 0.25)
}

export function conductorTier(
  tiers: Partial<Record<string, number>>,
  vibingCourses: string[],
): number {
  return tiers.conductor ?? (vibingCourses.includes('conductor') ? 1 : 0)
}

/** Max agents on a conductor project (conductor + workers), starting at 3. */
export function maxConductorTeamSize(conductorTierLevel: number): number {
  if (conductorTierLevel <= 0) return 0
  return 2 + conductorTierLevel
}

export function projectTeamSize(agents: Agent[], projectId: string): number {
  return agents.filter((a) => a.projectId === projectId && a.job !== null).length
}

export function bestOfNTier(tiers: Partial<Record<string, number>>): number {
  return tiers.best_of_n ?? 0
}

/** Agents that may share one task (1 at tier 0, up to 5 at tier 4). */
export function maxAgentsPerTask(bestOfTier: number): number {
  return 1 + bestOfTier
}

export function hasVibingTier(tiers: Partial<Record<string, number>>, courseId: string, min: number): boolean {
  return (tiers[courseId] ?? (courseId in tiers ? 0 : 0)) >= min
}

export function vibingTier(tiers: Partial<Record<string, number>>, courseId: string): number {
  return tiers[courseId] ?? 0
}

export function computeMrrGain(featureSp: number, featuresShipped: number, housingMultiplier: number): number {
  return Math.sqrt(featureSp) * MRR_BASE_RATE * (1 + 0.02 * featuresShipped) * housingMultiplier
}

export function clientPaymentForTotalSp(totalSp: number, reputation: number, unreasonable = false): number {
  const repMult = 4 + Math.max(0, reputation) * 0.3
  const unreasonableMult = unreasonable ? 0.75 : 1
  return Math.round(totalSp * repMult * unreasonableMult)
}

export function repZeroPaymentMultiplier(reputation: number): number {
  return reputation <= 0 ? REP_ZERO_PAY_MULT : 1
}

export { effectiveModelParams }
