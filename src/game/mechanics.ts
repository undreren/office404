import {
  AGENT_SKILL_REFERENCE_PARAMS,
  BASE_CONTEXT_TOKENS,
  BASE_GPU_TICKS,
  BASE_RAM_GB,
  BEST_OF_N_DECAY,
  COMPACT_DURATION_SEC,
  CONDUCTOR_MOVE_TOKEN_COST,
  GPU_TICK_BASE_COST,
  GPU_TICK_COST_MULT,
  MAX_CLIENT_TASK_SP,
  PLAYER_ACTION_BASE_DAYS,
  PR_QUALITY_PER_COMMENT,
  PROMPT_ENGINEERING_PR_BOOST,
  RAM_PER_UPGRADE_GB,
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
import type { Agent, AgentJob, FineTuneRole, GameState, Lead, Project, Task, TaskWorkRole } from './types'
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

export function formatPercent(value: number, decimals = 1): string {
  return value.toFixed(decimals)
}

export function taskBaseTokenCost(sp: number): number {
  return Math.pow(5 + sp, 2)
}

export function roleTokenDivisor(role: TaskWorkRole): number {
  switch (role) {
    case 'refine':
      return REFINE_SPEED_MULTIPLIER
    case 'test':
      return TEST_SPEED_MULTIPLIER
    case 'review':
      return 1 / REVIEW_CODE_TIME_FRACTION
    case 'code':
      return 1
  }
}

export function taskTokensRequired(sp: number, role: TaskWorkRole): number {
  return taskBaseTokenCost(sp) / roleTokenDivisor(role)
}

export function bestOfNStackMultiplier(stackIndex: number): number {
  if (stackIndex <= 0) return 1
  return Math.pow(BEST_OF_N_DECAY, stackIndex)
}

export function fineTuneMultiplier(level: number): number {
  if (level <= 0) return 1
  return Math.pow(1 + FINE_TUNE_BONUS, level)
}

export function agentTokensPerSec(
  effectiveParams: number,
  fineTuneLevel: number,
  gpuShare: number,
): number {
  return effectiveParams * fineTuneMultiplier(fineTuneLevel) * gpuShare
}

export function gpuShareForAgents(agents: Agent[], totalGpus: number): number {
  const active = agents.filter(agentUsesGpu)
  if (active.length === 0) return totalGpus
  return totalGpus / active.length
}

export function tokenProgressIncrement(
  required: number,
  earned: number,
  tokensPerSec: number,
  deltaSec: number,
  stackMultiplier = 1,
): number {
  const remaining = required - earned
  if (remaining <= 0) return 0
  const step = tokensPerSec * stackMultiplier * deltaSec
  return Math.min(remaining, step)
}

export function taskEarnedTokens(
  task: Pick<Task, 'storyPointsRequired' | 'storyPointsEarned' | 'testStoryPointsEarned'>,
  role: TaskWorkRole,
): number {
  return role === 'test' ? task.testStoryPointsEarned : task.storyPointsEarned
}

export function taskMeetsTokenGoal(task: Task, role: TaskWorkRole): boolean {
  const required = taskTokensRequired(task.storyPointsRequired, role)
  return taskEarnedTokens(task, role) >= required
}

/** @deprecated Story-point pacing removed — use taskTokensRequired. */
export function spProgressTimeMultiplier(gameDay: number): number {
  const t = gameDay / SP_PROGRESS_DAY_DIVISOR
  return 1 + t * t
}

/** @deprecated Story-point pacing removed. */
export function paramsSpSpeedMultiplier(effectiveParams: number, taskSp: number, power = 2): number {
  if (taskSp <= 0) return 1
  const ratio = effectiveParams / taskSp
  return Math.min(1, Math.pow(ratio, power))
}

/** @deprecated Use agentTokensPerSec — kept for legacy duration estimates in tests. */
export function storyPointProgressPerTick(
  effectiveParams: number,
  _gameDay = 0,
  _taskSp = 4,
): number {
  return effectiveParams * SP_PROGRESS_PER_B_PARAM
}

/** @deprecated Use tokenProgressIncrement. */
export function storyPointIncrement(
  required: number,
  earned: number,
  effectiveParams: number,
  _gameDay = 0,
  deltaSec = 1,
): number {
  return tokenProgressIncrement(required, earned, effectiveParams, deltaSec)
}

/** @deprecated Use tokenProgressIncrement. */
export function testStoryPointIncrement(
  required: number,
  earned: number,
  effectiveParams: number,
  _gameDay = 0,
  deltaSec = 1,
): number {
  return tokenProgressIncrement(required, earned, effectiveParams, deltaSec)
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

export function countPmRoleAssignments(roles: AgentJob[]): number {
  return roles.filter((role) => role === 'project_manager').length
}

export function countAssignedPmAgents(agents: Agent[]): number {
  return agents.filter((a) => a.isAutomation && a.automationJob === 'project_manager').length
}

/** True when another client gig can be accepted. */
export function hasOpenClientProjectSlot(
  meta: MetaProgress,
  _agents: Agent[],
  projects: Project[],
): boolean {
  const maxSlots = maxClientProjectSlots(meta)
  return countActiveClientProjects(projects) < maxSlots
}

/** How many PM specialists the player may assign (on/off). */
export function maxAssignablePmAgents(
  state: Pick<GameState, 'vibingCourses' | 'vibingCourseTiers' | 'meta'>,
): number {
  if (!isAutomationAgentUnlocked(state, 'project_manager')) return 0
  const courseTier =
    state.vibingCourseTiers.project_manager ??
    (state.vibingCourses.includes('project_manager') ? 1 : 0)
  if (courseTier > 0) return 1
  return getHallucinationLevel(state.meta, 'project_manager') > 0 ? 1 : 0
}

/** How many available leads we want — one per empty client project slot. */
export function clientLeadPipelineTarget(
  meta: MetaProgress,
  _assignedPmAgents: number,
  projects: Project[],
): number {
  const maxSlots = maxClientProjectSlots(meta)
  return Math.max(0, maxSlots - countActiveClientProjects(projects))
}

export function isClientSlotOccupiedByProject(projects: Project[], slotIndex: number): boolean {
  return projects.some(
    (p) =>
      p.kind === 'client' &&
      p.status === 'active' &&
      !p.isLocked &&
      p.slotIndex === slotIndex,
  )
}

export function availableLeadInSlot(leads: Lead[], slotIndex: number): Lead | undefined {
  return leads.find((l) => l.status === 'available' && l.slotIndex === slotIndex)
}

export function activeClientProjectInSlot(projects: Project[], slotIndex: number): Project | undefined {
  return projects.find(
    (p) =>
      p.kind === 'client' &&
      p.status === 'active' &&
      !p.isLocked &&
      p.slotIndex === slotIndex,
  )
}

/** Slot indices that need a new available lead (empty column). */
export function clientSlotsNeedingLeads(
  meta: MetaProgress,
  projects: Project[],
  leads: Lead[],
): number[] {
  const maxSlots = maxClientProjectSlots(meta)
  const slots: number[] = []
  for (let slot = 0; slot < maxSlots; slot++) {
    if (isClientSlotOccupiedByProject(projects, slot)) continue
    if (availableLeadInSlot(leads, slot)) continue
    slots.push(slot)
  }
  return slots
}

export function repairClientSlotIndexes(
  meta: MetaProgress,
  projects: Project[],
  leads: Lead[],
): { projects: Project[]; leads: Lead[] } {
  const maxSlots = maxClientProjectSlots(meta)
  const projectSlotById = new Map<string, number>()
  const usedProjectSlots = new Set<number>()

  for (const p of projects) {
    if (p.kind !== 'client' || p.status !== 'active' || p.isLocked) continue
    if (
      typeof p.slotIndex === 'number' &&
      p.slotIndex >= 0 &&
      p.slotIndex < maxSlots &&
      !usedProjectSlots.has(p.slotIndex)
    ) {
      usedProjectSlots.add(p.slotIndex)
      projectSlotById.set(p.id, p.slotIndex)
    }
  }

  let nextSlot = 0
  for (const p of projects) {
    if (p.kind !== 'client' || p.status !== 'active' || p.isLocked || projectSlotById.has(p.id)) {
      continue
    }
    while (nextSlot < maxSlots && usedProjectSlots.has(nextSlot)) nextSlot++
    if (nextSlot < maxSlots) {
      projectSlotById.set(p.id, nextSlot)
      usedProjectSlots.add(nextSlot)
      nextSlot++
    }
  }

  const nextProjects = projects.map((p) => {
    const slot = projectSlotById.get(p.id)
    if (slot !== undefined) return { ...p, slotIndex: slot }
    return { ...p, slotIndex: p.slotIndex ?? 0 }
  })

  const usedLeadSlots = new Set<number>()
  const nextLeads = leads.map((l) => {
    if (l.status !== 'available') {
      return { ...l, slotIndex: l.slotIndex ?? 0 }
    }
    if (typeof l.slotIndex === 'number' && l.slotIndex >= 0 && l.slotIndex < maxSlots) {
      if (!usedProjectSlots.has(l.slotIndex) && !usedLeadSlots.has(l.slotIndex)) {
        usedLeadSlots.add(l.slotIndex)
        return l
      }
    }
    let slot = 0
    while (
      slot < maxSlots &&
      (usedProjectSlots.has(slot) || usedLeadSlots.has(slot))
    ) {
      slot++
    }
    const assigned = Math.min(slot, maxSlots - 1)
    usedLeadSlots.add(assigned)
    return { ...l, slotIndex: assigned }
  })

  return { projects: nextProjects, leads: nextLeads }
}

export function formatTokensPerSec(tokensPerSec: number): string {
  return `${tokensPerSec.toFixed(1)} tok/s`
}

export function formatSpPerTick(effectiveParams: number, _gameDay = 0, _taskSp = 4): string {
  return formatTokensPerSec(agentTokensPerSec(effectiveParams, 0, 1))
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

export function fillAgentContextFromOutput(
  agent: Agent,
  outputTokens: number,
  contextMultiplier = 1,
): void {
  agent.contextUsed += outputTokens * contextMultiplier
}

/** @deprecated Time-based context fill removed — use fillAgentContextFromOutput. */
export function fillAgentContext(
  agent: Agent,
  _contextSizeK: number,
  tokensProduced: number,
  _deltaSec: number,
  contextMultiplier = 1,
): number {
  fillAgentContextFromOutput(agent, tokensProduced, contextMultiplier)
  return agent.contextUsed
}

export function agentContextTokenCapacity(contextRamLevel: number, prestigeContextLevel: number): number {
  const multiplier = 1 + contextRamLevel + prestigeContextLevel
  return BASE_CONTEXT_TOKENS * multiplier
}

export function contextFillPct(contextUsed: number, contextTokens: number): number {
  if (contextTokens <= 0) return 0
  return (contextUsed / contextTokens) * 100
}

export function agentContextDisplayPct(
  agent: Pick<Agent, 'status' | 'contextUsed' | 'compactingRemainingSec'>,
  contextTokens: number,
  compactDuration = COMPACT_DURATION_SEC,
): number {
  if (agent.status === 'compacting' && compactDuration > 0) {
    return (agent.compactingRemainingSec / compactDuration) * 100
  }
  return contextFillPct(agent.contextUsed, contextTokens)
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

export function countRosterIdleAgents(agents: Agent[]): number {
  return agents.filter((agent) => !agent.isAutomation && agent.status === 'idle').length
}

export function agentUsesGpu(agent: Agent): boolean {
  if (agent.isAutomation) return false
  if (agent.job === 'conductor') {
    return (agent.conductorMoveRemaining ?? 0) > 0
  }
  return agentIsWorking(agent)
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
  agent: Pick<Agent, 'job' | 'status' | 'jobProgress' | 'jobDuration' | 'conductorMoveRemaining'>,
  task: Pick<Task, 'storyPointsRequired' | 'storyPointsEarned' | 'testStoryPointsEarned'> | null,
  role?: TaskWorkRole,
): number | null {
  if (agent.conductorMoveRemaining && agent.conductorMoveRemaining > 0) {
    return Math.min(
      100,
      ((CONDUCTOR_MOVE_TOKEN_COST - agent.conductorMoveRemaining) / CONDUCTOR_MOVE_TOKEN_COST) * 100,
    )
  }
  if (agent.status === 'idle' || agent.status === 'compacting' || agent.job === 'conductor') {
    return null
  }
  if (!task || !role) return null
  const required = taskTokensRequired(task.storyPointsRequired, role)
  const earned = taskEarnedTokens(task, role)
  if (agent.job === 'code' || agent.job === 'test' || agent.job === 'review') {
    return required > 0 ? Math.min(100, (earned / required) * 100) : null
  }
  if (agent.job === 'refine' && agent.jobDuration > 0) {
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

export function totalRamGb(state: Pick<GameState, 'agentSlotPurchases' | 'meta'>): number {
  return BASE_RAM_GB + state.agentSlotPurchases * RAM_PER_UPGRADE_GB
}

export function agentRamGb(effectiveParams: number, contextRamLevel: number): number {
  return effectiveParams + contextRamLevel
}

export function rosterAgentRamGb(
  agents: Agent[],
  contextRamLevel: number,
  paramsFor: (agent: Agent) => number,
): number {
  return agents.reduce((sum, agent) => sum + agentRamGb(paramsFor(agent), contextRamLevel), 0)
}

export function availableRamGb(state: GameState, paramsFor: (agent: Agent) => number): number {
  return totalRamGb(state) - rosterAgentRamGb(state.agents, state.contextRamLevel ?? 0, paramsFor)
}

export function totalAgentSlots(state: Pick<GameState, 'agentSlotPurchases' | 'meta'>): number {
  return totalRamGb(state)
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
  return HOUSING_CONFIG[apartment].maxRamPurchases
}

export function maxGpuTickPurchases(apartment: GameState['apartment']): number {
  return HOUSING_CONFIG[apartment].maxGpuPurchases - BASE_GPU_TICKS
}

export function maxAgents(state: GameState): number {
  const params = effectiveModelParams(state.meta)
  const perAgent = agentRamGb(params, state.contextRamLevel ?? 0)
  if (perAgent <= 0) return state.agents.length
  return state.agents.length + Math.max(0, Math.floor(availableRamGb(state, () => params) / perAgent))
}

export function canFitAgentRam(
  state: GameState,
  additionalParams: number,
  paramsFor: (agent: Agent) => number,
): boolean {
  return availableRamGb(state, paramsFor) >= agentRamGb(additionalParams, state.contextRamLevel ?? 0)
}

/** @deprecated Use gpuShareForAgents. */
export function agentTickSpeed(agents: Agent[], totalTicks: number): number {
  return gpuShareForAgents(agents, totalTicks)
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
  if (!job || agentIsAutomationJob(job)) return base
  if (job === 'code') {
    base *= codeHallucinationParamMultiplier(meta)
  }
  const tuneRole = job === 'conductor' ? 'conductor' : job
  if (tuneRole === 'procurement' || tuneRole === 'sales' || tuneRole === 'marketing' || tuneRole === 'customer' || tuneRole === 'accounting' || tuneRole === 'project_manager' || tuneRole === 'offline') {
    return base
  }
  const tuneId = `tune-${modelTierIndex}-${tuneRole}`
  const level = getFineTuneLevel(fineTuneTiers, fineTunes, tuneId)
  if (level > 0) {
    return base * fineTuneMultiplier(level)
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

export function hasHotSwappingCourse(vibingCourses: string[]): boolean {
  return vibingCourses.includes('hot_swapping')
}

export function hasProjectManagerActive(agents: Agent[]): boolean {
  return hasActiveAutomationAgent(agents, 'project_manager')
}

export function automationAgentDutyLabel(job: AutomationAgentJob): string {
  switch (job) {
    case 'procurement':
      return 'Procuring upgrades'
    case 'sales':
      return 'Closing leads'
    case 'marketing':
      return 'Marketing funnel crimes'
    case 'customer':
      return 'Customer psychosis ops'
    case 'accounting':
      return 'Creative accounting'
    case 'project_manager':
      return 'Auto-delivering & conducting'
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
