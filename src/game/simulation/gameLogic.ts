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
import { contextSizeForLevel, fineTuneId, getModelTier, MODEL_TIERS } from '../models'
import {
  allReviewCommentsAddressed,
  CONDUCTOR_ROLE_PRIORITY,
  createBugFixTask,
  createProjectFromLead,
  createReviewCommentTasks,
  createTutorialProject,
  generateLead,
  pickCodingTask,
  pickRefineTarget,
  pickReviewTask,
  pickTestTask,
  projectHasRefineWork,
  projectHasTestWork,
  projectRoleHasWork,
  refineRequirementToTasks,
  repairStaleCodingAssignments,
  resolvedReviewComments,
  syncTestScope,
  taskIsTested,
  taskNeedsTesting,
} from '../projects'
import { generateAgentName, generatePersonality } from '../personalities'
import {
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
  TICK_INTERVAL_MS,
} from '../constants'
import {
  agentTickSpeed,
  clientLeadPipelineTarget,
  computePrBaseQuality,
  contextFillMultiplier,
  fillAgentContext,
  formatStoryPoints,
  getAgentParameters,
  gpuTickCost,
  hasConductorCourse,
  hasPromptEngineering,
  jobStatusFor,
  maxAgentSlotPurchases,
  maxAgents,
  maxGpuTickPurchases,
  prQualityAfterComments,
  ramSlotCost,
  refineJobDurationDays,
  reviewJobDurationDays,
  rollBugAtQa,
  storyPointIncrement,
  storyPointProgressPerTick,
  testStoryPointIncrement,
  totalAgentSlots,
  totalGpuTicks,
} from '../mechanics'
import { HOUSING_CONFIG, isSingularityEligible, nextHousingTier } from '../housing'
import {
  buyHallucinationUpgrade,
  canRetire,
  compactionDurationSec,
  getHallucinationLevel,
  hallucinationPointsFromRetirement,
  maxClientProjectSlots,
  nextHighestRung,
  startingCapitalBonus,
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
    agentSlotPurchases: 0,
    gpuTickPurchases: 0,
    mrr: 0,
    productFeaturesShipped: 0,
    purchasedFineTunes: [],
    vibingCourses: [],
    vibingCourseTiers: {},
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
    const task = project.tasks.find((t) => t.id === taskId)
    if (task) return { project, task }
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
  state: Pick<GameState, 'meta' | 'purchasedFineTunes'>,
  job: AgentJob | null,
): number {
  const modelTierIndex = getHallucinationLevel(state.meta, 'model')
  return getAgentParameters(state.meta, state.purchasedFineTunes, job, modelTierIndex)
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

const ONE_TICK_SEC = TICK_INTERVAL_MS / 1000

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
  fillAgentContext(agent, tick.contextSize, tick.baseSpeed, ONE_TICK_SEC, tick.ctxMult)
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
  if (job === 'code' && victim.taskId) {
    nextProjects = updateTask(nextProjects, victim.taskId, (t) => ({
      ...t,
      assignedAgentId: null,
    }))
  }
  if (job === 'refine' && victim.taskId && victim.jobDuration > 0) {
    nextProjects = updateRequirement(nextProjects, victim.taskId, (r) => ({
      ...r,
      refineJobProgress: victim.jobProgress,
      refineJobDuration: victim.jobDuration,
    }))
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
): { agents: Agent[]; agentId: string; projects: Project[] } | null {
  const unassignedIdx = agents.findIndex((a) => a.job === null)
  if (unassignedIdx >= 0) {
    const next = [...agents]
    const assigned = assignAgentToRole(next[unassignedIdx], projectId, job)
    next[unassignedIdx] = assigned
    return { agents: next, agentId: assigned.id, projects }
  }

  const idleIdx = agents.findIndex(
    (a) => a.job !== null && a.job !== job && a.job !== 'conductor' && !isAgentBusy(a),
  )
  if (idleIdx >= 0) {
    const next = [...agents]
    const donor = next[idleIdx]!
    const oldJob = donor.job!
    const oldProjectId = donor.projectId!
    let nextProjects =
      oldJob === 'code' && donor.taskId
        ? updateTask(projects, donor.taskId, (t) => ({
            ...t,
            assignedAgentId: null,
          }))
        : projects
    const assigned = assignAgentToRole(donor, projectId, job)
    next[idleIdx] = assigned
    nextProjects = nextProjects.map((p) =>
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
  state: Pick<GameState, 'meta' | 'purchasedFineTunes' | 'vibingCourses'>,
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
        t.id === taskId
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
  state: Pick<GameState, 'meta' | 'purchasedFineTunes' | 'vibingCourses'>,
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

function tryProgressTask(
  projects: Project[],
  taskId: string,
  completedByAgentId: string | null,
  authorParams: number,
  gameDay: number,
  promptEngineering = false,
  progressScale = 1,
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
      assignedAgentId: complete ? null : t.assignedAgentId,
    }
  })
  return { projects: next, becameDone, becamePrReady }
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

  const syncedProject = () => nextProjects.find((p) => p.id === project.id) ?? project
  const noteWorkerReassignment = () => {
    if (conductorTick) {
      nextAgents = gainConductorContextOnReassignment(nextAgents, project.id, conductorTick)
    }
  }

  if (project.useConductor && hasConductorCourse(state.vibingCourses)) {
    const conductors = projectAgents(project.id, 'conductor', nextAgents)
    const hasConductor = conductors.length > 0
    const desiredConductor = project.roleCounts.conductor > 0 ? 1 : 0

    if (desiredConductor > 0 && !hasConductor) {
      const staffed = staffAgentForRole(
        ctx,
        { ...state, agents: nextAgents },
        nextAgents,
        project.id,
        'conductor',
        nextProjects,
      )
      if (staffed) {
        nextAgents = staffed.agents
        nextProjects = staffed.projects
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
      const workerCap = Math.max(0, project.crewCap - projectAgents(project.id, 'conductor', nextAgents).length)
      const workers = nextAgents.filter(
        (a) => a.projectId === project.id && a.job && a.job !== 'conductor',
      )

      for (const w of workers) {
        if (
          w.job &&
          w.job !== 'conductor' &&
          isProjectRole(w.job) &&
          w.status === 'idle' &&
          !projectRoleHasWork(syncedProject(), w.job as StaffJob, w.id, nextAgents)
        ) {
          const result = unassignAgentFromRole(nextAgents, project.id, w.job, nextProjects)
          if (result) {
            nextAgents = result.agents
            nextProjects = result.projects
            noteWorkerReassignment()
          }
        }
      }

      const workersAfter = nextAgents.filter(
        (a) => a.projectId === project.id && a.job && a.job !== 'conductor',
      )
      if (workersAfter.length > workerCap) {
        const idle = workersAfter.filter((a) => !isAgentBusy(a))
        for (let i = 0; i < workersAfter.length - workerCap && idle.length > 0; i++) {
          const victim = idle.pop()!
          if (victim.job) {
            const result = unassignAgentFromRole(nextAgents, project.id, victim.job, nextProjects)
            if (result) {
              nextAgents = result.agents
              nextProjects = result.projects
              noteWorkerReassignment()
            }
          }
        }
      }

      for (const role of CONDUCTOR_ROLE_PRIORITY) {
        const current = projectAgents(project.id, role, nextAgents).length
        const workersNow = nextAgents.filter(
          (a) => a.projectId === project.id && a.job && a.job !== 'conductor',
        )
        if (
          workersNow.length < workerCap &&
          projectRoleHasWork(syncedProject(), role, 'conductor', nextAgents) &&
          (hasStaffableAgent(nextAgents) || canSpawnAgent({ ...state, agents: nextAgents }))
        ) {
          const staffed = staffAgentForRole(
            ctx,
            { ...state, agents: nextAgents },
            nextAgents,
            project.id,
            role,
            nextProjects,
          )
          if (staffed) {
            nextAgents = staffed.agents
            nextProjects = staffed.projects
            nextAgents = nextAgents.map((a) =>
              a.id === staffed.agentId
                ? {
                    ...a,
                    status: projectRoleHasWork(syncedProject(), role, a.id, nextAgents)
                      ? jobStatusFor(role)
                      : 'idle',
                  }
                : a,
            )
            noteWorkerReassignment()
          }
        }
        void current
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
                : projectRoleHasWork(syncedProject(), role as StaffJob, staffed.agentId, nextAgents)
          nextAgents = nextAgents.map((a) =>
            a.id === staffed.agentId ? { ...a, status: hasWork ? jobStatusFor(role) : 'idle' } : a,
          )
        }
        toAdd -= 1
      }
    }
  }

  return { agents: nextAgents, projects: nextProjects }
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

  if (vibingCourses.includes('procurement')) {
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
        `Procurement auto-bought +1 agent slot for ${formatCash(slotCost)}.`,
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
        `Procurement auto-bought +1 GPU tick for ${formatCash(tickCost)}.`,
        at,
      )
    }
  }

  const pipelineTarget = clientLeadPipelineTarget(
    meta,
    state.vibingCourseTiers.project_manager ?? 0,
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
    if (project.status !== 'active') continue
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

  for (const project of nextProjects.filter((p) => p.status === 'active')) {
    const reconciled = reconcileProjectStaffing(ctx, state, project, nextAgents, nextProjects, conductorTick)
    nextAgents = reconciled.agents
    nextProjects = reconciled.projects
  }
  nextEvents = conductorTick.events
  nextStats = conductorTick.stats

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
    if (!agent.job || agent.job === 'conductor') continue
    if (agent.status === 'compacting' || agent.status === 'compacted' || agent.status === 'crashed') {
      continue
    }

    const baseSpeed = baseSpeedGlobal
    if (baseSpeed <= 0) continue

    agent.uptime += dayProgress
    const params = agentParamsFor(state, agent.job)

    const overflow = () => {
      if (agent.job === 'code' && agent.taskId) {
        const taskId = agent.taskId
        nextProjects = updateTask(nextProjects, taskId, (t) => ({
          ...t,
          assignedAgentId: null,
          status: t.storyPointsEarned > 0 ? 'in_progress' : 'open',
        }))
        agent.taskId = null
      }
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
              if (!project || project.status !== 'active') {
                Object.assign(agent, clearAgentJob(agent))
                continue
              }

              let taskRef = agent.taskId ? findTask(nextProjects, agent.taskId) : null
              if (
                !taskRef ||
                taskRef.task.status === 'merged' ||
                taskRef.task.status === 'pr_ready' ||
                (taskRef.task.isReviewComment && taskRef.task.status === 'done')
              ) {
                const nextTask = pickCodingTask(project, agent.id, nextAgents)
                if (!nextTask) {
                  agent.status = 'idle'
                  nextAgents[agentIdx] = agent
                  continue
                }
                agent.status = 'working'
                agent.taskId = nextTask.id
                nextProjects = updateTask(nextProjects, nextTask.id, (t) => ({
                  ...t,
                  assignedAgentId: agent.id,
                  status: t.status === 'open' ? 'in_progress' : t.status,
                }))
                taskRef = { project, task: nextTask }
              }

              agent.status = 'working'
              fillAgentContext(agent, contextSize, baseSpeed, deltaSec, ctxMult)
              if (agent.contextUsed >= contextTokens) {
                overflow()
                continue
              }

              const result = tryProgressTask(
                nextProjects,
                agent.taskId!,
                agent.id,
                params,
                gameDay,
                hasPromptEngineering(vibingCourses),
                baseSpeed,
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
              if (!project || project.status !== 'active') {
                Object.assign(agent, clearAgentJob(agent))
                continue
              }

              if (!project.tasks.some((t) => t.status === 'pr_ready' && !t.reviewed)) {
                agent.status = 'idle'
                agent.taskId = null
                nextAgents[agentIdx] = agent
                continue
              }

              const task = pickReviewTask(project, agent.id, nextAgents)
              if (!task) {
                agent.status = 'idle'
                nextAgents[agentIdx] = agent
                continue
              }

              agent.status = 'reviewing'
              if (agent.taskId !== task.id) {
                agent.taskId = task.id
                agent.jobProgress = task.reviewJobProgress ?? 0
                agent.jobDuration =
                  task.reviewJobDuration ?? reviewJobDurationDays(task.storyPointsRequired, params)
                nextAgents[agentIdx] = agent
              }

              fillAgentContext(agent, contextSize, baseSpeed, deltaSec, ctxMult)
              if (agent.contextUsed >= contextTokens) {
                overflow()
                continue
              }

              agent.jobProgress += dayProgress * baseSpeed
              if (agent.jobProgress >= agent.jobDuration) {
                const comments = createReviewCommentTasks(ctx, task)
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
              if (!project || project.status !== 'active') {
                Object.assign(agent, clearAgentJob(agent))
                continue
              }

              const target = pickRefineTarget(project, nextAgents, agent.id)
              if (!target) {
                agent.status = 'idle'
                agent.taskId = null
                agent.jobProgress = 0
                nextAgents[agentIdx] = agent
                continue
              }

              agent.status = 'refining'

              if (agent.taskId !== target.id) {
                agent.taskId = target.id
                agent.jobProgress = target.refineJobProgress ?? 0
                agent.jobDuration =
                  target.refineJobDuration ?? refineJobDurationDays(target.storyPoints, params)
                nextAgents[agentIdx] = agent
              }

              fillAgentContext(agent, contextSize, baseSpeed, deltaSec, ctxMult)
              if (agent.contextUsed >= contextTokens) {
                overflow()
                continue
              }

              agent.jobProgress += dayProgress * baseSpeed
              if (agent.jobProgress >= agent.jobDuration) {
                const newTasks = refineRequirementToTasks(ctx, target)
                const refinedStatus = newTasks.length > 1 ? ('split' as const) : ('refined' as const)
                nextProjects = nextProjects.map((p) =>
                  p.id === project.id
                    ? {
                        ...p,
                        requirements: p.requirements.map((r) =>
                          r.id === target.id
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
                    : p,
                )
                if (!selectedTaskId) selectedTaskId = newTasks[0].id
                const taskSummary =
                  newTasks.length > 1
                    ? `split "${target.title}" into ${newTasks.length} tasks (${newTasks.map((t) => formatStoryPoints(t.storyPointsRequired)).join(' + ')} SP)`
                    : `refined "${target.title}" into "${newTasks[0].title}" (${formatStoryPoints(newTasks[0].storyPointsRequired)} SP)`
                nextEvents = pushEvent(ctx, meta, nextEvents, 'project', `${agent.name} ${taskSummary}.`, at)
                agent.jobProgress = 0
                agent.taskId = null
              }
            } else if (agent.job === 'test' && agent.projectId) {
              const project = nextProjects.find((p) => p.id === agent.projectId)
              if (!project || project.status !== 'active') {
                Object.assign(agent, clearAgentJob(agent))
                continue
              }

              if (!projectHasTestWork(project)) {
                agent.status = 'idle'
                agent.taskId = null
                nextAgents[agentIdx] = agent
                continue
              }

              let testTask = agent.taskId
                ? project.tasks.find((t) => t.id === agent.taskId && taskNeedsTesting(t)) ?? null
                : null
              if (!testTask) {
                testTask = pickTestTask(project, agent.id, nextAgents)
                if (!testTask) {
                  agent.status = 'idle'
                  agent.taskId = null
                  nextAgents[agentIdx] = agent
                  continue
                }
                agent.status = 'testing'
                agent.taskId = testTask.id
              }

              fillAgentContext(agent, contextSize, baseSpeed, deltaSec, ctxMult)
              if (agent.contextUsed >= contextTokens) {
                overflow()
                continue
              }

              const increment = testStoryPointIncrement(
                testTask.storyPointsRequired,
                testTask.testStoryPointsEarned,
                params * baseSpeed,
                gameDay,
              )
              const testEarned = Math.min(
                testTask.storyPointsRequired,
                testTask.testStoryPointsEarned + increment,
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

          return withCtx({
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
  const clientProjects = state.projects.filter((p) => p.kind === 'client' && p.status === 'active')
  const maxSlots = maxClientProjectSlots(state.meta, state.vibingCourseTiers.project_manager ?? 0)
  if (clientProjects.length >= maxSlots) return state

  const project = createProjectFromLead(ctx, lead, state.gameDay, state.reputation)
  const daysWaited = Math.max(0, Math.floor(state.gameDay - (lead.spawnedGameDay ?? state.gameDay)))
  const waitNote =
    daysWaited > 0 ? ` (${daysWaited}d wait shaved ${daysWaited}d off deadline)` : ''
  const syntheticAccepted = lead.source === 'synthetic'
  return withCtx({
    ...state,
    projects: [...state.projects, project],
    leads: state.leads.map((l) => (l.id === leadId ? { ...l, status: 'accepted' as const } : l)),
    stats: syntheticAccepted
      ? { ...state.stats, syntheticLeadsAccepted: state.stats.syntheticLeadsAccepted + 1 }
      : state.stats,
    events: pushEvent(
      ctx,
      state.meta,
      state.events,
      'lead',
      `Accepted ${lead.clientName}. ${project.durationDays}d to deliver.${waitNote}`,
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
  if (!project || project.status !== 'active') return state
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
      state.vibingCourseTiers.project_manager ?? 0,
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

export function adjustRoleCount(state: GameState, projectId: string, job: AgentJob, delta: number, at: number): GameState {
  if (!isProjectRole(job)) return state
  const ctx = ctxFrom(state)
  const repaired = {
    ...state,
    projects: repairStaleCodingAssignments(state.projects, state.agents),
  }
  const project = repaired.projects.find((p) => p.id === projectId)
  if (!project) return state

  if (delta > 0 && !hasStaffableAgent(repaired.agents) && !canSpawnAgent(repaired)) return state

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

  return withCtx({
    ...repaired,
    agents: nextAgents,
    projects: reconciled.projects,
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

export function adjustCrewCap(state: GameState, projectId: string, delta: number, at: number): GameState {
  return {
    ...state,
    projects: state.projects.map((p) =>
      p.id === projectId
        ? { ...p, crewCap: Math.max(1, Math.min(12, p.crewCap + delta)) }
        : p,
    ),
    snapshotAt: at,
  }
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

  return withCtx({
    ...state,
    cash: state.cash - cost,
    agentSlotPurchases: state.agentSlotPurchases + 1,
    events: pushEvent(
      ctx,
      state.meta,
      state.events,
      'milestone',
      `Bought +1 agent slot for ${formatCash(cost)}. HR pretends this is normal.`,
      at,
    ),
  }, ctx, at)
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
      `Bought +1 GPU tick for ${formatCash(cost)}. Fans spin. Morale does not.`,
      at,
    ),
  }, ctx, at)
}

export function upgradeModelTier(state: GameState, _at: number): GameState {
  return state
}

export function buyFineTune(state: GameState, fineTuneIdArg: string, at: number): GameState {
  const ctx = ctxFrom(state)
  if (state.purchasedFineTunes.includes(fineTuneIdArg)) return state
  if (state.cash < 90) return state
  const tierMatch = fineTuneIdArg.match(/^tune-(\d+)-/)
  if (!tierMatch) return state
  const tier = Number(tierMatch[1])
  const modelTierIndex = getHallucinationLevel(state.meta, 'model')
  if (tier > modelTierIndex) return state

  return withCtx({
    ...state,
    cash: state.cash - 90,
    purchasedFineTunes: [...state.purchasedFineTunes, fineTuneIdArg],
    events: pushEvent(ctx, state.meta, state.events, 'milestone', `Fine-tune purchased: ${fineTuneIdArg}.`, at),
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

  return withCtx({
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
  }, ctx, at)
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
  return withCtx({
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
  }, ctx, at)
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
  state: Pick<GameState, 'meta' | 'purchasedFineTunes' | 'gameDay'>,
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
