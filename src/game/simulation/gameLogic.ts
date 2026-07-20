import type {
  Agent,
  AgentJob,
  GameEvent,
  GameState,
  LeadSource,
  MainTabId,
  MetaProgress,
  Project,
  ProjectRoleCounts,
  Requirement,
  StaffJob,
  Task,
  TaskStatus,
} from '../types'
import { FINE_TUNE_MAX_TIER, fineTuneCost, fineTuneId, getModelTier, MODEL_TIERS } from '../models'
import {
  allReviewCommentsAddressed,
  CONDUCTOR_ROLE_PRIORITY,
  agentsPerTaskForProject,
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
  projectHasConductorPipelineWork,
  projectHasRefineWork,
  projectHasTestWork,
  projectRoleHasWork,
  roleHasUnallocatedWork,
  refineRequirementToTasks,
  refineTaskToTasks,
  repairStaleCodingAssignments,
  stagedPrQualityFromReviews,
  effectiveReviewCommentResolutions,
  syncTestScope,
  taskIsTested,
  taskNeedsRefinement,
} from '../projects'
import {
  applyOutputTokensToContext,
  agentOutputTokensPerSec,
  conductorMoveStep,
  contextTokensForState,
  stackIndexOnTask,
} from './tokenSimulation'
import { generateAgentName, generatePersonality } from '../personalities'
import {
  CONDUCTOR_MOVE_TOKEN_COST,
  INITIAL_REPUTATION,
  JUST_MERGE_PR_QUALITY,
  LATE_FEE_PERCENT,
  LATE_REP_PENALTY_BASE,
  MAX_EVENTS,
  ON_TIME_REP_BONUS,
  PRESTIGE_START_CASH,
  PROCUREMENT_CASH_FRACTION,
  RENT_INTERVAL_DAYS,
  SECONDS_PER_GAME_DAY,
  STARTING_CAPITAL_BONUS_PER_LEVEL,
} from '../constants'
import {
  agentRoleLabel,
  getAgentRamParams,
  agentTokensPerSec,
  bestOfNStackMultiplier,
  canFitAgentRam,
  clientSlotsNeedingLeads,
  isClientSlotOccupiedByProject,
  availableLeadInSlot,
  clientLeadPipelineTarget,
  computePrBaseQuality,
  countAssignedPmAgents,
  formatStoryPoints,
  getAgentParameters,
  hasOpenClientProjectSlot,
  getFineTuneLevel,
  gpuTickCost,
  hasActiveAutomationAgent,
  hasConductorCourse,
  hasHotSwappingCourse,
  hasOfflineCourse,
  hasProjectManagerActive,
  hasProductOwnerActive,
  hasPromptEngineering,
  isAutomationAgentUnlocked,
  jobStatusFor,
  maxAgentSlotPurchases,
  maxAgents,
  maxGpuTickPurchases,
  prQualityAfterComments,
  ramSlotCost,
  refinementTier,
  rollBugAtQa,
  rosterAgentRamGb,
  taskTokensRequired,
  tokenProgressIncrement,
  effectiveGpuTicks,
  totalRamGb,
  unlockedAutomationJobs,
  type AutomationAgentJob,
} from '../mechanics'
import { HOUSING_CONFIG, effectiveHousingRent, effectiveHousingUpgradeCost, isSingularityEligible, nextHousingTier } from '../housing'
import {
  buyHallucinationUpgrade,
  canRetire,
  compactionDurationSec,
  baseClientProjectSlots,
  getHallucinationLevel,
  hallucinationPointsFromRetirement,
  instantTestHallucinationChance,
  maxClientProjectSlots,
  maxClientProjectSlotsCap,
  nextHighestRung,
  parallelVibesTier,
  refineHallucinationLevel,
  reviewHallucinationLevel,
  startingCapitalBonus,
  maxProductProjectSlots,
  timeDistillationMultiplier,
  effectiveMrr,
  type HallucinationTrack,
} from '../prestige'
import { createDefaultMeta } from '../meta'
import {
  activateProductFeature,
  canAccessProduct,
  countActiveProductProjects,
  ensureProductBacklogQueued,
  targetQueuedProductBacklogCount,
  mrrOnShip,
} from '../product'
import { formatCash } from '../cash'
import {
  accountingPaymentMultiplier,
  canMarketingSpawnSyntheticLeads,
  canToggleConductorOnProject,
  customerNegotiateMultiplier,
  marketingScopeMultiplier,
  pmAbsorbsClientConductor,
  projectUsesConductorAutomation,
  projectUsesVirtualConductor,
  shouldAutoConductorClientProject,
  syntheticLeadIntervalDays,
  syntheticLeadPayMultiplier,
} from '../hallucinationAutomation'
import { derangeText, unhingedPrefix, unhingedTier } from '../unhinged'
import { findCheapestProcurementPurchase, procurementEventMessage } from '../procurement'
import { VIBING_COURSES, isVibingCourseVisible, PRODUCT_OWNER_COURSE_ID, vibingCourseCost } from '../upgrades'
import { createRngSeed } from '../rng'
import { ctxFrom, uid, withCtx, type SimCtx } from './simCtx'
import type { SimulationDeltaResult } from './simulationDelta'

function spawnLeadForState(
  ctx: SimCtx,
  state: Pick<GameState, 'meta' | 'agents'>,
  reputation: number,
  gameDay: number,
  slotIndex: number,
  source: LeadSource = 'real',
) {
  const scopeMultiplier = marketingScopeMultiplier(state.meta, state.agents)
  const syntheticPayMult = source === 'synthetic' ? syntheticLeadPayMultiplier(state.meta) : 1
  return generateLead(ctx, reputation, gameDay, slotIndex, source, syntheticPayMult, scopeMultiplier)
}

function autoConductorRoleCounts(
  state: GameState,
  project: Project,
): ProjectRoleCounts {
  const virtual = project.kind === 'client' && pmAbsorbsClientConductor(state.meta, state.agents)
  return virtual
    ? { ...project.roleCounts, conductor: 0, refine: 0, code: 0, review: 0, test: 0 }
    : { ...project.roleCounts, conductor: 1, refine: 0, code: 0, review: 0, test: 0 }
}

export type { SimCtx } from './simCtx'

function availableLeadCount(leads: GameState['leads']): number {
  return leads.filter((l) => l.status === 'available').length
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
  const text = typeof message === 'string' ? message : ''
  return unhingedPrefix(tier) + derangeText(text, tier, ctx.rng.state)
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
      return state.assignedSpecialistRoles.includes('project_manager')
    }
    return state.assignedSpecialistRoles.includes(a.automationJob)
  })

  const requiredPm = state.assignedSpecialistRoles.includes('project_manager') ? 1 : 0
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
    requiredPm !== (state.assignedSpecialistRoles.includes('project_manager') ? 1 : 0) ||
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
    leads = [generateLead(ctx, INITIAL_REPUTATION, 0, 0)]
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
    agentSlotPurchases: 0,
    gpuTickPurchases: 0,
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
    conductorStaffQueueCursor: 0,
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

function rosterRamParams(state: Pick<GameState, 'meta'>, _agent: Agent): number {
  return getAgentRamParams(state.meta)
}

function canSpawnAgent(state: GameState): boolean {
  const perAgent = getAgentRamParams(state.meta)
  return canFitAgentRam(state, perAgent, (agent) => rosterRamParams(state, agent))
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

function queueConductorMoveCost(agents: Agent[], projectId: string): Agent[] {
  const idx = agents.findIndex((a) => a.projectId === projectId && a.job === 'conductor')
  if (idx < 0) return agents
  const conductor = agents[idx]!
  if (conductor.status === 'compacting' || conductor.status === 'compacted' || conductor.status === 'crashed') {
    return agents
  }
  if ((conductor.conductorMoveRemaining ?? 0) > 0) return agents
  const next = [...agents]
  next[idx] = { ...conductor, conductorMoveRemaining: CONDUCTOR_MOVE_TOKEN_COST, status: 'conducting' }
  return next
}

function conductorCanAutoStaff(
  agents: Agent[],
  projectId: string,
  state?: GameState,
  project?: Project,
): boolean {
  if (state && project && projectUsesVirtualConductor(state.meta, state.agents, project)) {
    return true
  }
  const conductor = agents.find((a) => a.projectId === projectId && a.job === 'conductor')
  if (!conductor) return false
  if ((conductor.conductorMoveRemaining ?? 0) > 0) return false
  return conductor.status !== 'compacting' && conductor.status !== 'compacted' && conductor.status !== 'crashed'
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

  const nextProjects = preserveAgentProgressOnRelease(victim, projectId, job, projects)

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

function preserveAgentProgressOnRelease(
  victim: Agent,
  projectId: string,
  job: AgentJob,
  projects: Project[],
): Project[] {
  let nextProjects = projects
  if (job === 'refine' && victim.taskId && victim.jobProgress > 0) {
    const project = projects.find((p) => p.id === projectId)
    const isRequirement = project?.requirements.some((r) => r.id === victim.taskId)
    if (isRequirement) {
      nextProjects = updateRequirement(nextProjects, victim.taskId, (r) => ({
        ...r,
        refineJobProgress: victim.jobProgress,
        refineJobDuration: undefined,
      }))
    } else {
      nextProjects = updateTask(nextProjects, victim.taskId, (t) => ({
        ...t,
        refineJobProgress: victim.jobProgress,
        refineJobDuration: undefined,
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
  return nextProjects
}

function projectSlotIndex(projects: Project[], projectId: string | null | undefined): number {
  if (!projectId) return -1
  return projects.find((p) => p.id === projectId)?.slotIndex ?? -1
}

function activeProjectsBySlot(projects: Project[]): Project[] {
  return projects
    .filter((p) => p.status === 'active' && !p.isLocked)
    .sort((a, b) => a.slotIndex - b.slotIndex || a.id.localeCompare(b.id))
}

type StaffAgentOptions = {
  stealFromOtherProjects?: boolean
  stealOnlyFromLowerSlots?: boolean
  targetSlotIndex?: number
  allowSpawn?: boolean
}

function hasConductorStaffingSource(
  state: GameState,
  agents: Agent[],
  options?: { spawnWhenNoWorkers?: boolean; rosterOnly?: boolean },
): boolean {
  if (agents.some((a) => a.job === null && !a.isAutomation)) return true
  if (agents.some((a) => !a.isAutomation && isAgentStaffable(a))) return true
  if (options?.rosterOnly) return false
  if (options?.spawnWhenNoWorkers && canSpawnAgent({ ...state, agents })) return true
  const rosterAgents = agents.filter((a) => !a.isAutomation)
  if (rosterAgents.length === 0 && canSpawnAgent({ ...state, agents })) return true
  if (canSpawnAgent({ ...state, agents })) return true
  return false
}

function releaseProjectWorkersForConductor(
  agents: Agent[],
  projectId: string,
  projects: Project[],
): { agents: Agent[]; projects: Project[] } {
  let nextAgents = agents
  let nextProjects = projects
  for (const role of ['refine', 'code', 'review', 'test'] as const) {
    while (projectAgents(projectId, role, nextAgents).length > 0) {
      const result = unassignAgentFromRole(nextAgents, projectId, role, nextProjects, { force: true })
      if (!result) break
      nextAgents = result.agents
      nextProjects = result.projects
    }
  }
  return { agents: nextAgents, projects: nextProjects }
}

function reconcileAllProjectStaffingInSlotOrder(
  ctx: SimCtx,
  state: GameState,
  agents: Agent[],
  projects: Project[],
  options?: { spawnWhenNoWorkers?: boolean },
): { agents: Agent[]; projects: Project[]; conductorStaffQueueCursor: number } {
  let nextAgents = agents
  let nextProjects = projects
  for (const project of activeProjectsBySlot(nextProjects)) {
    const reconciled = reconcileProjectStaffing(ctx, state, project, nextAgents, nextProjects, options)
    nextAgents = reconciled.agents
    nextProjects = reconciled.projects
  }
  const queued = runConductorStaffQueue(
    ctx,
    state,
    nextAgents,
    nextProjects,
    state.conductorStaffQueueCursor ?? 0,
    options,
  )
  return {
    agents: queued.agents,
    projects: queued.projects,
    conductorStaffQueueCursor: queued.cursor,
  }
}

type ConductorStaffCandidate = {
  project: Project
  role: AgentJob
  /** 0 = project needs a conductor, 1 = fills unallocated work, 2 = other staffing */
  priorityTier: 0 | 1 | 2
}

function nextConductorStaffCandidate(
  project: Project,
  agents: Agent[],
  projects: Project[],
  state: GameState,
  options?: { spawnWhenNoWorkers?: boolean },
): ConductorStaffCandidate | null {
  const synced = projects.find((p) => p.id === project.id) ?? project
  if (!projectUsesConductorAutomation(state.vibingCourses, state.meta, state.agents, synced)) return null

  const conductorStaffOptions = {
    spawnWhenNoWorkers: options?.spawnWhenNoWorkers,
    rosterOnly: !options?.spawnWhenNoWorkers,
  }

  const hasConductor = projectAgents(project.id, 'conductor', agents).length > 0
  const desiredConductor = synced.useConductor ? 1 : synced.roleCounts.conductor > 0 ? 1 : 0
  const virtualConductor = projectUsesVirtualConductor(state.meta, state.agents, synced)

  if (
    desiredConductor > 0 &&
    !hasConductor &&
    !virtualConductor &&
    projectHasConductorPipelineWork(synced)
  ) {
    if (!canStaffConductorOnProject({ ...state, agents }, agents, project.id, conductorStaffOptions)) return null
    return {
      project: synced,
      role: 'conductor',
      priorityTier: 0,
    }
  }

  if (!conductorCanAutoStaff(agents, project.id, state, synced)) return null

  const maxPerTask = (role: StaffJob) =>
    agentsPerTaskForProject(synced, role, agents, state.vibingCourseTiers)
  const conductorState = { ...state, agents }

  for (const role of conductorRolePriority(synced)) {
    if (
      projectRoleHasWork(synced, role, 'conductor', agents, maxPerTask(role)) &&
      canConductorAddWorker(agents, project.id, role, conductorState)
    ) {
      return {
        project: synced,
        role,
        priorityTier: roleHasUnallocatedWork(synced, role, agents) ? 1 : 2,
      }
    }
  }

  return null
}

function pickConductorStaffCandidate(
  candidates: ConductorStaffCandidate[],
  cursor: number,
): { candidate: ConductorStaffCandidate; nextCursor: number } | null {
  if (candidates.length === 0) return null

  const minTier = Math.min(...candidates.map((c) => c.priorityTier))
  const pool = candidates.filter((c) => c.priorityTier === minTier)
  const sorted = [...pool].sort(
    (a, b) => a.project.slotIndex - b.project.slotIndex || a.project.id.localeCompare(b.project.id),
  )
  const idx = cursor % sorted.length
  const candidate = sorted[idx]!
  return { candidate, nextCursor: (idx + 1) % sorted.length }
}

function executeConductorStaffCandidate(
  ctx: SimCtx,
  state: GameState,
  candidate: ConductorStaffCandidate,
  agents: Agent[],
  projects: Project[],
  options?: { spawnWhenNoWorkers?: boolean },
): { agents: Agent[]; projects: Project[] } | null {
  const { project, role } = candidate
  let nextAgents = agents
  let nextProjects = projects

  if (role === 'conductor') {
    const released = releaseProjectWorkersForConductor(nextAgents, project.id, nextProjects)
    nextAgents = released.agents
    nextProjects = released.projects
    const staffed = staffAgentForRole(
      ctx,
      { ...state, agents: nextAgents },
      nextAgents,
      project.id,
      'conductor',
      nextProjects,
      {
        stealFromOtherProjects: true,
        allowSpawn: options?.spawnWhenNoWorkers ?? false,
      },
    )
    if (!staffed) return null
    return {
      agents: staffed.agents,
      projects: staffed.projects,
    }
  }

  const synced = () => nextProjects.find((p) => p.id === project.id) ?? project
  const maxPerTask = agentsPerTaskForProject(synced(), role as StaffJob, nextAgents, state.vibingCourseTiers)
  const staffed = staffAgentForRole(
    ctx,
    { ...state, agents: nextAgents },
    nextAgents,
    project.id,
    role,
    nextProjects,
  )
  if (!staffed) return null

  nextAgents = staffed.agents.map((a) =>
    a.id === staffed.agentId
      ? {
          ...a,
          status: projectRoleHasWork(synced(), role as StaffJob, a.id, staffed.agents, maxPerTask)
            ? jobStatusFor(role)
            : 'idle',
        }
      : a,
  )
  nextProjects = staffed.projects

  return {
    agents: nextAgents,
    projects: nextProjects,
  }
}

function runConductorStaffQueue(
  ctx: SimCtx,
  state: GameState,
  agents: Agent[],
  projects: Project[],
  cursor: number,
  options?: { spawnWhenNoWorkers?: boolean },
): { agents: Agent[]; projects: Project[]; cursor: number } {
  let nextAgents = agents
  let nextProjects = projects
  let nextCursor = cursor
  const workersBeforeByProject = new Map(
    activeProjectsBySlot(projects).map((project) => [project.id, workerAssignmentKey(agents, project.id)]),
  )

  while (true) {
    const candidates = activeProjectsBySlot(nextProjects)
      .map((project) => nextConductorStaffCandidate(project, nextAgents, nextProjects, state, options))
      .filter((candidate): candidate is ConductorStaffCandidate => candidate !== null)

    const picked = pickConductorStaffCandidate(candidates, nextCursor)
    if (!picked) break

    const result = executeConductorStaffCandidate(
      ctx,
      state,
      picked.candidate,
      nextAgents,
      nextProjects,
      options,
    )
    if (!result) break

    nextAgents = result.agents
    nextProjects = result.projects
    nextCursor = picked.nextCursor
  }

  for (const project of activeProjectsBySlot(nextProjects)) {
    const before = workersBeforeByProject.get(project.id)
    if (before !== undefined && workerAssignmentKey(nextAgents, project.id) !== before) {
      nextAgents = queueConductorMoveCost(nextAgents, project.id)
    }
  }

  return { agents: nextAgents, projects: nextProjects, cursor: nextCursor }
}

function canDonateAgentForStaffing(
  agent: Agent,
  projectId: string,
  projects: Project[],
  options?: StaffAgentOptions,
): boolean {
  if (agent.projectId === projectId) return true
  if (!options?.stealFromOtherProjects) return false
  if (!options.stealOnlyFromLowerSlots) return true
  const donorSlot = projectSlotIndex(projects, agent.projectId)
  return donorSlot >= 0 && donorSlot < (options.targetSlotIndex ?? projectSlotIndex(projects, projectId))
}

function staffAgentForRole(
  ctx: SimCtx,
  state: GameState,
  agents: Agent[],
  projectId: string,
  job: AgentJob,
  projects: Project[],
  options?: StaffAgentOptions,
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
        canDonateAgentForStaffing(a, projectId, projects, {
          stealFromOtherProjects,
          stealOnlyFromLowerSlots: options?.stealOnlyFromLowerSlots,
          targetSlotIndex: options?.targetSlotIndex,
        }),
    )
  if (idleCandidates.length > 0) {
    idleCandidates.sort((x, y) => {
      const xSame = x.a.projectId === projectId ? 0 : 1
      const ySame = y.a.projectId === projectId ? 0 : 1
      if (xSame !== ySame) return xSame - ySame
      const xSlot = projectSlotIndex(projects, x.a.projectId)
      const ySlot = projectSlotIndex(projects, y.a.projectId)
      if (xSlot !== ySlot) return xSlot - ySlot
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

  if (options?.allowSpawn === false) return null
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

  const resolvedCount = reviewed ? effectiveReviewCommentResolutions(found.project, found.task) : 0
  const base =
    reviewed && (found.task.prQualityBase ?? found.task.prQualityStaging) > 0
      ? (found.task.prQualityBase ?? found.task.prQualityStaging)
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
  tokensPerSec: number,
  deltaSec: number,
  stackMultiplier: number,
  promptEngineering = false,
  role: 'code' | 'review' | 'refine' | 'test' = 'code',
): { projects: Project[]; becameDone: boolean; becamePrReady: boolean; outputTokens: number } {
  let becameDone = false
  let becamePrReady = false
  let outputTokens = 0
  const next = updateTask(projects, taskId, (t) => {
    if (t.status === 'merged' || t.status === 'pr_ready') return t
    if (t.isReviewComment && t.status === 'done') return t
    if (!t.isReviewComment && taskNeedsRefinement(t)) return t
    const required = taskTokensRequired(t.storyPointsRequired, role)
    const earned = role === 'test' ? t.testStoryPointsEarned : t.storyPointsEarned
    const increment = tokenProgressIncrement(required, earned, tokensPerSec, deltaSec, stackMultiplier)
    outputTokens = increment
    const nextEarned = Math.min(required, earned + increment)
    const complete = nextEarned >= required
    const status: TaskStatus = complete
      ? t.isReviewComment
        ? 'done'
        : 'pr_ready'
      : 'in_progress'
    if (complete) {
      if (t.isReviewComment) becameDone = true
      else becamePrReady = true
    }
    const baseQuality =
      complete && !t.isReviewComment
        ? computePrBaseQuality(authorParams, t.storyPointsRequired, promptEngineering)
        : null
    const prQualityStaging = baseQuality ?? t.prQualityStaging
    const prQualityBase = baseQuality ?? t.prQualityBase
    if (role === 'test') {
      return {
        ...t,
        testStoryPointsEarned: nextEarned,
        status: t.status,
        prQualityStaging,
        prQualityBase,
        completedByAgentId: complete ? completedByAgentId : t.completedByAgentId,
      }
    }
    return {
      ...t,
      storyPointsEarned: nextEarned,
      status,
      prQualityStaging,
      prQualityBase,
      completedByAgentId: complete ? completedByAgentId : t.completedByAgentId,
    }
  })
  return { projects: next, becameDone, becamePrReady, outputTokens }
}

function canStaffConductorOnProject(
  state: GameState,
  agents: Agent[],
  projectId: string,
  options?: { spawnWhenNoWorkers?: boolean; rosterOnly?: boolean },
): boolean {
  if (!hasConductorStaffingSource(state, agents, options)) return false

  const hasProjectWorker = agents.some(
    (a) =>
      a.projectId === projectId &&
      a.job !== null &&
      a.job !== 'conductor' &&
      !a.isAutomation,
  )
  if (!hasProjectWorker) return true

  if (options?.spawnWhenNoWorkers) return true

  if (agents.some(
    (a) =>
      a.projectId === projectId &&
      a.job !== null &&
      a.job !== 'conductor' &&
      !a.isAutomation &&
      !isAgentBusy(a),
  )) {
    return true
  }

  return agents.some((a) => !a.isAutomation && isAgentStaffable(a) && a.projectId !== projectId)
}

function workerAssignmentKey(agents: Agent[], projectId: string): string {
  return agents
    .filter((a) => a.projectId === projectId && a.job && a.job !== 'conductor')
    .map((a) => `${a.id}:${a.job}`)
    .sort()
    .join('|')
}

function canConductorAddWorker(
  agents: Agent[],
  projectId: string,
  role: StaffJob,
  state: GameState,
): boolean {
  if (canSpawnAgent({ ...state, agents })) {
    return true
  }
  return agents.some((a) => {
    if (a.isAutomation) return false
    if (!isAgentStaffable(a)) return false
    if (a.job === null) return true
    if (a.projectId !== projectId && a.job !== 'conductor' && isProjectRole(a.job)) return true
    if (
      a.projectId === projectId &&
      a.job &&
      a.job !== role &&
      a.job !== 'conductor' &&
      isProjectRole(a.job)
    ) {
      return true
    }
    return false
  })
}

function reconcileProjectStaffing(
  ctx: SimCtx,
  state: GameState,
  project: Project,
  agents: Agent[],
  projects: Project[],
  _options?: { spawnWhenNoWorkers?: boolean },
): { agents: Agent[]; projects: Project[] } {
  let nextAgents = [...agents]
  let nextProjects = projects

  const syncedProject = () => nextProjects.find((p) => p.id === project.id) ?? project
  const maxPerTask = (role: StaffJob) =>
    agentsPerTaskForProject(syncedProject(), role, nextAgents, state.vibingCourseTiers)

  if (project.useConductor && projectUsesConductorAutomation(state.vibingCourses, state.meta, state.agents, project)) {
    if (projectUsesVirtualConductor(state.meta, state.agents, project)) {
      return { agents: nextAgents, projects: nextProjects }
    }

    const conductors = projectAgents(project.id, 'conductor', nextAgents)
    const hasConductor = conductors.length > 0
    const desiredConductor = project.useConductor ? 1 : project.roleCounts.conductor > 0 ? 1 : 0

    if (conductorCanAutoStaff(nextAgents, project.id, state, syncedProject())) {
      const workers = nextAgents.filter(
        (a) => a.projectId === project.id && a.job && a.job !== 'conductor',
      )

      for (const w of workers) {
        if (
          w.job &&
          w.job !== 'conductor' &&
          isProjectRole(w.job) &&
          w.status === 'idle' &&
          !projectRoleHasWork(syncedProject(), w.job as StaffJob, w.id, nextAgents, maxPerTask(w.job as StaffJob))
        ) {
          const result = unassignAgentFromRole(nextAgents, project.id, w.job, nextProjects)
          if (result) {
            nextAgents = result.agents
            nextProjects = result.projects
          }
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
                : projectRoleHasWork(syncedProject(), role as StaffJob, staffed.agentId, nextAgents, maxPerTask(role as StaffJob))
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


function tryHotSwapCompactingAgent(
  _ctx: SimCtx,
  state: GameState,
  compacting: Agent,
  agents: Agent[],
  projects: Project[],
  vibingCourses: string[],
): void {
  if (!hasHotSwappingCourse(vibingCourses) || !compacting.projectId || !compacting.job) return
  const project = projects.find((p) => p.id === compacting.projectId)
  if (!project?.useConductor || !projectUsesConductorAutomation(vibingCourses, state.meta, state.agents, project)) return
  const role = compacting.job
  if (!isProjectRole(role)) return

  const benchCandidates = agents
    .filter((a) => !a.isAutomation && a.job === null && a.status !== 'compacting')
    .sort((a, b) => a.contextUsed - b.contextUsed)
  const bench = benchCandidates[0]
  if (!bench) return

  const roleToStaff = role
  bench.job = roleToStaff
  bench.projectId = compacting.projectId
  bench.status = jobStatusFor(roleToStaff)
  bench.taskId = null
  bench.jobProgress = 0
  bench.jobDuration = 0

  compacting.job = null
  compacting.projectId = null
  compacting.taskId = null
  compacting.status = 'compacting'
}

export function advanceTime(state: GameState, deltaSec: number, at: number): GameState {
  const ctx = ctxFrom(state)
  if (state.phase !== 'playing') return state

  const simSec = deltaSec * timeDistillationMultiplier(state.meta)
  const dayProgress = simSec / SECONDS_PER_GAME_DAY
  let {
    cash,
    reputation,
    gameDay,
    rentDueInDays,
    apartmentLeaseRemaining,
    apartment,
    agents,
    projects,
    leads,
    events,
    stats,
    selectedTaskId,
    vibingCourses,
    vibingCourseTiers,
    purchasedFineTunes,
    fineTuneTiers,
    mrr,
    agentSlotPurchases,
    gpuTickPurchases,
    meta,
  } = {
    ...state,
    vibingCourseTiers: { ...state.vibingCourseTiers },
    fineTuneTiers: { ...state.fineTuneTiers },
    purchasedFineTunes: [...state.purchasedFineTunes],
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

  const contextTokens = contextTokensForState({ meta })
  const compactDuration = compactionDurationSec(meta)
  const refineTier = refinementTier(state.vibingCourseTiers, vibingCourses)
  const tickStateBase = { meta, purchasedFineTunes, fineTuneTiers, gpuTickPurchases, agents: nextAgents, tutorialDone: state.tutorialDone }

  gameDay += dayProgress
  rentDueInDays -= dayProgress
  apartmentLeaseRemaining -= dayProgress
  cash += effectiveMrr(mrr, meta) * dayProgress

  if (rentDueInDays <= 0) {
    const affordableHousingLevel = getHallucinationLevel(meta, 'affordable_housing')
    const rent = effectiveHousingRent(state.apartment, affordableHousingLevel)
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
    while (true) {
      const budget = cash * PROCUREMENT_CASH_FRACTION
      const purchase = findCheapestProcurementPurchase(
        {
          apartment,
          agentSlotPurchases,
          gpuTickPurchases,
          vibingCourses,
          vibingCourseTiers,
          purchasedFineTunes,
          fineTuneTiers,
          meta,
        },
        budget,
        cash,
      )
      if (!purchase) break

      cash -= purchase.cost
      switch (purchase.kind) {
        case 'ram':
          agentSlotPurchases += 1
          break
        case 'gpu':
          gpuTickPurchases += 1
          break
        case 'housing':
          apartment = purchase.next
          apartmentLeaseRemaining = RENT_INTERVAL_DAYS
          rentDueInDays = RENT_INTERVAL_DAYS
          break
        case 'fine_tune':
          fineTuneTiers[purchase.id] = purchase.newTier
          if (purchase.newTier === 1) {
            purchasedFineTunes = [...purchasedFineTunes, purchase.id]
          }
          break
        case 'vibing_course':
          vibingCourseTiers[purchase.courseId] = purchase.newTier
          if (!vibingCourses.includes(purchase.courseId)) {
            vibingCourses = [...vibingCourses, purchase.courseId]
          }
          break
      }

      nextEvents = pushEvent(
        ctx,
        meta,
        nextEvents,
        'milestone',
        procurementEventMessage(purchase),
        at,
      )
    }
  }

  const pipelineTarget = clientLeadPipelineTarget(
    state,
    countAssignedPmAgents(state.agents),
    nextProjects,
  )
  let syntheticLeadCooldown = state.syntheticLeadCooldown
  const leadSpawnState = { meta, agents: nextAgents }
  if (state.tutorialDone) {
    const slotsNeeding = clientSlotsNeedingLeads(state, nextProjects, nextLeads)
    if (slotsNeeding.length > 0 && availableLeadCount(nextLeads) < pipelineTarget) {
      nextLeads = [spawnLeadForState(ctx, leadSpawnState, reputation, gameDay, slotsNeeding[0]!), ...nextLeads]
      nextEvents = pushEvent(ctx, meta, nextEvents, 'lead', 'New client lead appeared. They want it yesterday.', at)
    }

    if (canMarketingSpawnSyntheticLeads(meta, nextAgents)) {
      syntheticLeadCooldown -= dayProgress
      if (syntheticLeadCooldown <= 0) {
        const synthSlots = clientSlotsNeedingLeads(state, nextProjects, nextLeads)
        if (synthSlots.length > 0) {
          nextLeads = [
            spawnLeadForState(ctx, leadSpawnState, reputation, gameDay, synthSlots[0]!, 'synthetic'),
            ...nextLeads,
          ]
          nextEvents = pushEvent(
            ctx,
            meta,
            nextEvents,
            'lead',
            'Synthetic lead materialized from the funnel. Definitely real.',
            at,
          )
          syntheticLeadCooldown = syntheticLeadIntervalDays(meta)
        }
      }
    }
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

  let conductorStaffQueueCursor = state.conductorStaffQueueCursor ?? 0
  const staffingReconciled = reconcileAllProjectStaffingInSlotOrder(ctx, state, nextAgents, nextProjects)
  nextAgents = staffingReconciled.agents
  nextProjects = staffingReconciled.projects
  conductorStaffQueueCursor = staffingReconciled.conductorStaffQueueCursor

  const dispatchSlots = new Map<string, Map<string, number>>()
  const slotsFor = (project: Project, role: StaffJob): Map<string, number> => {
    const key = `${project.id}:${role}`
    let slots = dispatchSlots.get(key)
    if (!slots) {
      slots = new Map()
      dispatchSlots.set(key, slots)
    }
    return slots
  }

  const workState = { ...tickStateBase, agents: nextAgents }

  for (let agentIdx = 0; agentIdx < nextAgents.length; agentIdx++) {
    let agent = nextAgents[agentIdx]
    if (agent.status === 'compacting') {
      agent.compactingRemainingSec = Math.max(0, agent.compactingRemainingSec - simSec)
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
    if (agent.job === 'conductor' && (agent.conductorMoveRemaining ?? 0) > 0) {
      const tokensPerSec = agentOutputTokensPerSec(workState, agent, 'conductor', nextAgents)
      agent.conductorMoveRemaining = conductorMoveStep(agent, tokensPerSec, simSec, vibingCourses)
      if (agent.contextUsed >= contextTokens) {
        agent.contextUsed = contextTokens
        agent.status = 'compacting'
        agent.compactingRemainingSec = compactDuration
        agent.conductorMoveRemaining = 0
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
      nextAgents[agentIdx] = agent
    }
  }

  for (let agentIdx = 0; agentIdx < nextAgents.length; agentIdx++) {
    let agent = nextAgents[agentIdx]
    if (!agent.job || agent.job === 'conductor' || agent.isAutomation) continue
    if (agent.status === 'compacting' || agent.status === 'compacted' || agent.status === 'crashed') {
      continue
    }

    const tokensPerSec = agentOutputTokensPerSec(workState, agent, agent.job, nextAgents)
    if (tokensPerSec <= 0) continue

    agent.uptime += dayProgress
    const params = agentParamsFor(state, agent.job)

    const overflow = (produced = 0) => {
      if (produced > 0) applyOutputTokensToContext(agent, produced, vibingCourses)
      agent.taskId = null
      agent.jobProgress = 0
      agent.jobDuration = 0
      agent.status = 'compacting'
      agent.compactingRemainingSec = compactDuration
      if (agent.contextUsed < contextTokens) agent.contextUsed = contextTokens
      nextStats.compactionsSurvived += 1
      nextEvents = pushEvent(
        ctx,
        meta,
        nextEvents,
        'crash',
        `${agent.name} context full — rebooting (${compactDuration}s)...`,
        at,
      )
      tryHotSwapCompactingAgent(ctx, state, agent, nextAgents, nextProjects, vibingCourses)
    }

    if (agent.job === 'code' && agent.projectId) {
              const project = nextProjects.find((p) => p.id === agent.projectId)
              if (!project || project.status !== 'active' || project.isLocked) {
                Object.assign(agent, clearAgentJob(agent))
                continue
              }

              const perTask = agentsPerTaskForProject(project, 'code', nextAgents, vibingCourseTiers)
              const nextTask = dispatchCodingTask(
                project,
                agent.id,
                nextAgents,
                perTask,
                slotsFor(project, 'code'),
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
              const stackIdx = stackIndexOnTask(nextAgents, project.id, 'code', nextTask.id, agent.id)

              const result = tryProgressTask(
                nextProjects,
                nextTask.id,
                agent.id,
                params,
                tokensPerSec,
                simSec,
                bestOfNStackMultiplier(stackIdx),
                hasPromptEngineering(vibingCourses),
                'code',
              )
              applyOutputTokensToContext(agent, result.outputTokens, vibingCourses)
              if (agent.contextUsed >= contextTokens) {
                overflow()
                continue
              }
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
                    const staging = stagedPrQualityFromReviews(parent.project, parent.task)
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

              const perTask = agentsPerTaskForProject(project, 'review', nextAgents, vibingCourseTiers)
              const task = dispatchReviewTask(
                project,
                agent.id,
                nextAgents,
                perTask,
                slotsFor(project, 'review'),
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
              const required = taskTokensRequired(task.storyPointsRequired, 'review')
              let reviewProgress = task.reviewJobProgress ?? 0
              const stackIdx = stackIndexOnTask(nextAgents, project.id, 'review', task.id, agent.id)
              const increment = tokenProgressIncrement(
                required,
                reviewProgress,
                tokensPerSec,
                simSec,
                bestOfNStackMultiplier(stackIdx),
              )
              applyOutputTokensToContext(agent, increment, vibingCourses)
              if (agent.contextUsed >= contextTokens) {
                nextProjects = updateTask(nextProjects, task.id, (t) => ({
                  ...t,
                  reviewJobProgress: reviewProgress,
                }))
                overflow()
                continue
              }

              reviewProgress = Math.min(required, reviewProgress + increment)
              nextProjects = updateTask(nextProjects, task.id, (t) => ({
                ...t,
                reviewJobProgress: reviewProgress,
              }))
              agent.jobProgress = reviewProgress
              agent.jobDuration = required

              if (reviewProgress >= required) {
                const { comments, suppressed } = createReviewCommentTasks(
                  ctx,
                  task,
                  reviewHallucinationLevel(meta),
                )
                const reviewedStaging = prQualityAfterComments(
                  task.prQualityBase ?? task.prQualityStaging,
                  suppressed,
                )
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
                                  reviewCommentsSuppressed: suppressed,
                                  prQualityStaging: reviewedStaging,
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

              const perTask = agentsPerTaskForProject(project, 'refine', nextAgents, vibingCourseTiers)
              const target = dispatchRefineTarget(
                project,
                agent.id,
                nextAgents,
                perTask,
                slotsFor(project, 'refine'),
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
                  ? target.requirement.refineJobProgress ?? 0
                  : target.task.refineJobProgress ?? 0

              agent.status = 'refining'
              agent.taskId = targetId
              const refineRequired = taskTokensRequired(targetSp, 'refine')
              let refineProgress = savedProgress
              agent.jobProgress = refineProgress
              agent.jobDuration = refineRequired
              const stackIdx = stackIndexOnTask(nextAgents, project.id, 'refine', targetId, agent.id)
              const increment = tokenProgressIncrement(
                refineRequired,
                refineProgress,
                tokensPerSec,
                simSec,
                bestOfNStackMultiplier(stackIdx),
              )
              applyOutputTokensToContext(agent, increment, vibingCourses)
              if (agent.contextUsed >= contextTokens) {
                if (target.kind === 'requirement') {
                  nextProjects = updateRequirement(nextProjects, targetId, (r) => ({
                    ...r,
                    refineJobProgress: refineProgress,
                  }))
                } else {
                  nextProjects = updateTask(nextProjects, targetId, (t) => ({
                    ...t,
                    refineJobProgress: refineProgress,
                  }))
                }
                overflow()
                continue
              }

              refineProgress = Math.min(refineRequired, refineProgress + increment)
              agent.jobProgress = refineProgress
              if (target.kind === 'requirement') {
                nextProjects = updateRequirement(nextProjects, targetId, (r) => ({
                  ...r,
                  refineJobProgress: refineProgress,
                }))
              } else {
                nextProjects = updateTask(nextProjects, targetId, (t) => ({
                  ...t,
                  refineJobProgress: refineProgress,
                }))
              }

              if (refineProgress >= refineRequired) {
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

              const perTask = agentsPerTaskForProject(project, 'test', nextAgents, vibingCourseTiers)
              const testTask = dispatchTestTask(
                project,
                agent.id,
                nextAgents,
                perTask,
                slotsFor(project, 'test'),
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
              const testRequired = taskTokensRequired(testTask.storyPointsRequired, 'test')
              let instantQa = false
              if (prevTestTaskId !== testTask.id) {
                const instantChance = instantTestHallucinationChance(meta)
                if (instantChance > 0 && ctx.rng.float() < instantChance) {
                  instantQa = true
                }
              }

              const stackIdx = stackIndexOnTask(nextAgents, project.id, 'test', testTask.id, agent.id)
              const testIncrement = instantQa
                ? testRequired - testTask.testStoryPointsEarned
                : tokenProgressIncrement(
                    testRequired,
                    testTask.testStoryPointsEarned,
                    tokensPerSec,
                    simSec,
                    bestOfNStackMultiplier(stackIdx),
                  )
              applyOutputTokensToContext(agent, testIncrement, vibingCourses)
              if (agent.contextUsed >= contextTokens) {
                overflow()
                continue
              }

              const testEarned = Math.min(testRequired, testTask.testStoryPointsEarned + testIncrement)
              const taskFullyTested = testEarned >= testRequired

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
    apartment,
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
    vibingCourses,
    vibingCourseTiers,
    purchasedFineTunes,
    fineTuneTiers,
    tutorialDone: state.tutorialDone || !nextProjects.some((p) => p.isTutorial),
    conductorStaffQueueCursor,
    syntheticLeadCooldown,
  }, ctx, at)

  if (isAutomationAgentUnlocked({ vibingCourses, meta: tickState.meta }, 'sales') && hasActiveAutomationAgent(tickState.agents, 'sales')) {
    tickState = runSalesAutomation(tickState, at)
  }

  if (hasProjectManagerActive(tickState.agents)) {
    tickState = runPmAutomation(tickState, at)
  }

  if (hasProductOwnerActive(tickState.agents)) {
    tickState = runPoAutomation(tickState, at)
  }

  return tickState
}

/** Run one simulation interval; returns stepped state (messages reserved for future extraction). */
export function advanceSimulationDelta(
  state: GameState,
  deltaSec: number,
  at: number,
): SimulationDeltaResult {
  return { state: advanceTime(state, deltaSec, at), messages: [] }
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
  if (!hasOpenClientProjectSlot(state, state.agents, state.projects)) return state
  if (isClientSlotOccupiedByProject(state.projects, lead.slotIndex)) return state

  const project = createProjectFromLead(
    ctx,
    lead,
    state.gameDay,
    state.reputation,
    refineHallucinationLevel(state.meta),
  )
  const autoConductor = shouldAutoConductorClientProject(state.vibingCourses, state.meta, state.agents)
  let projectWithConductor = autoConductor
    ? {
        ...project,
        useConductor: true,
        roleCounts: autoConductorRoleCounts(state, project),
      }
    : project
  const negotiateMult = customerNegotiateMultiplier(state.meta, state.agents)
  if (negotiateMult > 1) {
    projectWithConductor = {
      ...projectWithConductor,
      payment: Math.round(projectWithConductor.payment * negotiateMult),
    }
  }
  const daysWaited = Math.max(0, Math.floor(state.gameDay - (lead.spawnedGameDay ?? state.gameDay)))
  const waitNote =
    daysWaited > 0 ? ` (${daysWaited}d wait shaved ${daysWaited}d off deadline)` : ''
  const syntheticAccepted = lead.source === 'synthetic'
  const nextProjects = [...state.projects, projectWithConductor]
  const reconciled = reconcileAllProjectStaffingInSlotOrder(ctx, state, state.agents, nextProjects, {
    spawnWhenNoWorkers: autoConductor,
  })
  return withCtx({
    ...state,
    agents: reconciled.agents,
    projects: reconciled.projects,
    conductorStaffQueueCursor: reconciled.conductorStaffQueueCursor,
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
  let payment = project.payment
  if (project.kind === 'client') {
    payment = Math.round(payment * accountingPaymentMultiplier(state.meta, state.agents))
  }
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
  let productBacklog = state.productBacklog
  let stats = { ...state.stats, projectsCompleted: state.stats.projectsCompleted + 1 }

  if (project.kind === 'product') {
    const mrrGain = mrrOnShip(project.totalStoryPoints, productFeaturesShipped, state.apartment)
    mrr += mrrGain
    productFeaturesShipped += 1
    stats = { ...stats, productsShipped: stats.productsShipped + 1 }
    productBacklog = ensureProductBacklogQueued(
      ctx,
      state.productBacklog.map((item) =>
        item.status === 'active' ? { ...item, status: 'shipped' as const } : item,
      ),
      productFeaturesShipped,
      targetQueuedProductBacklogCount(state.meta, nextProjects),
    )
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
  const freedSlot = project.slotIndex
  if (tutorialJustCompleted) {
    nextLeads = [spawnLeadForState(ctx, state, reputation, state.gameDay, freedSlot)]
    nextEvents = pushEvent(
      ctx,
      state.meta,
      nextEvents,
      'lead',
      'New client lead appeared. They want it yesterday.',
      at,
    )
  } else if (tutorialDone && !availableLeadInSlot(nextLeads, freedSlot)) {
    nextLeads = [spawnLeadForState(ctx, state, reputation, state.gameDay, freedSlot), ...nextLeads]
    nextEvents = pushEvent(
      ctx,
      state.meta,
      nextEvents,
      'lead',
      'New client lead appeared. They want it yesterday.',
      at,
    )
  }

  return withCtx({
    ...state,
    cash,
    reputation,
    mrr,
    productFeaturesShipped,
    productBacklog,
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
  if (!hasOpenClientProjectSlot(state, state.agents, state.projects)) return null
  const sources = salesAutoAcceptSources(state.meta)
  const lead = state.leads
    .filter(
      (l) =>
        l.status === 'available' && sources.has(l.source) && state.reputation >= l.repRequired,
    )
    .sort((a, b) => a.slotIndex - b.slotIndex)[0]
  return lead?.id ?? null
}

/** Auto-accept eligible leads while Sales is on duty. */
function runSalesAutomation(state: GameState, at: number): GameState {
  let tickState = state
  for (;;) {
    const leadId = findAutoAcceptableLead(tickState)
    if (!leadId) break
    const projectsBefore = tickState.projects.length
    tickState = acceptLead(tickState, leadId, at)
    if (tickState.projects.length <= projectsBefore) break
  }
  return tickState
}

/** Auto-deliver completed client projects while PM is on duty. */
function runPmAutomation(state: GameState, at: number): GameState {
  let tickState = state
  for (;;) {
    const deliverable = tickState.projects.find(
      (p) => p.kind === 'client' && isReadyToDeliver(p),
    )
    if (!deliverable) break
    tickState = deliverProject(tickState, deliverable.id, at)
  }
  return tickState
}

/** Auto-start, conduct, and deliver in-house product work while PO is on duty. */
function runPoAutomation(state: GameState, at: number): GameState {
  let tickState = state
  const queued = tickState.productBacklog.find((item) => item.status === 'queued')
  if (
    queued &&
    countActiveProductProjects(tickState.projects) < maxProductProjectSlots(tickState.meta)
  ) {
    tickState = activateProductFeatureFromBacklog(tickState, queued.id, at)
  }

  for (;;) {
    const deliverable = tickState.projects.find(
      (p) => p.kind === 'product' && isReadyToDeliver(p),
    )
    if (!deliverable) break
    tickState = deliverProject(tickState, deliverable.id, at)
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
  const reconciled = reconcileProjectStaffing(
    ctx,
    repaired,
    updatedProject,
    repaired.agents,
    nextProjects,
  )
  const nextAgents = reconciled.agents
  const nextProjectsClamped = clampRoleCountsToStaffed(projectId, nextAgents, reconciled.projects)

  return withCtx({
    ...repaired,
    agents: nextAgents,
    projects: nextProjectsClamped,
    stats: {
      ...state.stats,
      agentsDeployed: Math.max(state.stats.agentsDeployed, nextAgents.length),
    },
    events: pushEvent(
      ctx,
      state.meta,
      state.events,
      'project',
      `Staffed +1 ${job} on ${project.clientName}.`,
      at,
    ),
  }, ctx, at)
}

export function toggleConductor(state: GameState, projectId: string, enabled: boolean, at: number): GameState {
  const project = state.projects.find((p) => p.id === projectId)
  if (!project || !canToggleConductorOnProject(state.vibingCourses, state.meta, state.agents, project)) {
    return state
  }
  const ctx = ctxFrom(state)
  const nextProjects = state.projects.map((p) =>
    p.id === projectId
      ? {
          ...p,
          useConductor: enabled,
          roleCounts: enabled
            ? autoConductorRoleCounts(state, p)
            : { ...p.roleCounts, conductor: 0 },
        }
      : p,
  )
  const updatedProject = nextProjects.find((p) => p.id === projectId)
  if (!updatedProject) return state
  const reconciled = reconcileAllProjectStaffingInSlotOrder(ctx, state, state.agents, nextProjects, {
    spawnWhenNoWorkers: enabled,
  })
  let nextProjectsClamped = reconciled.projects
  for (const project of activeProjectsBySlot(reconciled.projects)) {
    nextProjectsClamped = clampRoleCountsToStaffed(project.id, reconciled.agents, nextProjectsClamped)
  }
  return withCtx(
    {
      ...state,
      agents: reconciled.agents,
      projects: nextProjectsClamped,
      conductorStaffQueueCursor: reconciled.conductorStaffQueueCursor,
    },
    ctx,
    at,
  )
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
          `Bought +10 GB RAM for ${formatCash(cost)}. HR pretends this is normal.`,
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
  if (!course || !isVibingCourseVisible(courseId, state.meta)) return state
  if (courseId === PRODUCT_OWNER_COURSE_ID && !canAccessProduct(state.meta)) return state

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
  const affordableHousingLevel = getHallucinationLevel(state.meta, 'affordable_housing')
  const cost = effectiveHousingUpgradeCost(next, affordableHousingLevel)
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
  if (state.phase !== 'playing' || !canRetire(state.cash, state.meta.highestRungEver)) return state

  const points = hallucinationPointsFromRetirement(state.cash, state.meta.highestRungEver)
  const newMeta: MetaProgress = {
    ...state.meta,
    hallucinationPoints: state.meta.hallucinationPoints + points,
    totalHallucinationsEarned: state.meta.totalHallucinationsEarned + points,
    highestRungEver: nextHighestRung(state.cash, state.meta.highestRungEver),
    retirementCount: state.meta.retirementCount + 1,
  }

  const next = createInitialState(at, state.rng, newMeta, { includeTutorial: false })
  return {
    ...next,
    seenStoryIntro: state.seenStoryIntro,
    acknowledgedTutorialStep: state.acknowledgedTutorialStep,
    seenTabIntros: state.seenTabIntros,
    seenCompactionIntro: state.seenCompactionIntro,
  }
}

const SPECIALIST_HALLUCINATION_TRACKS = [
  'procurement',
  'sales',
  'marketing',
  'customer',
  'accounting',
  'project_manager',
] as const satisfies readonly HallucinationTrack[]

type SpecialistHallucinationTrack = (typeof SPECIALIST_HALLUCINATION_TRACKS)[number]

function isSpecialistHallucinationTrack(track: HallucinationTrack): track is SpecialistHallucinationTrack {
  return (SPECIALIST_HALLUCINATION_TRACKS as readonly string[]).includes(track)
}

function enrollVibingCourseFromHallucination(
  state: GameState,
  courseId: string,
  ctx: SimCtx,
  at: number,
): GameState {
  if (state.vibingCourses.includes(courseId)) return state
  const course = VIBING_COURSES.find((c) => c.id === courseId)
  if (!course) return state

  return {
    ...state,
    vibingCourses: [...state.vibingCourses, courseId],
    vibingCourseTiers: { ...state.vibingCourseTiers, [courseId]: 1 },
    events: pushEvent(
      ctx,
      state.meta,
      state.events,
      'hallucination',
      `Hallucination enrolled in ${course.label}: "${course.tagline}"`,
      at,
    ),
  }
}

export function prestigeHallucinationBuy(
  state: GameState,
  track: HallucinationTrack,
  at: number,
): GameState {
  const ctx = ctxFrom(state)
  const previousLevel = getHallucinationLevel(state.meta, track)
  const newMeta = buyHallucinationUpgrade(state.meta, track)
  if (!newMeta) return state
  const level = getHallucinationLevel(newMeta, track)
  let next: GameState = {
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
  }

  const firstSpecialistUnlock =
    previousLevel === 0 &&
    level >= 1 &&
    isSpecialistHallucinationTrack(track) &&
    !state.vibingCourses.includes(track)

  if (firstSpecialistUnlock) {
    next = enrollVibingCourseFromHallucination(next, track, ctx, at)
  }

  next = syncAutomationAgents(next, ctx)

  if (firstSpecialistUnlock) {
    next = toggleSpecialistRole(next, track, true, at)
  }
  if (track === 'in_house') {
    next = syncProductBacklog(next, ctx)
  }
  if (track === 'starting_capital') {
    next = {
      ...next,
      cash: next.cash + STARTING_CAPITAL_BONUS_PER_LEVEL,
      events: pushEvent(
        ctx,
        state.meta,
        next.events,
        'hallucination',
        `Starting capital: +${formatCash(STARTING_CAPITAL_BONUS_PER_LEVEL)}.`,
        at,
      ),
    }
  }
  if (track === 'starting_ram') {
    next = {
      ...next,
      events: pushEvent(
        ctx,
        state.meta,
        next.events,
        'hallucination',
        'Starting RAM: +10 GB roster capacity.',
        at,
      ),
    }
  }
  if (track === 'starting_gpu') {
    next = {
      ...next,
      events: pushEvent(
        ctx,
        state.meta,
        next.events,
        'hallucination',
        'Starting GPU: +1 GPU tick.',
        at,
      ),
    }
  }
  return withCtx(next, ctx, at)
}

export function acceptSingularity(state: GameState, at: number): GameState {
  const customerLevel = getHallucinationLevel(state.meta, 'customer')
  if (!isSingularityEligible(state.apartment, customerLevel)) return state

  const newMeta = createDefaultMeta()
  newMeta.singularityCount = state.meta.singularityCount + 1
  newMeta.totalHallucinationsEarned = state.meta.totalHallucinationsEarned

  return createInitialState(at, state.rng, newMeta, { includeTutorial: true })
}

export function syncProductBacklog(state: GameState, ctx: SimCtx): GameState {
  if (!canAccessProduct(state.meta)) return state
  const minQueued = targetQueuedProductBacklogCount(state.meta, state.projects)
  const backlog = ensureProductBacklogQueued(
    ctx,
    state.productBacklog,
    state.productFeaturesShipped,
    minQueued,
  )
  if (backlog === state.productBacklog) return state
  return { ...state, productBacklog: backlog }
}

export function activateProductFeatureFromBacklog(
  state: GameState,
  itemId: string,
  at: number,
): GameState {
  if (!canAccessProduct(state.meta)) return state
  const item = state.productBacklog.find((i) => i.id === itemId && i.status === 'queued')
  if (!item) return state
  if (countActiveProductProjects(state.projects) >= maxProductProjectSlots(state.meta)) return state

  const ctx = ctxFrom(state)
  const autoConductor =
    hasProductOwnerActive(state.agents) && hasConductorCourse(state.vibingCourses)
  let project = activateProductFeature(ctx, item)
  if (autoConductor) {
    project = {
      ...project,
      useConductor: true,
      roleCounts: { ...project.roleCounts, conductor: 1, refine: 0, code: 0, review: 0, test: 0 },
    }
  }
  const nextProjects = [...state.projects, project]
  const reconciled = reconcileAllProjectStaffingInSlotOrder(ctx, state, state.agents, nextProjects, {
    spawnWhenNoWorkers: autoConductor,
  })
  const nextBacklog = ensureProductBacklogQueued(
    ctx,
    state.productBacklog.map((i) =>
      i.id === itemId ? { ...i, status: 'active' as const } : i,
    ),
    state.productFeaturesShipped,
    targetQueuedProductBacklogCount(state.meta, reconciled.projects),
  )

  return withCtx(
    {
      ...state,
      agents: reconciled.agents,
      projects: reconciled.projects,
      conductorStaffQueueCursor: reconciled.conductorStaffQueueCursor,
      productBacklog: nextBacklog,
      events: pushEvent(
        ctx,
        state.meta,
        state.events,
        'product',
        `Started in-house feature: ${item.title}.`,
        at,
      ),
    },
    ctx,
    at,
  )
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

export function setMaxClientProjects(state: GameState, slots: number, at: number): GameState {
  const tier = parallelVibesTier(state.vibingCourseTiers)
  if (tier <= 0) return state

  const ctx = ctxFrom(state)
  const base = baseClientProjectSlots(state.meta)
  const cap = maxClientProjectSlotsCap(state.meta, state.vibingCourseTiers)
  const clamped = Math.min(Math.max(Math.floor(slots), base), cap)
  const current = maxClientProjectSlots(state.meta, state.vibingCourseTiers, state.maxClientProjects)
  if (clamped === current) return state

  let nextState: GameState = {
    ...state,
    maxClientProjects: clamped,
    projects: state.projects.map((p) => (p.isLocked ? { ...p, isLocked: false } : p)),
    events: pushEvent(
      ctx,
      state.meta,
      state.events,
      'system',
      `Concurrent client gigs set to ${clamped} (max ${cap} at Parallel Vibes T${tier}).`,
      at,
    ),
  }
  return withCtx(nextState, ctx, at)
}

export function getNetWorth(state: Pick<GameState, 'cash' | 'mrr' | 'meta'>): number {
  return state.cash + effectiveMrr(state.mrr, state.meta) * 30
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
  return agentTokensPerSec(params, 0, 1)
}

export function canStaffAdditionalAgent(state: GameState): boolean {
  return hasStaffableAgent(state.agents) || canSpawnAgent(state)
}

export function agentCapacity(state: GameState): {
  used: number
  max: number
  agentSlots: number
  gpuTicks: number
  usedRamGb: number
} {
  const params = (agent: Agent) => rosterRamParams(state, agent)
  const usedRam = rosterAgentRamGb(state.agents, params)
  const totalRam = totalRamGb(state)
  return {
    used: state.agents.length,
    max: maxAgents(state),
    agentSlots: totalRam,
    gpuTicks: effectiveGpuTicks(state),
    usedRamGb: usedRam,
  }
}

export { fineTuneId, getModelTier, MODEL_TIERS }
