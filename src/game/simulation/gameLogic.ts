import type {
  Agent,
  AgentJob,
  GameEvent,
  GameState,
  MainTabId,
  MetaProgress,
  Project,
  ProjectRoleCounts,
  Requirement,
  StaffJob,
  Task,
  TaskStatus,
} from '../types'
import { contextSizeForLevel, FINE_TUNE_MAX_TIER, fineTuneCost, fineTuneId, getModelTier, MODEL_TIERS } from '../models'
import {
  allReviewCommentsAddressed,
  CONDUCTOR_ROLE_PRIORITY,
  conductorRolePriority,
  createBugFixTask,
  createProjectFromLead,
  createReviewCommentTasks,
  createTutorialProject,
  generateLead,
  dispatchCodingTask,
  dispatchRefineTarget,
  dispatchReviewTask,
  dispatchTestTask,
  projectHasRefineWork,
  projectHasTestWork,
  projectRoleHasWork,
  refineRequirementToTasks,
  refineTaskToTasks,
  repairStaleCodingAssignments,
  resolvedReviewComments,
  syncTestScope,
  taskIsTested,
} from '../projects'
import { generateAgentName, generatePersonality } from '../personalities'
import {
  INITIAL_REPUTATION,
  JUST_MERGE_PR_QUALITY,
  LATE_FEE_PERCENT,
  LATE_REP_PENALTY_BASE,
  MAX_EVENTS,
  MAX_OFFLINE_SECONDS,
  MIN_OFFLINE_APPLY_SEC,
  ON_TIME_REP_BONUS,
  PRESTIGE_START_CASH,
  PROCUREMENT_CASH_FRACTION,
  RENT_INTERVAL_DAYS,
  SECONDS_PER_GAME_DAY,
  TICK_INTERVAL_MS,
} from '../constants'
import {
  agentRoleLabel,
  agentTickSpeed,
  bestOfNTier,
  clientLeadPipelineTarget,
  computePrBaseQuality,
  conductorTier,
  contextFillMultiplier,
  countAssignedPmAgents,
  countPmRoleAssignments,
  fillAgentContext,
  formatStoryPoints,
  getAgentParameters,
  hasOpenClientProjectSlot,
  getFineTuneLevel,
  gpuTickCost,
  hasActiveAutomationAgent,
  hasAutoConductorCourse,
  hasConductorCourse,
  hasOfflineCourse,
  hasPromptEngineering,
  isAutomationAgentUnlocked,
  jobStatusFor,
  maxAgentSlotPurchases,
  maxAgents,
  maxAgentsPerTask,
  maxAssignablePmAgents,
  maxConductorTeamSize,
  maxGpuTickPurchases,
  prQualityAfterComments,
  projectTeamSize,
  ramSlotCost,
  refineJobDurationDays,
  refinementTier,
  reviewJobDurationDays,
  rollBugAtQa,
  storyPointIncrement,
  storyPointProgressPerTick,
  testStoryPointIncrement,
  totalAgentSlots,
  totalGpuTicks,
  unlockedAutomationJobs,
  type AutomationAgentJob,
} from '../mechanics'
import { HOUSING_CONFIG, isSingularityEligible, nextHousingTier } from '../housing'
import {
  buyHallucinationUpgrade,
  canRetire,
  compactionDurationSec,
  getHallucinationLevel,
  hallucinationPointsFromRetirement,
  instantTestHallucinationChance,
  maxClientProjectSlots,
  nextHighestRung,
  refineHallucinationLevel,
  reviewHallucinationLevel,
  startingCapitalBonus,
  startingGpuBonus,
  startingRamBonus,
  type HallucinationTrack,
} from '../prestige'
import { createDefaultMeta } from '../meta'
import { mrrOnShip } from '../product'
import { formatCash } from '../cash'
import { derangeText, unhingedPrefix, unhingedTier } from '../unhinged'
import { VIBING_COURSES, vibingCourseCost } from '../upgrades'
import { createRngSeed } from '../rng'
import { ctxFrom, uid, withCtx, type SimCtx } from './simCtx'

export type { SimCtx } from './simCtx'

function availableLeadCount(leads: GameState['leads']): number {
  return leads.filter((l) => l.status === 'available').length
}

const EMPTY_PROJECT_ROLE_COUNTS: ProjectRoleCounts = {
  refine: 0,
  code: 0,
  review: 0,
  test: 0,
  conductor: 0,
}

function enforceClientProjectCap(state: GameState, ctx: SimCtx, at: number): GameState {
  const assignedPmAgents = countAssignedPmAgents(state.agents)
  const maxSlots = maxClientProjectSlots(state.meta, assignedPmAgents)
  const lockedNames: string[] = []
  const unlockedNames: string[] = []
  let unlockedCount = 0

  let projects = state.projects.map((p) => {
    if (p.kind !== 'client' || p.status !== 'active') return p

    const shouldUnlock = unlockedCount < maxSlots
    if (shouldUnlock) {
      unlockedCount++
      if (p.isLocked) {
        unlockedNames.push(p.clientName)
        return { ...p, isLocked: false }
      }
      return p
    }

    if (!p.isLocked) lockedNames.push(p.clientName)
    return {
      ...p,
      isLocked: true,
      roleCounts: { ...EMPTY_PROJECT_ROLE_COUNTS },
      useConductor: false,
    }
  })

  const lockedIds = new Set(projects.filter((p) => p.isLocked).map((p) => p.id))
  let agents = state.agents.map((a) => (a.projectId && lockedIds.has(a.projectId) ? clearAgentJob(a) : a))
  for (const projectId of lockedIds) {
    projects = clampRoleCountsToStaffed(projectId, agents, projects)
  }

  const pipelineTarget = clientLeadPipelineTarget(state.meta, assignedPmAgents, projects)
  const available = state.leads.filter((l) => l.status === 'available')
  const nonAvailable = state.leads.filter((l) => l.status !== 'available')
  const trimmedAvailable = available.slice(0, pipelineTarget)
  const leads =
    available.length > pipelineTarget ? [...nonAvailable, ...trimmedAvailable] : state.leads

  let events = state.events
  if (lockedNames.length > 0) {
    events = pushEvent(
      ctx,
      state.meta,
      events,
      'project',
      `Project Manager off duty — ${lockedNames.join(', ')} locked. Agents pulled; lead pipeline capped.`,
      at,
    )
  } else if (unlockedNames.length > 0) {
    events = pushEvent(
      ctx,
      state.meta,
      events,
      'project',
      `Project Manager on duty — ${unlockedNames.join(', ')} unlocked.`,
      at,
    )
  }

  return { ...state, agents, projects, leads, events }
}

type ProjectRole = keyof ProjectRoleCounts

function isProjectRole(job: AgentJob): job is ProjectRole {
  return (
    job === 'refine' ||
    job === 'code' ||
    job === 'review' ||
    job === 'test' ||
    job === 'conductor'
  )
}

function eventMessage(ctx: SimCtx, meta: MetaProgress, message: string): string {
  const tier = unhingedTier(meta.totalHallucinationsEarned)
  return unhingedPrefix(tier) + derangeText(message, tier, ctx.rng.state)
}

function pushEvent(
  ctx: SimCtx,
  meta: MetaProgress,
  events: GameEvent[],
  type: GameEvent['type'],
  message: string,
  at: number,
): GameEvent[] {
  const entry: GameEvent = { id: uid(ctx, 'evt'), timestamp: at, type, message: eventMessage(ctx, meta, message) }
  return [entry, ...events].slice(0, MAX_EVENTS)
}


function emptyAgentJob(): Pick<Agent, 'job' | 'taskId' | 'projectId' | 'jobProgress' | 'jobDuration' | 'status'> {
  return { job: null, taskId: null, projectId: null, jobProgress: 0, jobDuration: 0, status: 'idle' }
}

function clearAgentJob(agent: Agent): Agent {
  return { ...agent, ...emptyAgentJob(), contextUsed: 0, compactingRemainingSec: 0 }
}

function finishCompaction(agent: Agent): Agent {
  return {
    ...agent,
    contextUsed: 0,
    compactingRemainingSec: 0,
    status: jobStatusFor(agent.job),
  }
}

function createAgent(ctx: SimCtx): Agent {
  return {
    id: uid(ctx, 'agt'),
    name: generateAgentName(ctx.rng),
    ...emptyAgentJob(),
    personality: generatePersonality(ctx.rng),
    contextUsed: 0,
    compactingRemainingSec: 0,
    uptime: 0,
  }
}

function createAutomationAgent(ctx: SimCtx, automationJob: AutomationAgentJob): Agent {
  const agent = createAgent(ctx)
  agent.isAutomation = true
  agent.automationJob = automationJob
  agent.job = automationJob
  agent.status = jobStatusFor(automationJob)
  return agent
}

export function reconcileSpecialistAgents(state: GameState, ctx: SimCtx): GameState {
  const unlocked = unlockedAutomationJobs(state)
  const assignedRoles = state.assignedSpecialistRoles.filter((job) =>
    unlocked.includes(job as AutomationAgentJob),
  )

  let agents = state.agents.filter((a) => {
    if (!a.isAutomation || !a.automationJob) return true
    if (a.automationJob === 'project_manager') {
      return countPmRoleAssignments(assignedRoles) > 0
    }
    return assignedRoles.includes(a.automationJob)
  })

  const requiredPm = countPmRoleAssignments(assignedRoles)
  let currentPm = countAssignedPmAgents(agents)
  while (currentPm > requiredPm) {
    const idx = agents.findIndex((a) => a.isAutomation && a.automationJob === 'project_manager')
    if (idx < 0) break
    agents = [...agents.slice(0, idx), ...agents.slice(idx + 1)]
    currentPm -= 1
  }

  let spawned = 0
  let projects = state.projects
  for (const job of unlocked) {
    const required =
      job === 'project_manager' ? requiredPm : assignedRoles.includes(job) ? 1 : 0
    let existing = agents.filter((a) => a.isAutomation && a.automationJob === job).length
    while (existing < required) {
      if (agents.length >= maxAgents({ ...state, agents })) {
        const yeeted = yeetProjectAgentForRosterSlot(agents, projects)
        if (!yeeted) break
        agents = yeeted.agents
        projects = yeeted.projects
      }
      agents.push(createAutomationAgent(ctx, job))
      spawned += 1
      existing += 1
    }
  }

  const rolesChanged =
    countPmRoleAssignments(assignedRoles) !== countPmRoleAssignments(state.assignedSpecialistRoles) ||
    unlocked.some(
      (job) =>
        job !== 'project_manager' &&
        assignedRoles.includes(job) !== state.assignedSpecialistRoles.includes(job),
    )
  const agentsChanged = agents.length !== state.agents.length
  const projectsChanged = projects !== state.projects
  if (!rolesChanged && !agentsChanged && !projectsChanged && spawned === 0) return state

  return {
    ...state,
    assignedSpecialistRoles: assignedRoles,
    agents,
    projects,
    stats:
      spawned > 0
        ? { ...state.stats, agentsDeployed: state.stats.agentsDeployed + spawned }
        : state.stats,
  }
}

/** @deprecated Use reconcileSpecialistAgents */
export const syncAutomationAgents = reconcileSpecialistAgents

export function toggleSpecialistRole(
  state: GameState,
  job: AutomationAgentJob,
  enabled: boolean,
  at: number,
): GameState {
  if (!isAutomationAgentUnlocked(state, job)) return state

  const ctx = ctxFrom(state)
  const label = agentRoleLabel(job)

  if (job === 'project_manager') {
    const assigned = countPmRoleAssignments(state.assignedSpecialistRoles)
    const maxPm = maxAssignablePmAgents(state)
    if (enabled && assigned >= maxPm) return state
    if (!enabled && assigned <= 0) return state

    if (!enabled) {
      if (assigned <= 0) return state
      const pmIdx = state.agents.findIndex((a) => a.isAutomation && a.automationJob === 'project_manager')
      const removedAgent = pmIdx >= 0 ? state.agents[pmIdx]! : null
      const roleIdx = state.assignedSpecialistRoles.indexOf('project_manager')
      if (roleIdx < 0 && pmIdx < 0) return state
      let nextState: GameState = {
        ...state,
        assignedSpecialistRoles: [
          ...state.assignedSpecialistRoles.slice(0, roleIdx),
          ...state.assignedSpecialistRoles.slice(roleIdx + 1),
        ],
        agents:
          pmIdx >= 0
            ? [...state.agents.slice(0, pmIdx), ...state.agents.slice(pmIdx + 1)]
            : state.agents,
        events: pushEvent(
          ctx,
          state.meta,
          state.events,
          'system',
          removedAgent
            ? `${removedAgent.name} (${label}) unassigned — roster slot freed.`
            : `${label} specialist unassigned — roster slot freed.`,
          at,
        ),
      }
      return withCtx(enforceClientProjectCap(nextState, ctx, at), ctx, at)
    }

    let agents = state.agents
    let projects = state.projects
    let yeetNote = ''

    if (agents.length >= maxAgents(state)) {
      const yeeted = yeetProjectAgentForRosterSlot(agents, projects)
      if (!yeeted) return state
      agents = yeeted.agents
      projects = yeeted.projects
      const project = projects.find((p) => p.id === yeeted.yeeted.projectId)
      yeetNote = ` Yeeted ${yeeted.yeeted.name} off ${project?.clientName ?? 'a project'} for roster space.`
    }

    const agent = createAutomationAgent(ctx, job)
    let nextState: GameState = {
      ...state,
      assignedSpecialistRoles: [...state.assignedSpecialistRoles, job],
      agents: [...agents, agent],
      projects,
      stats: { ...state.stats, agentsDeployed: state.stats.agentsDeployed + 1 },
      events: pushEvent(
        ctx,
        state.meta,
        state.events,
        'system',
        `${agent.name} (${label}) assigned to specialist duty.${yeetNote}`,
        at,
      ),
    }
    return withCtx(enforceClientProjectCap(nextState, ctx, at), ctx, at)
  }

  const isAssigned = state.assignedSpecialistRoles.includes(job)
  if (enabled === isAssigned) return state

  if (!enabled) {
    const nextAgents = state.agents.filter((a) => !(a.isAutomation && a.automationJob === job))
    return withCtx(
      {
        ...state,
        assignedSpecialistRoles: state.assignedSpecialistRoles.filter((role) => role !== job),
        agents: nextAgents,
        events: pushEvent(
          ctx,
          state.meta,
          state.events,
          'system',
          `${label} specialist unassigned — roster slot freed.`,
          at,
        ),
      },
      ctx,
      at,
    )
  }

  if (state.agents.some((a) => a.isAutomation && a.automationJob === job)) {
    return withCtx(
      {
        ...state,
        assignedSpecialistRoles: state.assignedSpecialistRoles.includes(job)
          ? state.assignedSpecialistRoles
          : [...state.assignedSpecialistRoles, job],
      },
      ctx,
      at,
    )
  }

  let agents = state.agents
  let projects = state.projects
  let yeetNote = ''

  if (agents.length >= maxAgents(state)) {
    const yeeted = yeetProjectAgentForRosterSlot(agents, projects)
    if (!yeeted) return state
    agents = yeeted.agents
    projects = yeeted.projects
    const project = projects.find((p) => p.id === yeeted.yeeted.projectId)
    yeetNote = ` Yeeted ${yeeted.yeeted.name} off ${project?.clientName ?? 'a project'} for roster space.`
  }

  const agent = createAutomationAgent(ctx, job)
  return withCtx(
    {
      ...state,
      assignedSpecialistRoles: [...state.assignedSpecialistRoles, job],
      agents: [...agents, agent],
      projects,
      stats: { ...state.stats, agentsDeployed: state.stats.agentsDeployed + 1 },
      events: pushEvent(
        ctx,
        state.meta,
        state.events,
        'system',
        `${agent.name} (${label}) assigned to specialist duty.${yeetNote}`,
        at,
      ),
    },
    ctx,
    at,
  )
}

export function applyOfflineProgress(
  state: GameState,
  elapsedSec: number,
  at: number,
): GameState {
  if (!hasOfflineCourse(state.vibingCourses) || state.phase !== 'playing') return state

  const capped = Math.min(Math.max(0, elapsedSec), MAX_OFFLINE_SECONDS)
  if (capped < MIN_OFFLINE_APPLY_SEC) return state

  const tickSec = TICK_INTERVAL_MS / 1000
  let advanced = state
  let remaining = capped
  while (remaining > 0) {
    const chunk = Math.min(remaining, tickSec)
    advanced = advanceTime(advanced, chunk, at)
    remaining -= chunk
  }

  const ctx = ctxFrom(advanced)
  const awayMinutes = Math.floor(capped / 60)
  const awayLabel =
    awayMinutes >= 60
      ? `${Math.floor(awayMinutes / 60)}h ${awayMinutes % 60}m`
      : `${awayMinutes}m`

  return withCtx(
    {
      ...advanced,
      events: pushEvent(
        ctx,
        state.meta,
        advanced.events,
        'system',
        `Away for ${awayLabel}. Offline Agent hallucinated the elapsed time.`,
        at,
      ),
    },
    ctx,
    at,
  )
}

/** Auto-assign or unassign the Offline specialist when the app tab hides or shows. */
export function syncOfflineSpecialist(state: GameState, tabHidden: boolean, at: number): GameState {
  if (!hasOfflineCourse(state.vibingCourses)) return state

  const isAssigned = state.assignedSpecialistRoles.includes('offline')
  if (tabHidden && !isAssigned) {
    return toggleSpecialistRole(state, 'offline', true, at)
  }
  if (!tabHidden && isAssigned) {
    return toggleSpecialistRole(state, 'offline', false, at)
  }
  return state
}

export function createInitialState(
  at: number,
  rngSeed?: number,
  meta: MetaProgress = createDefaultMeta(),
  options?: { includeTutorial?: boolean },
): GameState {
  const seed = rngSeed ?? createRngSeed()
  const includeTutorial =
    options?.includeTutorial ?? (meta.retirementCount === 0 && meta.singularityCount === 0)
  const ctx = ctxFrom({ nextId: 1, rng: seed, snapshotAt: at } as GameState)

  const agents: Agent[] = []
  const projects: Project[] = []
  let tutorialDone = !includeTutorial
  let cash = PRESTIGE_START_CASH + startingCapitalBonus(meta)
  let leads = [] as GameState['leads']
  let dayZeroMessage = `Day 0. ${formatCash(cash)}. Fresh prestige run. Hallucinations optional.`

  if (includeTutorial) {
    const tutorial = createTutorialProject(ctx)
    tutorial.roleCounts.refine = 1
    projects.push(tutorial)
    const starter = createAgent(ctx)
    starter.job = 'refine'
    starter.projectId = tutorial.id
    starter.status = 'refining'
    agents.push(starter)
    cash = 0
    tutorialDone = false
    dayZeroMessage = 'Day 0. $0. One agent. One laptop. Infinite audacity.'
  } else {
    leads = [generateLead(ctx, INITIAL_REPUTATION, 0)]
    dayZeroMessage = `Day 0. ${formatCash(cash)}. No tutorial. One lead on the board.`
  }

  const state: GameState = {
    meta,
    phase: 'playing',
    cash,
    reputation: INITIAL_REPUTATION,
    gameDay: 0,
    rentDueInDays: RENT_INTERVAL_DAYS,
    apartment: 'cardboard',
    apartmentLeaseRemaining: RENT_INTERVAL_DAYS,
    agentSlotPurchases: includeTutorial ? 0 : startingRamBonus(meta),
    gpuTickPurchases: includeTutorial ? 0 : startingGpuBonus(meta),
    mrr: 0,
    productFeaturesShipped: 0,
    purchasedFineTunes: [],
    fineTuneTiers: {},
    vibingCourses: [],
    vibingCourseTiers: {},
    assignedSpecialistRoles: [],
    agents,
    projects,
    productBacklog: [],
    leads,
    selectedTaskId: null,
    tutorialDone,
    seenStoryIntro: false,
    acknowledgedTutorialStep: -1,
    seenTabIntros: [],
    seenCompactionIntro: false,
    syntheticLeadCooldown: 4,
    taxCodeCooldown: 10,
    events: pushEvent(ctx, meta, [], 'system', dayZeroMessage, at),
    stats: {
      projectsCompleted: 0,
      tasksMerged: 0,
      agentsDeployed: agents.length,
      compactionsSurvived: 0,
      productsShipped: 0,
      syntheticLeadsAccepted: 0,
    },
    snapshotAt: at,
    rng: ctx.rng.state,
    nextId: ctx.ids.nextId,
  }
  return withCtx(state, ctx, at)
}

function findTask(projects: Project[], taskId: string): { project: Project; task: Task } | null {
  for (const project of projects) {
    const matches = project.tasks.filter((t) => t.id === taskId)
    if (matches.length === 0) continue
    const task = matches.find((t) => !t.isReviewComment) ?? matches[0]!
    return { project, task }
  }
  return null
}

function updateTask(projects: Project[], taskId: string, updater: (t: Task) => Task): Project[] {
  return projects.map((p) => ({
    ...p,
    tasks: p.tasks.map((t) => (t.id === taskId ? updater(t) : t)),
  }))
}

function agentParamsFor(
  state: Pick<GameState, 'meta' | 'purchasedFineTunes' | 'fineTuneTiers'>,
  job: AgentJob | null,
): number {
  const modelTierIndex = getHallucinationLevel(state.meta, 'model')
  return getAgentParameters(
    state.meta,
    state.purchasedFineTunes,
    job,
    modelTierIndex,
    state.fineTuneTiers,
  )
}

function canSpawnAgent(state: GameState): boolean {
  return state.agents.length < maxAgents(state)
}

function isAgentBusy(agent: Agent): boolean {
  if (!agent.job) return false
  if (agent.status === 'compacting') return true
  if (agent.job === 'conductor') return false
  return agentIsWorking(agent)
}

function isAgentStaffable(agent: Agent): boolean {
  if (agent.isAutomation) return false
  if (agent.job === null) return true
  if (agent.job === 'conductor' || agent.status === 'compacting') return false
  return !isAgentBusy(agent)
}

function agentIsWorking(agent: Agent): boolean {
  return (
    agent.status === 'working' ||
    agent.status === 'reviewing' ||
    agent.status === 'refining' ||
    agent.status === 'testing'
  )
}

function projectAgents(projectId: string, job: AgentJob, agents: Agent[]): Agent[] {
  return agents.filter((a) => a.projectId === projectId && a.job === job)
}

/** Context fill granted per conductor worker reassignment (one logical beat, not frame-scaled). */
const CONDUCTOR_REASSIGN_CONTEXT_SEC = 1

type ConductorReassignmentTick = {
  simCtx: SimCtx
  meta: MetaProgress
  contextSize: number
  baseSpeed: number
  ctxMult: number
  contextTokens: number
  compactDuration: number
  at: number
  events: GameEvent[]
  stats: GameState['stats']
}

function conductorCanAutoStaff(agents: Agent[], projectId: string): boolean {
  const conductor = agents.find((a) => a.projectId === projectId && a.job === 'conductor')
  if (!conductor) return false
  return conductor.status !== 'compacting' && conductor.status !== 'compacted' && conductor.status !== 'crashed'
}

function gainConductorContextOnReassignment(
  agents: Agent[],
  projectId: string,
  tick: ConductorReassignmentTick,
): Agent[] {
  const idx = agents.findIndex((a) => a.projectId === projectId && a.job === 'conductor')
  if (idx < 0) return agents
  const conductor = agents[idx]!
  if (conductor.status === 'compacting' || conductor.status === 'compacted' || conductor.status === 'crashed') {
    return agents
  }

  const agent = { ...conductor }
  fillAgentContext(agent, tick.contextSize, tick.baseSpeed, CONDUCTOR_REASSIGN_CONTEXT_SEC, tick.ctxMult)
  if (agent.contextUsed >= tick.contextTokens) {
    agent.contextUsed = tick.contextTokens
    agent.status = 'compacting'
    agent.compactingRemainingSec = tick.compactDuration
    tick.stats = { ...tick.stats, compactionsSurvived: tick.stats.compactionsSurvived + 1 }
    tick.events = pushEvent(
      tick.simCtx,
      tick.meta,
      tick.events,
      'crash',
      `${agent.name} context full — rebooting (${tick.compactDuration}s)...`,
      tick.at,
    )
  }

  const next = [...agents]
  next[idx] = agent
  return next
}

function buildConductorReassignmentTick(
  simCtx: SimCtx,
  state: Pick<GameState, 'meta' | 'vibingCourses' | 'gpuTickPurchases'>,
  agents: Agent[],
  events: GameEvent[],
  stats: GameState['stats'],
  at: number,
): ConductorReassignmentTick {
  const modelTierIndex = getHallucinationLevel(state.meta, 'model')
  const model = getModelTier(modelTierIndex)!
  const contextSize = contextSizeForLevel(model.contextSize, getHallucinationLevel(state.meta, 'context'))
  return {
    simCtx,
    meta: state.meta,
    contextSize,
    baseSpeed: agentTickSpeed(agents, totalGpuTicks(state)),
    ctxMult: contextFillMultiplier(state.vibingCourses),
    contextTokens: contextSize * 1000,
    compactDuration: compactionDurationSec(state.meta),
    at,
    events,
    stats,
  }
}

function assignAgentToRole(agent: Agent, projectId: string, job: AgentJob): Agent {
  return {
    ...agent,
    job,
    projectId,
    taskId: null,
    jobProgress: 0,
    jobDuration: 0,
    status:
      agent.status === 'compacting'
        ? 'compacting'
        : job === 'conductor'
          ? 'conducting'
          : 'idle',
  }
}

function updateRequirement(
  projects: Project[],
  requirementId: string,
  updater: (requirement: Requirement) => Requirement,
): Project[] {
  return projects.map((p) => ({
    ...p,
    requirements: p.requirements.map((r) => (r.id === requirementId ? updater(r) : r)),
  }))
}

const YEET_ROLE_ORDER: AgentJob[] = ['test', 'review', 'code', 'refine', 'conductor']

function pickProjectAgentToYeet(agents: Agent[], projects: Project[]): Agent | null {
  const candidates = agents.filter((a) => {
    if (a.isAutomation || !a.projectId || !a.job || !isProjectRole(a.job)) return false
    if (a.job === 'conductor') {
      const project = projects.find((p) => p.id === a.projectId)
      if (project?.useConductor) return false
    }
    return true
  })
  if (candidates.length === 0) return null

  const roleRank = new Map(YEET_ROLE_ORDER.map((job, index) => [job, index]))

  candidates.sort((a, b) => {
    const busyA = isAgentBusy(a) ? 1 : 0
    const busyB = isAgentBusy(b) ? 1 : 0
    if (busyA !== busyB) return busyA - busyB
    const rankA = roleRank.get(a.job!) ?? YEET_ROLE_ORDER.length
    const rankB = roleRank.get(b.job!) ?? YEET_ROLE_ORDER.length
    return rankA - rankB
  })

  return candidates[0]!
}

function yeetProjectAgentForRosterSlot(
  agents: Agent[],
  projects: Project[],
): { agents: Agent[]; projects: Project[]; yeeted: Agent } | null {
  const victim = pickProjectAgentToYeet(agents, projects)
  if (!victim?.projectId || !victim.job || !isProjectRole(victim.job)) return null

  const projectId = victim.projectId
  const job = victim.job
  const unassigned = unassignAgentFromRole(agents, projectId, job, projects, { force: true })
  if (!unassigned) return null

  const nextAgents = unassigned.agents.filter((a) => a.id !== victim.id)
  let nextProjects = unassigned.projects.map((p) =>
    p.id === projectId
      ? {
          ...p,
          roleCounts: {
            ...p.roleCounts,
            [job]: Math.max(0, p.roleCounts[job] - 1),
          },
        }
      : p,
  )
  nextProjects = clampRoleCountsToStaffed(projectId, nextAgents, nextProjects)

  return { agents: nextAgents, projects: nextProjects, yeeted: victim }
}

function unassignAgentFromRole(
  agents: Agent[],
  projectId: string,
  job: AgentJob,
  projects: Project[],
  options?: { force?: boolean },
): { agents: Agent[]; projects: Project[] } | null {
  const inRole = projectAgents(projectId, job, agents)
  const idleInRole = inRole.filter((a) => !isAgentBusy(a))
  const candidates = idleInRole.length > 0 ? idleInRole : options?.force ? inRole : []
  const victim = candidates[candidates.length - 1]
  if (!victim) return null

  let nextProjects = projects
  if (job === 'refine' && victim.taskId && victim.jobDuration > 0) {
    const project = projects.find((p) => p.id === projectId)
    const isRequirement = project?.requirements.some((r) => r.id === victim.taskId)
    if (isRequirement) {
      nextProjects = updateRequirement(nextProjects, victim.taskId, (r) => ({
        ...r,
        refineJobProgress: victim.jobProgress,
        refineJobDuration: victim.jobDuration,
      }))
    } else {
      nextProjects = updateTask(nextProjects, victim.taskId, (t) => ({
        ...t,
        refineJobProgress: victim.jobProgress,
        refineJobDuration: victim.jobDuration,
      }))
    }
  }
  if (job === 'review' && victim.taskId && victim.jobDuration > 0) {
    nextProjects = updateTask(nextProjects, victim.taskId, (t) => ({
      ...t,
      reviewJobProgress: victim.jobProgress,
      reviewJobDuration: victim.jobDuration,
    }))
  }

  return {
    agents: agents.map((a) =>
      a.id === victim.id
        ? {
            ...a,
            job: null,
            projectId: null,
            taskId: null,
            jobProgress: 0,
            jobDuration: 0,
            status: a.status === 'compacting' ? 'compacting' : 'idle',
          }
        : a,
    ),
    projects: nextProjects,
  }
}

function staffAgentForRole(
  ctx: SimCtx,
  state: GameState,
  agents: Agent[],
  projectId: string,
  job: AgentJob,
  projects: Project[],
  options?: { stealFromOtherProjects?: boolean },
): { agents: Agent[]; agentId: string; projects: Project[] } | null {
  const stealFromOtherProjects = options?.stealFromOtherProjects ?? true
  const unassignedIdx = agents.findIndex((a) => a.job === null && !a.isAutomation)
  if (unassignedIdx >= 0) {
    const next = [...agents]
    const assigned = assignAgentToRole(next[unassignedIdx], projectId, job)
    next[unassignedIdx] = assigned
    return { agents: next, agentId: assigned.id, projects }
  }

  const idleCandidates = agents
    .map((a, idx) => ({ a, idx }))
    .filter(
      ({ a }) =>
        a.job !== null &&
        a.job !== job &&
        a.job !== 'conductor' &&
        !a.isAutomation &&
        !isAgentBusy(a) &&
        (stealFromOtherProjects || a.projectId === projectId),
    )
  if (idleCandidates.length > 0) {
    idleCandidates.sort((x, y) => {
      const xPri = CONDUCTOR_ROLE_PRIORITY.indexOf(x.a.job as StaffJob)
      const yPri = CONDUCTOR_ROLE_PRIORITY.indexOf(y.a.job as StaffJob)
      if (xPri !== yPri) return yPri - xPri
      return y.idx - x.idx
    })
    const idleIdx = idleCandidates[0]!.idx
    const next = [...agents]
    const donor = next[idleIdx]!
    const oldJob = donor.job!
    const oldProjectId = donor.projectId!
    const assigned = assignAgentToRole(donor, projectId, job)
    next[idleIdx] = assigned
    const nextProjects = projects.map((p) =>
      p.id === oldProjectId && isProjectRole(oldJob)
        ? { ...p, roleCounts: { ...p.roleCounts, [oldJob]: Math.max(0, p.roleCounts[oldJob] - 1) } }
        : p,
    )
    return { agents: next, agentId: assigned.id, projects: nextProjects }
  }

  if (!canSpawnAgent({ ...state, agents })) return null
  const agent = createAgent(ctx)
  agent.job = job
  agent.projectId = projectId
  agent.status = job === 'conductor' ? 'conducting' : 'idle'
  return { agents: [...agents, agent], agentId: agent.id, projects }
}

function hasStaffableAgent(agents: Agent[]): boolean {
  return agents.some(isAgentStaffable)
}

function mergeTaskOnProject(
  projects: Project[],
  taskId: string,
  state: Pick<GameState, 'meta' | 'purchasedFineTunes' | 'fineTuneTiers' | 'vibingCourses'>,
  reviewed: boolean,
): { projects: Project[]; eventMessage: string } | null {
  const found = findTask(projects, taskId)
  if (!found || found.task.status !== 'pr_ready') return null
  if (reviewed && !found.task.reviewed) return null

  const authorParams = found.task.completedByAgentId
    ? agentParamsFor(state, 'code')
    : agentParamsFor(state, 'code')

  const resolvedCount = reviewed ? resolvedReviewComments(found.project, taskId).length : 0
  const base =
    reviewed && found.task.prQualityStaging > 0
      ? found.task.prQualityStaging
      : computePrBaseQuality(
          authorParams,
          found.task.storyPointsRequired,
          hasPromptEngineering(state.vibingCourses),
        )
  const prQuality = reviewed
    ? prQualityAfterComments(base, resolvedCount)
    : JUST_MERGE_PR_QUALITY

  const commentTasks = found.project.tasks.filter(
    (t) => t.isReviewComment && t.parentTaskId === taskId,
  )
  const unresolvedComments = commentTasks.filter(
    (t) => t.storyPointsEarned < t.storyPointsRequired,
  )

  const nextProjects = projects.map((p) => {
    if (p.id !== found.project.id) return p
    const updatedTasks = p.tasks
      .filter((t) => !(t.isReviewComment && t.parentTaskId === taskId))
      .map((t) =>
        t.id === taskId && !t.isReviewComment
          ? {
              ...t,
              status: 'merged' as const,
              prQuality,
              hasUndiscoveredBug: false,
            }
          : t,
      )
    return syncTestScope({ ...p, tasks: updatedTasks })
  })

  const orphanNote =
    unresolvedComments.length > 0
      ? ` ${unresolvedComments.length} review comment${unresolvedComments.length > 1 ? 's' : ''} left to rot in GitHub purgatory.`
      : ''
  const eventMessage = reviewed
    ? `Merged "${found.task.title}". PR quality: ${Math.round(prQuality)}%.${orphanNote}`
    : `Just Merged "${found.task.title}". PR quality: ${Math.round(prQuality)}%. YOLO.${orphanNote}`

  return { projects: nextProjects, eventMessage }
}

function tryAutoMergeReviewedPr(
  projects: Project[],
  parentTaskId: string,
  state: Pick<GameState, 'meta' | 'purchasedFineTunes' | 'fineTuneTiers' | 'vibingCourses'>,
): { projects: Project[]; eventMessage: string | null } {
  const found = findTask(projects, parentTaskId)
  if (!found || found.task.status !== 'pr_ready' || !found.task.reviewed) {
    return { projects, eventMessage: null }
  }
  if (!allReviewCommentsAddressed(found.project, parentTaskId)) {
    return { projects, eventMessage: null }
  }
  const result = mergeTaskOnProject(projects, parentTaskId, state, true)
  if (!result) return { projects, eventMessage: null }
  return { projects: result.projects, eventMessage: result.eventMessage }
}

function sweepAutoMergeReviewedPrs(
  projects: Project[],
  state: Pick<GameState, 'meta' | 'purchasedFineTunes' | 'fineTuneTiers' | 'vibingCourses'>,
): { projects: Project[]; eventMessages: string[] } {
  let nextProjects = projects
  const eventMessages: string[] = []

  for (const project of nextProjects) {
    if (project.status !== 'active' || project.isLocked) continue
    const candidates = project.tasks.filter(
      (t) => !t.isReviewComment && t.status === 'pr_ready' && t.reviewed,
    )
    for (const task of candidates) {
      const result = tryAutoMergeReviewedPr(nextProjects, task.id, state)
      nextProjects = result.projects
      if (result.eventMessage) eventMessages.push(result.eventMessage)
    }
  }

  return { projects: nextProjects, eventMessages }
}

function tryProgressTask(
  projects: Project[],
  taskId: string,
  completedByAgentId: string | null,
  authorParams: number,
  gameDay: number,
  promptEngineering = false,
  progressScale = 1,
  deltaSec = 1,
): { projects: Project[]; becameDone: boolean; becamePrReady: boolean } {
  let becameDone = false
  let becamePrReady = false
  const next = updateTask(projects, taskId, (t) => {
    if (t.status === 'merged' || t.status === 'pr_ready') return t
    if (t.isReviewComment && t.status === 'done') return t
    const increment = storyPointIncrement(
      t.storyPointsRequired,
      t.storyPointsEarned,
      authorParams * progressScale,
      gameDay,
      deltaSec,
    )
    const earned = Math.min(t.storyPointsRequired, t.storyPointsEarned + increment)
    const complete = earned >= t.storyPointsRequired
    const status: TaskStatus = complete
      ? t.isReviewComment
        ? 'done'
        : 'pr_ready'
      : 'in_progress'
    if (complete) {
      if (t.isReviewComment) becameDone = true
      else becamePrReady = true
    }
    const prQualityStaging =
      complete && !t.isReviewComment
        ? computePrBaseQuality(authorParams, t.storyPointsRequired, promptEngineering)
        : t.prQualityStaging
    return {
      ...t,
      storyPointsEarned: earned,
      status,
      prQualityStaging,
      completedByAgentId: complete ? completedByAgentId : t.completedByAgentId,
    }
  })
  return { projects: next, becameDone, becamePrReady }
}

function projectHasConductorManageableWork(
  project: Project,
  agents: Agent[],
  agentsPerTask: number,
): boolean {
  return conductorRolePriority(project).some((role) =>
    projectRoleHasWork(project, role, 'conductor', agents, agentsPerTask),
  )
}

function canStaffConductorOnProject(state: GameState, agents: Agent[], projectId: string): boolean {
  if (agents.some((a) => a.job === null && !a.isAutomation)) return true
  if (canSpawnAgent({ ...state, agents })) return true
  return agents.some(
    (a) =>
      a.projectId === projectId &&
      a.job !== null &&
      a.job !== 'conductor' &&
      !a.isAutomation &&
      !isAgentBusy(a),
  )
}

function priorConductorProjectsBlockStaffing(
  activeProjects: Project[],
  projectId: string,
  agents: Agent[],
  state: GameState,
  agentsPerTask: number,
): boolean {
  const projectIndex = activeProjects.findIndex((p) => p.id === projectId)
  if (projectIndex <= 0) return false

  for (let i = 0; i < projectIndex; i++) {
    const prior = activeProjects[i]!
    if (!prior.useConductor) continue
    if (projectAgents(prior.id, 'conductor', agents).length > 0) continue
    if (!projectHasConductorManageableWork(prior, agents, agentsPerTask)) continue
    if (canStaffConductorOnProject(state, agents, prior.id)) return true
  }
  return false
}

function evictLowestPriorityIdleWorker(
  agents: Agent[],
  projectId: string,
  projects: Project[],
): { agents: Agent[]; projects: Project[] } | null {
  const idleWorkers = agents
    .filter(
      (a) =>
        a.projectId === projectId &&
        a.job &&
        a.job !== 'conductor' &&
        a.status === 'idle' &&
        isProjectRole(a.job),
    )
    .sort(
      (a, b) =>
        CONDUCTOR_ROLE_PRIORITY.indexOf(b.job as StaffJob) -
        CONDUCTOR_ROLE_PRIORITY.indexOf(a.job as StaffJob),
    )
  const victim = idleWorkers[0]
  if (!victim?.job || !isProjectRole(victim.job)) return null
  return unassignAgentFromRole(agents, projectId, victim.job, projects)
}

function reconcileProjectStaffing(
  ctx: SimCtx,
  state: GameState,
  project: Project,
  agents: Agent[],
  projects: Project[],
  conductorTick?: ConductorReassignmentTick,
): { agents: Agent[]; projects: Project[] } {
  let nextAgents = [...agents]
  let nextProjects = projects
  const agentsPerTask = maxAgentsPerTask(bestOfNTier(state.vibingCourseTiers))

  const syncedProject = () => nextProjects.find((p) => p.id === project.id) ?? project
  let hadWorkerReassignment = false
  const noteWorkerReassignment = () => {
    hadWorkerReassignment = true
  }

  if (project.useConductor && hasConductorCourse(state.vibingCourses)) {
    const conductors = projectAgents(project.id, 'conductor', nextAgents)
    const hasConductor = conductors.length > 0
    const desiredConductor = project.useConductor ? 1 : project.roleCounts.conductor > 0 ? 1 : 0

    if (desiredConductor > 0 && !hasConductor) {
      const activeProjects = nextProjects.filter((p) => p.status === 'active' && !p.isLocked)
      const canStaffConductor =
        projectHasConductorManageableWork(syncedProject(), nextAgents, agentsPerTask) &&
        canStaffConductorOnProject({ ...state, agents: nextAgents }, nextAgents, project.id) &&
        !priorConductorProjectsBlockStaffing(
          activeProjects,
          project.id,
          nextAgents,
          { ...state, agents: nextAgents },
          agentsPerTask,
        )
      if (canStaffConductor) {
        const staffed = staffAgentForRole(
          ctx,
          { ...state, agents: nextAgents },
          nextAgents,
          project.id,
          'conductor',
          nextProjects,
          { stealFromOtherProjects: false },
        )
        if (staffed) {
          nextAgents = staffed.agents
          nextProjects = staffed.projects
        }
      }
    }
    if (desiredConductor === 0 && hasConductor) {
      const result = unassignAgentFromRole(nextAgents, project.id, 'conductor', nextProjects)
      if (result) {
        nextAgents = result.agents
        nextProjects = result.projects
      }
    }

    if (conductorCanAutoStaff(nextAgents, project.id)) {
      const maxTeam = maxConductorTeamSize(conductorTier(state.vibingCourseTiers, state.vibingCourses))
      const workers = nextAgents.filter(
        (a) => a.projectId === project.id && a.job && a.job !== 'conductor',
      )

      for (const w of workers) {
        if (
          w.job &&
          w.job !== 'conductor' &&
          isProjectRole(w.job) &&
          w.status === 'idle' &&
          !projectRoleHasWork(syncedProject(), w.job as StaffJob, w.id, nextAgents, agentsPerTask)
        ) {
          const result = unassignAgentFromRole(nextAgents, project.id, w.job, nextProjects)
          if (result) {
            nextAgents = result.agents
            nextProjects = result.projects
            noteWorkerReassignment()
          }
        }
      }

      while (projectTeamSize(nextAgents, project.id) > maxTeam) {
        const result = evictLowestPriorityIdleWorker(nextAgents, project.id, nextProjects)
        if (!result) break
        nextAgents = result.agents
        nextProjects = result.projects
        noteWorkerReassignment()
      }

      const rolePriority = conductorRolePriority(syncedProject())

      for (const role of rolePriority) {
        while (
          projectRoleHasWork(syncedProject(), role, 'conductor', nextAgents, agentsPerTask) &&
          (hasStaffableAgent(nextAgents) || canSpawnAgent({ ...state, agents: nextAgents }))
        ) {
          while (projectTeamSize(nextAgents, project.id) >= maxTeam) {
            const evicted = evictLowestPriorityIdleWorker(nextAgents, project.id, nextProjects)
            if (!evicted) break
            nextAgents = evicted.agents
            nextProjects = evicted.projects
            noteWorkerReassignment()
          }
          if (projectTeamSize(nextAgents, project.id) >= maxTeam) break
          const staffed = staffAgentForRole(
            ctx,
            { ...state, agents: nextAgents },
            nextAgents,
            project.id,
            role,
            nextProjects,
          )
          if (!staffed) break
          nextAgents = staffed.agents
          nextProjects = staffed.projects
          nextAgents = nextAgents.map((a) =>
            a.id === staffed.agentId
              ? {
                  ...a,
                  status: projectRoleHasWork(syncedProject(), role, a.id, nextAgents, agentsPerTask)
                    ? jobStatusFor(role)
                    : 'idle',
                }
              : a,
          )
          noteWorkerReassignment()
        }
      }
    }
    if (hadWorkerReassignment && conductorTick) {
      nextAgents = gainConductorContextOnReassignment(nextAgents, project.id, conductorTick)
    }
    return { agents: nextAgents, projects: nextProjects }
  }

  for (const role of ['refine', 'code', 'review', 'test', 'conductor'] as const) {
    const desired = syncedProject().roleCounts[role]
    const current = projectAgents(project.id, role, nextAgents).length

    if (current > desired) {
      let toRemove = current - desired
      while (toRemove > 0) {
        const result = unassignAgentFromRole(nextAgents, project.id, role, nextProjects, { force: true })
        if (!result) break
        nextAgents = result.agents
        nextProjects = result.projects
        toRemove -= 1
      }
    }

    if (current < desired) {
      let toAdd = desired - projectAgents(project.id, role, nextAgents).length
      while (toAdd > 0) {
        if (!hasStaffableAgent(nextAgents) && !canSpawnAgent({ ...state, agents: nextAgents })) break
        const staffed = staffAgentForRole(
          ctx,
          { ...state, agents: nextAgents },
          nextAgents,
          project.id,
          role,
          nextProjects,
        )
        if (!staffed) break
        nextAgents = staffed.agents
        nextProjects = staffed.projects
        if (role !== 'conductor') {
          const hasWork =
            role === 'refine'
              ? projectHasRefineWork(syncedProject())
              : role === 'test'
                ? projectHasTestWork(syncedProject())
                : projectRoleHasWork(syncedProject(), role as StaffJob, staffed.agentId, nextAgents, agentsPerTask)
          nextAgents = nextAgents.map((a) =>
            a.id === staffed.agentId ? { ...a, status: hasWork ? jobStatusFor(role) : 'idle' } : a,
          )
        }
        toAdd -= 1
      }
    }
  }

  nextProjects = clampRoleCountsToStaffed(project.id, nextAgents, nextProjects)
  return { agents: nextAgents, projects: nextProjects }
}

function clampRoleCountsToStaffed(
  projectId: string,
  agents: Agent[],
  projects: Project[],
): Project[] {
  return projects.map((p) => {
    if (p.id !== projectId) return p
    const counts = { ...p.roleCounts }
    for (const role of ['refine', 'code', 'review', 'test', 'conductor'] as const) {
      const actual = projectAgents(projectId, role, agents).length
      if (counts[role] > actual) counts[role] = actual
    }
    return { ...p, roleCounts: counts }
  })
}

export function canStaffRoleOnProject(state: GameState, _projectId: string, job: AgentJob): boolean {
  if (!isProjectRole(job)) return false
  if (canSpawnAgent(state)) return true
  if (state.agents.some((a) => a.job === null && !a.isAutomation)) return true
  return state.agents.some(
    (a) =>
      a.job !== null &&
      a.job !== job &&
      a.job !== 'conductor' &&
      isAgentStaffable(a),
  )
}


export function advanceTime(state: GameState, deltaSec: number, at: number): GameState {
  const ctx = ctxFrom(state)
  if (state.phase !== 'playing') return state

  const dayProgress = deltaSec / SECONDS_PER_GAME_DAY
  let {
    cash,
    reputation,
    gameDay,
    rentDueInDays,
    apartmentLeaseRemaining,
    agents,
    projects,
    leads,
    events,
    stats,
    selectedTaskId,
    vibingCourses,
    mrr,
    agentSlotPurchases,
    gpuTickPurchases,
    meta,
  } = {
    ...state,
    projects: repairStaleCodingAssignments(state.projects, state.agents),
  }

  let nextAgents = agents.map((a) => ({ ...a }))
  let nextProjects = projects.map((p) => ({
    ...p,
    requirements: p.requirements.map((r) => ({ ...r })),
    tasks: p.tasks.map((t) => ({ ...t })),
  }))
  let nextLeads = leads.map((l) => ({ ...l }))
  let nextEvents = [...events]
  let nextStats = { ...stats }
  const phase: GameState['phase'] = state.phase

  const modelTierIndex = getHallucinationLevel(meta, 'model')
  const model = getModelTier(modelTierIndex)!
  const contextSize = contextSizeForLevel(model.contextSize, getHallucinationLevel(meta, 'context'))
  const contextTokens = contextSize * 1000
  const compactDuration = compactionDurationSec(meta)
  const ctxMult = contextFillMultiplier(vibingCourses)
  const agentsPerTask = maxAgentsPerTask(bestOfNTier(state.vibingCourseTiers))
  const refineTier = refinementTier(state.vibingCourseTiers, vibingCourses)
  const totalGpus = totalGpuTicks({ ...state, gpuTickPurchases })

  gameDay += dayProgress
  rentDueInDays -= dayProgress
  apartmentLeaseRemaining -= dayProgress
  cash += mrr * dayProgress

  if (rentDueInDays <= 0) {
    const rent = HOUSING_CONFIG[state.apartment].rent
    cash -= rent
    rentDueInDays += RENT_INTERVAL_DAYS
    nextEvents = pushEvent(
      ctx,
      meta,
      nextEvents,
      'system',
      `Rent due: -${formatCash(rent)}. Landlord sends a heart emoji.`,
      at,
    )
  }

  if (isAutomationAgentUnlocked({ vibingCourses, meta }, 'procurement') && hasActiveAutomationAgent(nextAgents, 'procurement')) {
    const budget = cash * PROCUREMENT_CASH_FRACTION
    const slotCost = ramSlotCost(agentSlotPurchases)
    const tickCost = gpuTickCost(gpuTickPurchases)
    const maxSlots = maxAgentSlotPurchases(state.apartment)
    const maxTicks = maxGpuTickPurchases(state.apartment)
    if (agentSlotPurchases < maxSlots && slotCost <= budget && cash >= slotCost) {
      cash -= slotCost
      agentSlotPurchases += 1
      nextEvents = pushEvent(
        ctx,
        meta,
        nextEvents,
        'milestone',
        `Procurement auto-bought +1 RAM for ${formatCash(slotCost)}.`,
        at,
      )
    } else if (gpuTickPurchases < maxTicks && tickCost <= budget && cash >= tickCost) {
      cash -= tickCost
      gpuTickPurchases += 1
      nextEvents = pushEvent(
        ctx,
        meta,
        nextEvents,
        'milestone',
        `Procurement auto-bought +1 GPU for ${formatCash(tickCost)}.`,
        at,
      )
    }
  }

  const pipelineTarget = clientLeadPipelineTarget(
    meta,
    countAssignedPmAgents(state.agents),
    nextProjects,
  )
  if (
    state.tutorialDone &&
    availableLeadCount(nextLeads) < pipelineTarget
  ) {
    nextLeads = [generateLead(ctx, reputation, gameDay), ...nextLeads]
    nextEvents = pushEvent(ctx, meta, nextEvents, 'lead', 'New client lead appeared. They want it yesterday.', at)
  }

  for (const project of nextProjects) {
    if (project.status !== 'active' || project.isLocked) continue
    project.daysRemaining -= dayProgress

    if (project.daysRemaining <= 0 && !project.tasks.every((t) => t.status === 'merged')) {
      project.lateCount += 1
      project.daysRemaining += Math.round(project.durationDays * 0.35)
      const fee = Math.round(project.payment * LATE_FEE_PERCENT * project.lateCount)
      project.payment = Math.max(0, project.payment - fee)
      const repHit = Math.round(LATE_REP_PENALTY_BASE * project.repPenaltyMultiplier * project.lateCount)
      reputation = Math.max(0, reputation - repHit)
      project.repPenaltyMultiplier += 0.25
      nextEvents = pushEvent(
        ctx,
        meta,
        nextEvents,
        'project',
        `${project.clientName}: LATE. -${formatCash(fee)} fee, -${repHit} rep. Extension granted. Suffering continues.`,
        at,
      )
    }
  }

  const baseSpeedGlobal = agentTickSpeed(nextAgents, totalGpus)
  const conductorTick = buildConductorReassignmentTick(
    ctx,
    { ...state, gpuTickPurchases },
    nextAgents,
    nextEvents,
    nextStats,
    at,
  )

  for (const project of nextProjects.filter((p) => p.status === 'active' && !p.isLocked)) {
    const reconciled = reconcileProjectStaffing(ctx, state, project, nextAgents, nextProjects, conductorTick)
    nextAgents = reconciled.agents
    nextProjects = reconciled.projects
  }
  nextEvents = conductorTick.events
  nextStats = conductorTick.stats

  const dispatchSlots = new Map<string, Map<string, number>>()
  const slotsFor = (projectId: string, role: StaffJob): Map<string, number> => {
    const key = `${projectId}:${role}`
    let slots = dispatchSlots.get(key)
    if (!slots) {
      slots = new Map()
      dispatchSlots.set(key, slots)
    }
    return slots
  }

  for (let agentIdx = 0; agentIdx < nextAgents.length; agentIdx++) {
    let agent = nextAgents[agentIdx]
    if (agent.status === 'compacting') {
      agent.compactingRemainingSec = Math.max(0, agent.compactingRemainingSec - deltaSec)
      if (agent.compactingRemainingSec > 0) {
        nextAgents[agentIdx] = agent
        continue
      }
      agent = finishCompaction(agent)
      nextAgents[agentIdx] = agent
      nextEvents = pushEvent(ctx, meta, nextEvents, 'crash', `${agent.name} rebooted. Back on task.`, at)
    }
  }

  for (let agentIdx = 0; agentIdx < nextAgents.length; agentIdx++) {
    let agent = nextAgents[agentIdx]
    if (!agent.job || agent.job === 'conductor' || agent.isAutomation) continue
    if (agent.status === 'compacting' || agent.status === 'compacted' || agent.status === 'crashed') {
      continue
    }

    const baseSpeed = baseSpeedGlobal
    if (baseSpeed <= 0) continue

    agent.uptime += dayProgress
    const params = agentParamsFor(state, agent.job)

    const overflow = () => {
      agent.taskId = null
      agent.jobProgress = 0
      agent.jobDuration = 0
      agent.status = 'compacting'
      agent.compactingRemainingSec = compactDuration
      agent.contextUsed = contextTokens
      nextStats.compactionsSurvived += 1
      nextEvents = pushEvent(
        ctx,
        meta,
        nextEvents,
        'crash',
        `${agent.name} context full — rebooting (${compactDuration}s)...`,
        at,
      )
    }

    if (agent.job === 'code' && agent.projectId) {
              const project = nextProjects.find((p) => p.id === agent.projectId)
              if (!project || project.status !== 'active' || project.isLocked) {
                Object.assign(agent, clearAgentJob(agent))
                continue
              }

              const nextTask = dispatchCodingTask(
                project,
                agent.id,
                nextAgents,
                agentsPerTask,
                slotsFor(project.id, 'code'),
              )
              if (!nextTask) {
                agent.status = 'idle'
                agent.taskId = null
                nextAgents[agentIdx] = agent
                continue
              }

              agent.status = 'working'
              agent.taskId = nextTask.id
              if (nextTask.status === 'open') {
                nextProjects = updateTask(nextProjects, nextTask.id, (t) => ({
                  ...t,
                  status: 'in_progress',
                }))
              }
              const taskRef = { project, task: nextTask }

              fillAgentContext(agent, contextSize, baseSpeed, deltaSec, ctxMult)
              if (agent.contextUsed >= contextTokens) {
                overflow()
                continue
              }

              const result = tryProgressTask(
                nextProjects,
                nextTask.id,
                agent.id,
                params,
                gameDay,
                hasPromptEngineering(vibingCourses),
                baseSpeed,
                deltaSec,
              )
              nextProjects = result.projects
              if (result.becamePrReady) {
                agent.taskId = null
                nextEvents = pushEvent(
                  ctx,
                  meta,
                  nextEvents,
                  'project',
                  `${agent.name} finished "${taskRef.task.title}". PR opened — ready for review.`,
                  at,
                )
              } else if (result.becameDone) {
                agent.taskId = null
                const parentId = taskRef.task.parentTaskId
                nextEvents = pushEvent(
                  ctx,
                  meta,
                  nextEvents,
                  'project',
                  `${agent.name} addressed review comment: "${taskRef.task.title}".`,
                  at,
                )
                if (parentId) {
                  const parent = findTask(nextProjects, parentId)
                  if (parent) {
                    const resolved = resolvedReviewComments(parent.project, parentId).length
                    const staging = prQualityAfterComments(
                      parent.task.prQualityStaging,
                      resolved,
                    )
                    nextProjects = updateTask(nextProjects, parentId, (t) => ({
                      ...t,
                      prQualityStaging: staging,
                    }))
                  }
                  const autoMerge = tryAutoMergeReviewedPr(nextProjects, parentId, state)
                  nextProjects = autoMerge.projects
                  if (autoMerge.eventMessage) {
                    nextEvents = pushEvent(ctx, meta, nextEvents, 'project', autoMerge.eventMessage, at)
                    nextStats.tasksMerged += 1
                  }
                }
              }
            } else if (agent.job === 'review' && agent.projectId) {
              const project = nextProjects.find((p) => p.id === agent.projectId)
              if (!project || project.status !== 'active' || project.isLocked) {
                Object.assign(agent, clearAgentJob(agent))
                continue
              }

              const task = dispatchReviewTask(
                project,
                agent.id,
                nextAgents,
                agentsPerTask,
                slotsFor(project.id, 'review'),
              )
              if (!task) {
                agent.status = 'idle'
                agent.taskId = null
                agent.jobProgress = 0
                agent.jobDuration = 0
                nextAgents[agentIdx] = agent
                continue
              }

              agent.status = 'reviewing'
              agent.taskId = task.id
              const reviewDuration =
                task.reviewJobDuration ?? reviewJobDurationDays(task.storyPointsRequired, params)
              let reviewProgress = task.reviewJobProgress ?? 0

              fillAgentContext(agent, contextSize, baseSpeed, deltaSec, ctxMult)
              if (agent.contextUsed >= contextTokens) {
                nextProjects = updateTask(nextProjects, task.id, (t) => ({
                  ...t,
                  reviewJobProgress: reviewProgress,
                  reviewJobDuration: reviewDuration,
                }))
                overflow()
                continue
              }

              reviewProgress += dayProgress * baseSpeed
              nextProjects = updateTask(nextProjects, task.id, (t) => ({
                ...t,
                reviewJobProgress: reviewProgress,
                reviewJobDuration: reviewDuration,
              }))
              agent.jobProgress = reviewProgress
              agent.jobDuration = reviewDuration

              if (reviewProgress >= reviewDuration) {
                const comments = createReviewCommentTasks(ctx, task, reviewHallucinationLevel(meta))
                nextProjects = nextProjects.map((p) =>
                  p.id === project.id
                    ? {
                        ...p,
                        tasks: [
                          ...p.tasks.map((t) =>
                            t.id === task.id
                              ? {
                                  ...t,
                                  reviewed: true,
                                  reviewJobProgress: undefined,
                                  reviewJobDuration: undefined,
                                }
                              : t,
                          ),
                          ...comments,
                        ],
                      }
                    : p,
                )
                agent.jobProgress = 0
                agent.taskId = null
                const commentNote =
                  comments.length > 0
                    ? ` Left ${comments.length} review comment${comments.length > 1 ? 's' : ''}.`
                    : ''
                nextEvents = pushEvent(
                  ctx,
                  meta,
                  nextEvents,
                  'project',
                  `${agent.name} reviewed "${task.title}". PR quality base: ${Math.round(task.prQualityStaging)}%.${commentNote}`,
                  at,
                )

                const autoMerge = tryAutoMergeReviewedPr(nextProjects, task.id, state)
                nextProjects = autoMerge.projects
                if (autoMerge.eventMessage) {
                  nextEvents = pushEvent(ctx, meta, nextEvents, 'project', autoMerge.eventMessage, at)
                  nextStats.tasksMerged += 1
                }
              }
            } else if (agent.job === 'refine' && agent.projectId) {
              const project = nextProjects.find((p) => p.id === agent.projectId)
              if (!project || project.status !== 'active' || project.isLocked) {
                Object.assign(agent, clearAgentJob(agent))
                continue
              }

              const target = dispatchRefineTarget(
                project,
                agent.id,
                nextAgents,
                agentsPerTask,
                slotsFor(project.id, 'refine'),
              )
              if (!target) {
                agent.status = 'idle'
                agent.taskId = null
                agent.jobProgress = 0
                agent.jobDuration = 0
                nextAgents[agentIdx] = agent
                continue
              }

              const targetId =
                target.kind === 'requirement' ? target.requirement.id : target.task.id
              const targetTitle =
                target.kind === 'requirement' ? target.requirement.title : target.task.title
              const targetSp =
                target.kind === 'requirement'
                  ? target.requirement.storyPoints
                  : target.task.storyPointsRequired
              const savedProgress =
                target.kind === 'requirement'
                  ? {
                      refineJobProgress: target.requirement.refineJobProgress,
                      refineJobDuration: target.requirement.refineJobDuration,
                    }
                  : {
                      refineJobProgress: target.task.refineJobProgress,
                      refineJobDuration: target.task.refineJobDuration,
                    }

              agent.status = 'refining'
              agent.taskId = targetId
              const refineDuration =
                savedProgress.refineJobDuration ??
                refineJobDurationDays(targetSp, params)
              let refineProgress = savedProgress.refineJobProgress ?? 0
              agent.jobProgress = refineProgress
              agent.jobDuration = refineDuration

              fillAgentContext(agent, contextSize, baseSpeed, deltaSec, ctxMult)
              if (agent.contextUsed >= contextTokens) {
                if (target.kind === 'requirement') {
                  nextProjects = updateRequirement(nextProjects, targetId, (r) => ({
                    ...r,
                    refineJobProgress: refineProgress,
                    refineJobDuration: refineDuration,
                  }))
                } else {
                  nextProjects = updateTask(nextProjects, targetId, (t) => ({
                    ...t,
                    refineJobProgress: refineProgress,
                    refineJobDuration: refineDuration,
                  }))
                }
                overflow()
                continue
              }

              refineProgress += dayProgress * baseSpeed
              agent.jobProgress = refineProgress
              if (target.kind === 'requirement') {
                nextProjects = updateRequirement(nextProjects, targetId, (r) => ({
                  ...r,
                  refineJobProgress: refineProgress,
                  refineJobDuration: refineDuration,
                }))
              } else {
                nextProjects = updateTask(nextProjects, targetId, (t) => ({
                  ...t,
                  refineJobProgress: refineProgress,
                  refineJobDuration: refineDuration,
                }))
              }

              if (refineProgress >= refineDuration) {
                const newTasks =
                  target.kind === 'requirement'
                    ? refineRequirementToTasks(ctx, target.requirement, { refinementTier: refineTier })
                    : refineTaskToTasks(ctx, target.task)
                const refinedStatus = newTasks.length > 1 ? ('split' as const) : ('refined' as const)
                nextProjects = nextProjects.map((p) => {
                  if (p.id !== project.id) return p
                  if (target.kind === 'requirement') {
                    return {
                      ...p,
                      requirements: p.requirements.map((r) =>
                        r.id === target.requirement.id
                          ? {
                              ...r,
                              status: refinedStatus,
                              refineJobProgress: undefined,
                              refineJobDuration: undefined,
                            }
                          : r,
                      ),
                      tasks: [...p.tasks, ...newTasks],
                    }
                  }
                  return {
                    ...p,
                    tasks: [
                      ...p.tasks.filter((t) => t.id !== target.task.id),
                      ...newTasks,
                    ],
                  }
                })
                if (!selectedTaskId) selectedTaskId = newTasks[0].id
                const taskSummary =
                  newTasks.length > 1
                    ? `split "${targetTitle}" into ${newTasks.length} tasks (${newTasks.map((t) => formatStoryPoints(t.storyPointsRequired)).join(' + ')} SP)`
                    : `refined "${targetTitle}" into "${newTasks[0].title}" (${formatStoryPoints(newTasks[0].storyPointsRequired)} SP)`
                nextEvents = pushEvent(ctx, meta, nextEvents, 'project', `${agent.name} ${taskSummary}.`, at)
                agent.jobProgress = 0
                agent.taskId = null
              }
            } else if (agent.job === 'test' && agent.projectId) {
              const project = nextProjects.find((p) => p.id === agent.projectId)
              if (!project || project.status !== 'active' || project.isLocked) {
                Object.assign(agent, clearAgentJob(agent))
                continue
              }

              const testTask = dispatchTestTask(
                project,
                agent.id,
                nextAgents,
                agentsPerTask,
                slotsFor(project.id, 'test'),
              )
              if (!testTask) {
                agent.status = 'idle'
                agent.taskId = null
                nextAgents[agentIdx] = agent
                continue
              }

              const prevTestTaskId = agent.taskId
              agent.status = 'testing'
              agent.taskId = testTask.id
              let instantQa = false
              if (prevTestTaskId !== testTask.id) {
                const instantChance = instantTestHallucinationChance(meta)
                if (instantChance > 0 && ctx.rng.float() < instantChance) {
                  instantQa = true
                }
              }

              fillAgentContext(agent, contextSize, baseSpeed, deltaSec, ctxMult)
              if (agent.contextUsed >= contextTokens) {
                overflow()
                continue
              }

              const testEarned = instantQa
                ? testTask.storyPointsRequired
                : Math.min(
                    testTask.storyPointsRequired,
                    testTask.testStoryPointsEarned +
                      testStoryPointIncrement(
                        testTask.storyPointsRequired,
                        testTask.testStoryPointsEarned,
                        params * baseSpeed,
                        gameDay,
                        deltaSec,
                      ),
                  )
              const taskFullyTested = testEarned >= testTask.storyPointsRequired

              let introducedBug = false
              if (taskFullyTested && testTask.prQuality !== null) {
                introducedBug = rollBugAtQa(ctx.rng, testTask.prQuality)
              }

              nextProjects = updateTask(nextProjects, testTask.id, (t) => ({
                ...t,
                testStoryPointsEarned: testEarned,
                hasUndiscoveredBug: introducedBug,
                bugDiscovered: introducedBug ? true : t.bugDiscovered,
              }))

              const projectAfterTask = nextProjects.find((p) => p.id === project.id)
              if (projectAfterTask) {
                let updatedProject: Project = syncTestScope(projectAfterTask)

                if (taskFullyTested && introducedBug) {
                  const fixTask = createBugFixTask(ctx, testTask)
                  updatedProject = {
                    ...updatedProject,
                    tasks: updatedProject.tasks.concat(fixTask),
                    totalStoryPoints: updatedProject.totalStoryPoints + fixTask.storyPointsRequired,
                  }
                nextEvents = pushEvent(
                  ctx,
                  meta,
                  nextEvents,
                    'project',
                    `${agent.name} found a bug in "${testTask.title}". ${formatStoryPoints(fixTask.storyPointsRequired)} SP fix task opened. PR was ${Math.round(testTask.prQuality ?? 0)}% clean.`,
                    at,
                  )
                } else if (taskFullyTested) {
                nextEvents = pushEvent(
                  ctx,
                  meta,
                  nextEvents,
                    'project',
                    `${agent.name} finished QA on "${testTask.title}". Clean at ${Math.round(testTask.prQuality ?? 0)}%.`,
                    at,
                  )
                  agent.taskId = null
                }

                nextProjects = nextProjects.map((p) => (p.id === project.id ? updatedProject : p))
              }
            }

            nextAgents[agentIdx] = agent
          }

  const autoMergeSweep = sweepAutoMergeReviewedPrs(nextProjects, state)
  nextProjects = autoMergeSweep.projects
  for (const message of autoMergeSweep.eventMessages) {
    nextStats.tasksMerged += 1
    nextEvents = pushEvent(ctx, meta, nextEvents, 'project', message, at)
  }

  let tickState = withCtx({
    ...state,
    cash,
    reputation,
    gameDay,
    rentDueInDays,
    apartmentLeaseRemaining,
    agents: nextAgents,
    projects: nextProjects,
    leads: nextLeads,
    events: nextEvents,
    stats: nextStats,
    selectedTaskId,
    phase,
    mrr,
    agentSlotPurchases,
    gpuTickPurchases,
    tutorialDone: state.tutorialDone || !nextProjects.some((p) => p.isTutorial),
  }, ctx, at)

  if (vibingCourses.includes('sales') && hasActiveAutomationAgent(tickState.agents, 'sales')) {
    tickState = runSalesAutomation(tickState, at)
  }

  return tickState
}

export function selectTask(state: GameState, taskId: string | null, at: number): GameState {
  return { ...state, selectedTaskId: taskId, snapshotAt: at }
}

export function mergePr(state: GameState, taskId: string, at: number): GameState {
  const ctx = ctxFrom(state)
  const result = mergeTaskOnProject(state.projects, taskId, state, true)
  if (!result) return state
  return withCtx({
    ...state,
    projects: result.projects,
    stats: { ...state.stats, tasksMerged: state.stats.tasksMerged + 1 },
    events: pushEvent(ctx, state.meta, state.events, 'project', result.eventMessage, at),
  }, ctx, at)
}

export function justMergePr(state: GameState, taskId: string, at: number): GameState {
  const ctx = ctxFrom(state)
  const result = mergeTaskOnProject(state.projects, taskId, state, false)
  if (!result) return state
  return withCtx({
    ...state,
    projects: result.projects,
    stats: { ...state.stats, tasksMerged: state.stats.tasksMerged + 1 },
    events: pushEvent(ctx, state.meta, state.events, 'project', result.eventMessage, at),
  }, ctx, at)
}

export function acceptLead(state: GameState, leadId: string, at: number): GameState {
  const ctx = ctxFrom(state)
  const lead = state.leads.find((l) => l.id === leadId)
  if (!lead || lead.status !== 'available') return state
  if (state.reputation < lead.repRequired) return state
  if (!hasOpenClientProjectSlot(state.meta, state.agents, state.projects)) return state

  const project = createProjectFromLead(
    ctx,
    lead,
    state.gameDay,
    state.reputation,
    refineHallucinationLevel(state.meta),
  )
  const autoConductor =
    hasAutoConductorCourse(state.vibingCourses) && hasConductorCourse(state.vibingCourses)
  const projectWithConductor = autoConductor
    ? {
        ...project,
        useConductor: true,
        roleCounts: { ...project.roleCounts, conductor: 1, refine: 0, code: 0, review: 0, test: 0 },
      }
    : project
  const daysWaited = Math.max(0, Math.floor(state.gameDay - (lead.spawnedGameDay ?? state.gameDay)))
  const waitNote =
    daysWaited > 0 ? ` (${daysWaited}d wait shaved ${daysWaited}d off deadline)` : ''
  const syntheticAccepted = lead.source === 'synthetic'
  return withCtx({
    ...state,
    projects: [...state.projects, projectWithConductor],
    leads: state.leads.map((l) => (l.id === leadId ? { ...l, status: 'accepted' as const } : l)),
    stats: syntheticAccepted
      ? { ...state.stats, syntheticLeadsAccepted: state.stats.syntheticLeadsAccepted + 1 }
      : state.stats,
    events: pushEvent(
      ctx,
      state.meta,
      state.events,
      'lead',
      `Accepted ${lead.clientName}. ${projectWithConductor.durationDays}d to deliver.${waitNote}`,
      at,
    ),
  }, ctx, at)
}

export function rejectLead(state: GameState, leadId: string, at: number): GameState {
  const ctx = ctxFrom(state)
  return withCtx({
    ...state,
    leads: state.leads.map((l) => (l.id === leadId ? { ...l, status: 'rejected' as const } : l)),
    events: pushEvent(ctx, state.meta, state.events, 'lead', 'Lead rejected. Professional boundaries (for now).', at),
  }, ctx, at)
}

export function deliverProject(state: GameState, projectId: string, at: number): GameState {
  const ctx = ctxFrom(state)
  const project = state.projects.find((p) => p.id === projectId)
  if (!project || project.status !== 'active' || project.isLocked) return state
  if (!isReadyToDeliver(project)) return state

  const synced = syncTestScope(project)
  const payment = project.payment
  const onTime = project.lateCount === 0
  const qualityBonus = Math.round(synced.deliveryQuality / 25)
  const reputation = Math.max(0, state.reputation + (onTime ? ON_TIME_REP_BONUS + qualityBonus : 1))

  const duplicateId = project.duplicateProjectId
  const removedIds = new Set([projectId, ...(duplicateId ? [duplicateId] : [])])
  const nextProjects = state.projects.filter((p) => !removedIds.has(p.id))
  const nextAgents = state.agents.filter((a) => !a.projectId || !removedIds.has(a.projectId))

  let nextEvents = state.events
  let cash = state.cash
  let mrr = state.mrr
  let productFeaturesShipped = state.productFeaturesShipped
  let stats = { ...state.stats, projectsCompleted: state.stats.projectsCompleted + 1 }

  if (project.kind === 'product') {
    const mrrGain = mrrOnShip(project.totalStoryPoints, productFeaturesShipped, state.apartment)
    mrr += mrrGain
    productFeaturesShipped += 1
    stats = { ...stats, productsShipped: stats.productsShipped + 1 }
    nextEvents = pushEvent(
      ctx,
      state.meta,
      nextEvents,
      'product',
      `Shipped product feature! +${formatCash(mrrGain)}/day MRR. Monolith grows.`,
      at,
    )
  } else if (project.isTutorial && !state.tutorialDone) {
    cash += payment
    nextEvents = pushEvent(
      ctx,
      state.meta,
      nextEvents,
      'milestone',
      `Tutorial complete! +${formatCash(payment)}. Upgrade housing — unlock real hardware.`,
      at,
    )
  } else {
    cash += payment
    const dupNote = duplicateId ? ' PM duplicate cleared too.' : ''
    nextEvents = pushEvent(
      ctx,
      state.meta,
      nextEvents,
      'milestone',
      `Shipped ${project.clientName}! +${formatCash(payment)}${onTime ? ' (on time!)' : ''}. Avg PR quality ${Math.round(synced.deliveryQuality)}%.${dupNote}`,
      at,
    )
  }

  const tutorialJustCompleted = project.isTutorial && !state.tutorialDone
  const tutorialDone = state.tutorialDone || !nextProjects.some((p) => p.isTutorial)

  let nextLeads = state.leads
  if (tutorialJustCompleted) {
    nextLeads = [generateLead(ctx, reputation, state.gameDay)]
    nextEvents = pushEvent(
      ctx,
      state.meta,
      nextEvents,
      'lead',
      'New client lead appeared. They want it yesterday.',
      at,
    )
  } else if (tutorialDone) {
    const pipelineTarget = clientLeadPipelineTarget(
      state.meta,
      countAssignedPmAgents(state.agents),
      nextProjects,
    )
    if (availableLeadCount(nextLeads) < pipelineTarget) {
      nextLeads = [generateLead(ctx, reputation, state.gameDay), ...nextLeads]
      nextEvents = pushEvent(
        ctx,
        state.meta,
        nextEvents,
        'lead',
        'New client lead appeared. They want it yesterday.',
        at,
      )
    }
  }

  return withCtx({
    ...state,
    cash,
    reputation,
    mrr,
    productFeaturesShipped,
    projects: nextProjects,
    agents: nextAgents,
    leads: nextLeads,
    stats,
    events: nextEvents,
    tutorialDone,
  }, ctx, at)
}

function salesAutoAcceptSources(meta: MetaProgress): Set<'real' | 'synthetic'> {
  const sources = new Set<'real' | 'synthetic'>(['real'])
  if (getHallucinationLevel(meta, 'sales') > 0) {
    sources.add('synthetic')
  }
  return sources
}

function findAutoAcceptableLead(state: GameState): string | null {
  if (!hasOpenClientProjectSlot(state.meta, state.agents, state.projects)) return null
  const sources = salesAutoAcceptSources(state.meta)
  const lead = state.leads.find(
    (l) => l.status === 'available' && sources.has(l.source) && state.reputation >= l.repRequired,
  )
  return lead?.id ?? null
}

/** Auto-accept eligible leads and auto-deliver completed projects while Sales is on duty. */
function runSalesAutomation(state: GameState, at: number): GameState {
  let tickState = state
  for (;;) {
    let changed = false

    for (;;) {
      const leadId = findAutoAcceptableLead(tickState)
      if (!leadId) break
      const projectsBefore = tickState.projects.length
      tickState = acceptLead(tickState, leadId, at)
      if (tickState.projects.length <= projectsBefore) break
      changed = true
    }

    for (;;) {
      const deliverable = tickState.projects.find((p) => isReadyToDeliver(p))
      if (!deliverable) break
      tickState = deliverProject(tickState, deliverable.id, at)
      changed = true
    }

    if (!changed) break
  }
  return tickState
}

export function adjustRoleCount(state: GameState, projectId: string, job: AgentJob, delta: number, at: number): GameState {
  if (!isProjectRole(job)) return state
  const ctx = ctxFrom(state)
  const repaired = {
    ...state,
    projects: repairStaleCodingAssignments(state.projects, state.agents),
  }
  const project = repaired.projects.find((p) => p.id === projectId)
  if (!project || project.isLocked) return state

  if (delta > 0 && !canStaffRoleOnProject(repaired, projectId, job)) return state

  if (delta < 0) {
    const nextRoleCount = Math.max(0, project.roleCounts[job] + delta)
    const result = unassignAgentFromRole(repaired.agents, projectId, job, repaired.projects, { force: true })
    const nextProjects = repaired.projects.map((p) =>
      p.id === projectId
        ? { ...p, roleCounts: { ...p.roleCounts, [job]: nextRoleCount } }
        : p,
    )
    if (!result) {
      return withCtx({
        ...repaired,
        projects: nextProjects,
        events: pushEvent(
          ctx,
          repaired.meta,
          repaired.events,
          'project',
          `Reduced ${job} staffing on ${project.clientName} to ${nextRoleCount}.`,
          at,
        ),
      }, ctx, at)
    }
    return withCtx({
      ...repaired,
      agents: result.agents,
      projects: result.projects.map((p) =>
        p.id === projectId
          ? { ...p, roleCounts: { ...p.roleCounts, [job]: nextRoleCount } }
          : p,
      ),
      events: pushEvent(ctx, repaired.meta, repaired.events, 'project', `Pulled one ${job} agent off ${project.clientName}.`, at),
    }, ctx, at)
  }

  const nextProjects = repaired.projects.map((p) =>
    p.id === projectId
      ? { ...p, roleCounts: { ...p.roleCounts, [job]: p.roleCounts[job] + delta } }
      : p,
  )
  const updatedProject = nextProjects.find((p) => p.id === projectId)!
  const conductorTick = updatedProject.useConductor
    ? buildConductorReassignmentTick(ctx, repaired, repaired.agents, repaired.events, state.stats, at)
    : undefined
  const reconciled = reconcileProjectStaffing(
    ctx,
    repaired,
    updatedProject,
    repaired.agents,
    nextProjects,
    conductorTick,
  )
  const nextAgents = reconciled.agents
  const nextProjectsClamped = clampRoleCountsToStaffed(projectId, nextAgents, reconciled.projects)

  return withCtx({
    ...repaired,
    agents: nextAgents,
    projects: nextProjectsClamped,
    stats: {
      ...(conductorTick?.stats ?? state.stats),
      agentsDeployed: Math.max(state.stats.agentsDeployed, nextAgents.length),
    },
    events: pushEvent(
      ctx,
      state.meta,
      conductorTick?.events ?? state.events,
      'project',
      `Staffed +1 ${job} on ${project.clientName}.`,
      at,
    ),
  }, ctx, at)
}

export function toggleConductor(state: GameState, projectId: string, enabled: boolean, at: number): GameState {
  if (enabled && !hasConductorCourse(state.vibingCourses)) return state
  return {
    ...state,
    projects: state.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            useConductor: enabled,
            roleCounts: enabled
              ? { ...p.roleCounts, conductor: 1, refine: 0, code: 0, review: 0, test: 0 }
              : { ...p.roleCounts, conductor: 0 },
          }
        : p,
    ),
    snapshotAt: at,
  }
}

export function buyAgentSlot(state: GameState, at: number): GameState {
  const ctx = ctxFrom(state)
  const max = maxAgentSlotPurchases(state.apartment)
  if (state.agentSlotPurchases >= max) return state
  const cost = ramSlotCost(state.agentSlotPurchases)
  if (state.cash < cost) return state

  return withCtx(
    syncAutomationAgents(
      {
        ...state,
        cash: state.cash - cost,
        agentSlotPurchases: state.agentSlotPurchases + 1,
        events: pushEvent(
          ctx,
          state.meta,
          state.events,
          'milestone',
          `Bought +1 RAM for ${formatCash(cost)}. HR pretends this is normal.`,
          at,
        ),
      },
      ctx,
    ),
    ctx,
    at,
  )
}

export function buyGpuTick(state: GameState, at: number): GameState {
  const ctx = ctxFrom(state)
  const max = maxGpuTickPurchases(state.apartment)
  if (state.gpuTickPurchases >= max) return state
  const cost = gpuTickCost(state.gpuTickPurchases)
  if (state.cash < cost) return state

  return withCtx({
    ...state,
    cash: state.cash - cost,
    gpuTickPurchases: state.gpuTickPurchases + 1,
    events: pushEvent(
      ctx,
      state.meta,
      state.events,
      'milestone',
      `Bought +1 GPU for ${formatCash(cost)}. Fans spin. Morale does not.`,
      at,
    ),
  }, ctx, at)
}

export function upgradeModelTier(state: GameState, _at: number): GameState {
  return state
}

export function buyFineTune(state: GameState, fineTuneIdArg: string, at: number): GameState {
  const ctx = ctxFrom(state)
  const currentTier = getFineTuneLevel(state.fineTuneTiers, state.purchasedFineTunes, fineTuneIdArg)
  if (currentTier >= FINE_TUNE_MAX_TIER) return state
  const cost = fineTuneCost(currentTier)
  if (state.cash < cost) return state
  const tierMatch = fineTuneIdArg.match(/^tune-(\d+)-/)
  if (!tierMatch) return state
  const tier = Number(tierMatch[1])
  const modelTierIndex = getHallucinationLevel(state.meta, 'model')
  if (tier > modelTierIndex) return state

  const newTier = currentTier + 1
  const fineTuneTiers = { ...state.fineTuneTiers, [fineTuneIdArg]: newTier }
  const purchasedFineTunes =
    currentTier === 0 ? [...state.purchasedFineTunes, fineTuneIdArg] : state.purchasedFineTunes

  return withCtx({
    ...state,
    cash: state.cash - cost,
    purchasedFineTunes,
    fineTuneTiers,
    events: pushEvent(
      ctx,
      state.meta,
      state.events,
      'milestone',
      `Fine-tune T${newTier}: ${fineTuneIdArg}.`,
      at,
    ),
  }, ctx, at)
}

export function buyVibingCourse(state: GameState, courseId: string, at: number): GameState {
  const ctx = ctxFrom(state)
  const course = VIBING_COURSES.find((c) => c.id === courseId)
  if (!course) return state

  const currentTier =
    state.vibingCourseTiers[courseId] ?? (state.vibingCourses.includes(courseId) ? 1 : 0)
  const maxTier = course.maxTier ?? 1
  if (currentTier >= maxTier) return state

  const cost = vibingCourseCost(course, currentTier)
  if (state.cash < cost) return state

  const newTier = currentTier + 1
  const vibingCourseTiers = { ...state.vibingCourseTiers, [courseId]: newTier }
  const vibingCourses = state.vibingCourses.includes(courseId)
    ? state.vibingCourses
    : [...state.vibingCourses, courseId]
  const tierNote = maxTier > 1 ? ` (tier ${newTier}/${maxTier})` : ''

  return withCtx(
    syncAutomationAgents(
      {
        ...state,
        cash: state.cash - cost,
        vibingCourses,
        vibingCourseTiers,
        events: pushEvent(
          ctx,
          state.meta,
          state.events,
          'milestone',
          `Enrolled in ${course.label}${tierNote}: "${course.tagline}"`,
          at,
        ),
      },
      ctx,
    ),
    ctx,
    at,
  )
}

export function upgradeApartment(state: GameState, at: number): GameState {
  const ctx = ctxFrom(state)
  const next = nextHousingTier(state.apartment)
  if (!next) return state
  const cost = HOUSING_CONFIG[next].upgradeCost
  if (state.cash < cost) return state

  return withCtx({
    ...state,
    cash: state.cash - cost,
    apartment: next,
    apartmentLeaseRemaining: RENT_INTERVAL_DAYS,
    rentDueInDays: RENT_INTERVAL_DAYS,
    events: pushEvent(
      ctx,
      state.meta,
      state.events,
      'milestone',
      `Moved to ${HOUSING_CONFIG[next].label}. New hardware tiers unlocked.`,
      at,
    ),
  }, ctx, at)
}

export function retire(state: GameState, at: number): GameState {
  if (state.phase !== 'playing' || !canRetire(state.cash, state.meta.retirementCount)) return state

  const points = hallucinationPointsFromRetirement(state.cash, state.meta.highestRungEver)
  const newMeta: MetaProgress = {
    ...state.meta,
    hallucinationPoints: state.meta.hallucinationPoints + points,
    totalHallucinationsEarned: state.meta.totalHallucinationsEarned + points,
    highestRungEver: nextHighestRung(state.cash, state.meta.highestRungEver),
    retirementCount: state.meta.retirementCount + 1,
  }

  return createInitialState(at, state.rng, newMeta, { includeTutorial: false })
}

export function prestigeHallucinationBuy(
  state: GameState,
  track: HallucinationTrack,
  at: number,
): GameState {
  const ctx = ctxFrom(state)
  const newMeta = buyHallucinationUpgrade(state.meta, track)
  if (!newMeta) return state
  const level = getHallucinationLevel(newMeta, track)
  return withCtx(
    syncAutomationAgents(
      {
        ...state,
        meta: newMeta,
        events: pushEvent(
          ctx,
          state.meta,
          state.events,
          'hallucination',
          `Hallucination upgrade: ${track} → level ${level}.`,
          at,
        ),
      },
      ctx,
    ),
    ctx,
    at,
  )
}

export function acceptSingularity(state: GameState, at: number): GameState {
  const customerLevel = getHallucinationLevel(state.meta, 'customer')
  if (!isSingularityEligible(state.apartment, customerLevel)) return state

  const newMeta = createDefaultMeta()
  newMeta.singularityCount = state.meta.singularityCount + 1
  newMeta.totalHallucinationsEarned = state.meta.totalHallucinationsEarned

  return createInitialState(at, state.rng, newMeta, { includeTutorial: true })
}

export function resetGame(at: number, rngSeed?: number): GameState {
  return createInitialState(at, rngSeed)
}

export function acknowledgeTabIntro(state: GameState, tab: MainTabId, at: number): GameState {
  if (state.seenTabIntros.includes(tab)) return state
  return { ...state, seenTabIntros: [...state.seenTabIntros, tab], snapshotAt: at }
}

export function acknowledgeStoryIntro(state: GameState, at: number): GameState {
  if (state.seenStoryIntro) return state
  return { ...state, seenStoryIntro: true, snapshotAt: at }
}

export function acknowledgeTutorialStep(state: GameState, step: number, at: number): GameState {
  if (step <= state.acknowledgedTutorialStep) return state
  return { ...state, acknowledgedTutorialStep: step, snapshotAt: at }
}

export function acknowledgeCompactionIntro(state: GameState, at: number): GameState {
  if (state.seenCompactionIntro) return state
  return { ...state, seenCompactionIntro: true, snapshotAt: at }
}

export function getNetWorth(state: Pick<GameState, 'cash' | 'mrr'>): number {
  return state.cash + state.mrr * 30
}

export function getNextApartment(state: Pick<GameState, 'apartment'>): import('../types').ApartmentTier | null {
  return nextHousingTier(state.apartment)
}

export function projectProgressPct(project: Project): number {
  const merged = project.tasks
    .filter((t) => t.status === 'merged')
    .reduce((s, t) => s + t.storyPointsRequired, 0)
  return (merged / project.totalStoryPoints) * 100
}

export function isReadyToDeliver(project: Project): boolean {
  const synced = syncTestScope(project)
  const shippableTasks = project.tasks.filter((t) => !t.isReviewComment)
  const mergedImpl = shippableTasks.filter((t) => t.status === 'merged')
  return (
    project.status === 'active' &&
    project.requirements.every((r) => r.status !== 'open') &&
    shippableTasks.length > 0 &&
    shippableTasks.every((t) => t.status === 'merged') &&
    synced.testStoryPointsRequired > 0 &&
    mergedImpl.every(taskIsTested)
  )
}

export function modelSpPerTick(
  state: Pick<GameState, 'meta' | 'purchasedFineTunes' | 'fineTuneTiers' | 'gameDay'>,
): number {
  const params = agentParamsFor(state, 'code')
  return storyPointProgressPerTick(params, state.gameDay)
}

export function canStaffAdditionalAgent(state: GameState): boolean {
  return hasStaffableAgent(state.agents) || canSpawnAgent(state)
}

export function agentCapacity(state: GameState): {
  used: number
  max: number
  agentSlots: number
  gpuTicks: number
} {
  return {
    used: state.agents.length,
    max: maxAgents(state),
    agentSlots: totalAgentSlots(state),
    gpuTicks: totalGpuTicks(state),
  }
}

export { fineTuneId, getModelTier, MODEL_TIERS }
