import type {
  Agent,
  AgentJob,
  GameEvent,
  GameState,
  Project,
  StaffJob,
  Task,
  TaskStatus,
} from '../types'
import { fineTuneId, getModelTier, MODEL_TIERS } from '../models'
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
  resolvedReviewComments,
  syncTestScope,
  taskIsTested,
  taskNeedsTesting,
} from '../projects'
import { generateAgentName, generatePersonality } from '../personalities'
import {
  APARTMENT_CONFIG,
  COMPACT_DURATION_SEC,
  EXPIRED_LEAD_REP_PENALTY,
  INITIAL_CASH,
  INITIAL_REPUTATION,
  JUST_MERGE_PR_QUALITY,
  LATE_FEE_PERCENT,
  LATE_REP_PENALTY_BASE,
  LEAD_SPAWN_INTERVAL_DAYS,
  LOSE_REPUTATION,
  MAX_ACTIVE_PROJECTS,
  MAX_EVENTS,
  MAX_LEADS,
  ON_TIME_REP_BONUS,
  RENT_INTERVAL_DAYS,
  SECONDS_PER_GAME_DAY,
  WIN_CASH,
} from '../constants'
import {
  agentTickSpeed,
  canUpgradeModelTier,
  computePrBaseQuality,
  contextFillMultiplier,
  fillAgentContext,
  formatStoryPoints,
  getAgentParameters,
  getTotalGpus,
  getTotalRam,
  hasConductorCourse,
  hasPromptEngineering,
  jobStatusFor,
  leadSpawnIntervalDays,
  maxAgents,
  prQualityAfterComments,
  refineJobDurationDays,
  reviewJobDurationDays,
  rollBugAtQa,
  storyPointIncrement,
  storyPointProgressPerTick,
  testStoryPointIncrement,
  usedRam,
} from '../mechanics'
import {
  GPU_UPGRADES,
  housingMeetsRequirement,
  RAM_UPGRADES,
  VIBING_COURSES,
} from '../upgrades'
import { createRngSeed } from '../rng'
import { ctxFrom, uid, withCtx, type SimCtx } from './simCtx'

export type { SimCtx } from './simCtx'

function pushEvent(ctx: SimCtx, events: GameEvent[], type: GameEvent['type'], message: string, at: number): GameEvent[] {
  const entry: GameEvent = { id: uid(ctx, 'evt'), timestamp: at, type, message }
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

export function createInitialState(at: number, rngSeed?: number): GameState {
  const seed = rngSeed ?? createRngSeed()
  const ctx = ctxFrom({ nextId: 1, rng: seed, snapshotAt: at } as GameState)
  const tutorial = createTutorialProject(ctx)
  const starter = createAgent(ctx)
  starter.job = 'refine'
  starter.projectId = tutorial.id
  starter.status = 'refining'

  const totalRam = 2
  const totalGpus = 1

  const state: GameState = {
    phase: 'playing',
    cash: INITIAL_CASH,
    reputation: INITIAL_REPUTATION,
    gameDay: 0,
    rentDueInDays: RENT_INTERVAL_DAYS,
    apartment: 'cardboard',
    apartmentLeaseRemaining: RENT_INTERVAL_DAYS,
    totalRam,
    totalGpus,
    modelTierIndex: 0,
    purchasedRamUpgrades: [],
    purchasedGpuUpgrades: [],
    purchasedFineTunes: [],
    vibingCourses: [],
    agents: [starter],
    projects: [tutorial],
    leads: [],
    selectedTaskId: null,
    tutorialDone: false,
    leadSpawnCooldown: LEAD_SPAWN_INTERVAL_DAYS,
    events: pushEvent(ctx, [], 'system', 'Day 0. $0. One agent. One laptop. Infinite audacity.', at),
    stats: {
      projectsCompleted: 0,
      tasksMerged: 0,
      agentsDeployed: 1,
      compactionsSurvived: 0,
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

function agentParamsFor(state: Pick<GameState, 'modelTierIndex' | 'purchasedFineTunes'>, job: AgentJob | null): number {
  return getAgentParameters(state.modelTierIndex, state.purchasedFineTunes, job)
}

function canSpawnAgent(state: GameState): boolean {
  const ram = getTotalRam(state)
  const cap = maxAgents(ram, state.modelTierIndex)
  if (state.agents.length >= cap) return false
  const nextUsed = usedRam(state.agents.length + 1, state.modelTierIndex)
  return nextUsed <= ram
}

function isAgentBusy(agent: Agent): boolean {
  if (!agent.job) return false
  if (agent.status === 'compacting') return true
  if (agent.job === 'conductor') return false
  return agentIsWorking(agent)
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

function clearAgentAssignmentsOnProjects(projects: Project[]): Project[] {
  return projects.map((p) => ({
    ...p,
    tasks: p.tasks.map((t) => {
      if (!t.assignedAgentId) return t
      return {
        ...t,
        assignedAgentId: null,
        status: t.storyPointsEarned > 0 ? 'in_progress' : 'open',
      }
    }),
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
      status: t.storyPointsEarned > 0 ? 'in_progress' : 'open',
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
): { agents: Agent[]; agentId: string } | null {
  const unassignedIdx = agents.findIndex((a) => a.job === null)
  if (unassignedIdx >= 0) {
    const next = [...agents]
    const assigned = assignAgentToRole(next[unassignedIdx], projectId, job)
    next[unassignedIdx] = assigned
    return { agents: next, agentId: assigned.id }
  }
  if (!canSpawnAgent({ ...state, agents })) return null
  const agent = createAgent(ctx)
  agent.job = job
  agent.projectId = projectId
  agent.status = job === 'conductor' ? 'conducting' : 'idle'
  return { agents: [...agents, agent], agentId: agent.id }
}

function hasUnassignedAgent(agents: Agent[]): boolean {
  return agents.some((a) => a.job === null)
}

function mergeTaskOnProject(
  projects: Project[],
  taskId: string,
  state: Pick<GameState, 'modelTierIndex' | 'purchasedFineTunes' | 'vibingCourses'>,
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
  state: Pick<GameState, 'modelTierIndex' | 'purchasedFineTunes' | 'vibingCourses'>,
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
): Agent[] {
  let nextAgents = [...agents]

  if (project.useConductor && hasConductorCourse(state.vibingCourses)) {
    const conductors = projectAgents(project.id, 'conductor', nextAgents)
    const hasConductor = conductors.length > 0
    const desiredConductor = project.roleCounts.conductor > 0 ? 1 : 0

    if (desiredConductor > 0 && !hasConductor) {
      const staffed = staffAgentForRole(ctx, { ...state, agents: nextAgents }, nextAgents, project.id, 'conductor')
      if (staffed) nextAgents = staffed.agents
    }
    if (desiredConductor === 0 && hasConductor) {
      const result = unassignAgentFromRole(nextAgents, project.id, 'conductor', state.projects)
      if (result) nextAgents = result.agents
    }

    const workerCap = Math.max(0, project.crewCap - projectAgents(project.id, 'conductor', nextAgents).length)
    const workers = nextAgents.filter(
      (a) => a.projectId === project.id && a.job && a.job !== 'conductor',
    )

    for (const w of workers) {
      if (
        w.job &&
        w.job !== 'conductor' &&
        w.status === 'idle' &&
        !projectRoleHasWork(project, w.job, w.id, nextAgents)
      ) {
        const result = unassignAgentFromRole(nextAgents, project.id, w.job, state.projects)
        if (result) nextAgents = result.agents
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
          const result = unassignAgentFromRole(nextAgents, project.id, victim.job, state.projects)
          if (result) nextAgents = result.agents
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
        projectRoleHasWork(project, role, 'conductor', nextAgents) &&
        (hasUnassignedAgent(nextAgents) || canSpawnAgent({ ...state, agents: nextAgents }))
      ) {
        const staffed = staffAgentForRole(ctx, { ...state, agents: nextAgents }, nextAgents, project.id, role)
        if (staffed) {
          nextAgents = staffed.agents.map((a) =>
            a.id === staffed.agentId
              ? {
                  ...a,
                  status: projectRoleHasWork(project, role, a.id, staffed.agents)
                    ? jobStatusFor(role)
                    : 'idle',
                }
              : a,
          )
        }
      }
      void current
    }
    return nextAgents
  }

  for (const role of ['refine', 'code', 'review', 'test', 'conductor'] as AgentJob[]) {
    const desired = project.roleCounts[role]
    const current = projectAgents(project.id, role, nextAgents).length

    if (current > desired) {
      let toRemove = current - desired
      while (toRemove > 0) {
        const result = unassignAgentFromRole(nextAgents, project.id, role, state.projects)
        if (!result) break
        nextAgents = result.agents
        toRemove -= 1
      }
    }

    if (current < desired) {
      let toAdd = desired - projectAgents(project.id, role, nextAgents).length
      while (toAdd > 0) {
        if (!hasUnassignedAgent(nextAgents) && !canSpawnAgent({ ...state, agents: nextAgents })) break
        const staffed = staffAgentForRole(ctx, { ...state, agents: nextAgents }, nextAgents, project.id, role)
        if (!staffed) break
        nextAgents = staffed.agents
        if (role !== 'conductor') {
          const hasWork =
            role === 'refine'
              ? projectHasRefineWork(project)
              : role === 'test'
                ? projectHasTestWork(project)
                : projectRoleHasWork(project, role as StaffJob, staffed.agentId, nextAgents)
          nextAgents = nextAgents.map((a) =>
            a.id === staffed.agentId ? { ...a, status: hasWork ? jobStatusFor(role) : 'idle' } : a,
          )
        }
        toAdd -= 1
      }
    }
  }

  return nextAgents
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
            leadSpawnCooldown,
            selectedTaskId,
            modelTierIndex,
            vibingCourses,
          } = state

          let nextAgents = agents.map((a) => ({ ...a }))
          let nextProjects = projects.map((p) => ({
            ...p,
            requirements: p.requirements.map((r) => ({ ...r })),
            tasks: p.tasks.map((t) => ({ ...t })),
          }))
          let nextLeads = leads.map((l) => ({ ...l }))
          let nextEvents = [...events]
          let nextStats = { ...stats }
          let phase: GameState['phase'] = state.phase

          const totalRam = getTotalRam(state)
          const totalGpus = getTotalGpus(state)
          const model = getModelTier(modelTierIndex)!
          const ctxMult = contextFillMultiplier(vibingCourses)

          gameDay += dayProgress
          rentDueInDays -= dayProgress
          apartmentLeaseRemaining -= dayProgress
          leadSpawnCooldown -= dayProgress

          if (rentDueInDays <= 0) {
            const rent = APARTMENT_CONFIG[state.apartment].rent
            cash -= rent
            rentDueInDays += RENT_INTERVAL_DAYS
            nextEvents = pushEvent(ctx, nextEvents, 'system', `Rent due: -$${rent}. Landlord sends a heart emoji.`, at)
          }

          if (leadSpawnCooldown <= 0 && nextLeads.filter((l) => l.status === 'available').length < MAX_LEADS) {
            nextLeads = [generateLead(ctx, reputation, gameDay), ...nextLeads]
            leadSpawnCooldown = leadSpawnIntervalDays(reputation, gameDay)
            nextEvents = pushEvent(ctx, nextEvents, 'lead', 'New client lead appeared. They want it yesterday.', at)
          }

          for (const lead of nextLeads) {
            if (lead.status === 'available') {
              lead.daysToExpire -= dayProgress
              if (lead.daysToExpire <= 0) {
                lead.status = 'expired'
                reputation = Math.max(0, reputation - EXPIRED_LEAD_REP_PENALTY)
                nextEvents = pushEvent(
                  ctx,
                  nextEvents,
                  'lead',
                  `${lead.clientName} ghosted you. Reputation -${EXPIRED_LEAD_REP_PENALTY}.`,
                  at,
                )
              }
            }
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
                nextEvents,
                'project',
                `${project.clientName}: LATE. -$${fee} fee, -${repHit} rep. Extension granted. Suffering continues.`,
                at,
              )
            }
          }

          for (const project of nextProjects.filter((p) => p.status === 'active')) {
            nextAgents = reconcileProjectStaffing(ctx, state, project, nextAgents)
          }

          const baseSpeedGlobal = agentTickSpeed(nextAgents, totalGpus)

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
              nextEvents = pushEvent(ctx, nextEvents, 'crash', `${agent.name} context compacted. Back on task.`, at)
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
              agent.status = 'compacting'
              agent.compactingRemainingSec = COMPACT_DURATION_SEC
              agent.contextUsed = model.contextSize * 1000
              nextStats.compactionsSurvived += 1
              nextEvents = pushEvent(
                ctx,
                nextEvents,
                'crash',
                `${agent.name} context full — auto-compacting (${COMPACT_DURATION_SEC}s)...`,
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
              fillAgentContext(agent, model.contextSize, baseSpeed, deltaSec, ctxMult)
              if (agent.contextUsed >= model.contextSize * 1000) {
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
                    nextEvents = pushEvent(ctx, nextEvents, 'project', autoMerge.eventMessage, at)
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
                agent.jobProgress = 0
                agent.jobDuration = reviewJobDurationDays(task.storyPointsRequired, params)
                nextAgents[agentIdx] = agent
              }

              fillAgentContext(agent, model.contextSize, baseSpeed, deltaSec, ctxMult)
              if (agent.contextUsed >= model.contextSize * 1000) {
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
                            t.id === task.id ? { ...t, reviewed: true } : t,
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
                  nextEvents,
                  'project',
                  `${agent.name} reviewed "${task.title}". PR quality base: ${Math.round(task.prQualityStaging)}%.${commentNote}`,
                  at,
                )

                const autoMerge = tryAutoMergeReviewedPr(nextProjects, task.id, state)
                nextProjects = autoMerge.projects
                if (autoMerge.eventMessage) {
                  nextEvents = pushEvent(ctx, nextEvents, 'project', autoMerge.eventMessage, at)
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
                agent.jobProgress = 0
                agent.jobDuration = refineJobDurationDays(target.storyPoints, params)
                nextAgents[agentIdx] = agent
              }

              fillAgentContext(agent, model.contextSize, baseSpeed, deltaSec, ctxMult)
              if (agent.contextUsed >= model.contextSize * 1000) {
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
                          r.id === target.id ? { ...r, status: refinedStatus } : r,
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
                nextEvents = pushEvent(ctx, nextEvents, 'project', `${agent.name} ${taskSummary}.`, at)
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

              fillAgentContext(agent, model.contextSize, baseSpeed, deltaSec, ctxMult)
              if (agent.contextUsed >= model.contextSize * 1000) {
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
                    nextEvents,
                    'project',
                    `${agent.name} found a bug in "${testTask.title}". ${formatStoryPoints(fixTask.storyPointsRequired)} SP fix task opened. PR was ${Math.round(testTask.prQuality ?? 0)}% clean.`,
                    at,
                  )
                } else if (taskFullyTested) {
                  nextEvents = pushEvent(
                    ctx,
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

          if (cash >= WIN_CASH) {
            phase = 'won'
            nextEvents = pushEvent(ctx, nextEvents, 'milestone', '$10M cash. Retire. You win.', at)
          } else if (reputation <= LOSE_REPUTATION && nextProjects.length === 0) {
            phase = 'lost'
            nextEvents = pushEvent(ctx, nextEvents, 'system', 'No reputation. No clients. Cardboard box acquired. Game over.', at)
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
    leadSpawnCooldown,
    selectedTaskId,
    phase,
    totalRam,
    totalGpus,
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
    events: pushEvent(ctx, state.events, 'project', result.eventMessage, at),
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
    events: pushEvent(ctx, state.events, 'project', result.eventMessage, at),
  }, ctx, at)
}

export function acceptLead(state: GameState, leadId: string, at: number): GameState {
  const ctx = ctxFrom(state)
  const lead = state.leads.find((l) => l.id === leadId)
  if (!lead || lead.status !== 'available') return state
  if (state.reputation < lead.repRequired) return state
  if (state.projects.length >= MAX_ACTIVE_PROJECTS) return state

  const project = createProjectFromLead(ctx, lead, state.gameDay)
  const daysWaited = Math.max(0, Math.floor(state.gameDay - (lead.spawnedGameDay ?? state.gameDay)))
  const waitNote =
    daysWaited > 0 ? ` (${daysWaited}d wait shaved ${daysWaited}d off deadline)` : ''
  return withCtx({
    ...state,
    projects: [...state.projects, project],
    leads: state.leads.map((l) => (l.id === leadId ? { ...l, status: 'accepted' as const } : l)),
    events: pushEvent(
      ctx,
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
    events: pushEvent(ctx, state.events, 'lead', 'Lead rejected. Professional boundaries (for now).', at),
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
  const reputation = state.reputation + (onTime ? ON_TIME_REP_BONUS + qualityBonus : 1)

  const nextProjects = state.projects.filter((p) => p.id !== projectId)
  const nextAgents = state.agents.filter((a) => a.projectId !== projectId)

  let nextEvents = state.events
  const finalCash = state.cash + payment
  if (project.isTutorial && !state.tutorialDone) {
    nextEvents = pushEvent(
      ctx,
      nextEvents,
      'milestone',
      `Tutorial complete! +$${payment}. Upgrade housing — unlock real hardware.`,
      at,
    )
  } else {
    nextEvents = pushEvent(
      ctx,
      nextEvents,
      'milestone',
      `Shipped ${project.clientName}! +$${payment}${onTime ? ' (on time!)' : ''}. Avg PR quality ${Math.round(synced.deliveryQuality)}%.`,
      at,
    )
  }

  let phase = state.phase
  if (finalCash >= WIN_CASH) {
    phase = 'won'
    nextEvents = pushEvent(ctx, nextEvents, 'milestone', '$10M cash. Retire. You win.', at)
  } else if (reputation <= LOSE_REPUTATION && nextProjects.length === 0) {
    phase = 'lost'
    nextEvents = pushEvent(ctx, nextEvents, 'system', 'No reputation. No clients. Game over.', at)
  }

  return withCtx({
    ...state,
    cash: finalCash,
    reputation,
    projects: nextProjects,
    agents: nextAgents,
    stats: { ...state.stats, projectsCompleted: state.stats.projectsCompleted + 1 },
    events: nextEvents,
    phase,
    tutorialDone: state.tutorialDone || !nextProjects.some((p) => p.isTutorial),
  }, ctx, at)
}

export function adjustRoleCount(state: GameState, projectId: string, job: AgentJob, delta: number, at: number): GameState {
  const ctx = ctxFrom(state)
  const project = state.projects.find((p) => p.id === projectId)
  if (!project) return state

  if (delta > 0 && !hasUnassignedAgent(state.agents) && !canSpawnAgent(state)) return state

  if (delta < 0) {
    const result = unassignAgentFromRole(state.agents, projectId, job, state.projects, { force: true })
    if (!result) return state
    return withCtx({
      ...state,
      agents: result.agents,
      projects: state.projects.map((p) =>
        p.id === projectId
          ? { ...p, roleCounts: { ...p.roleCounts, [job]: Math.max(0, p.roleCounts[job] + delta) } }
          : p,
      ),
      events: pushEvent(ctx, state.events, 'project', `Pulled one ${job} agent off ${project.clientName}.`, at),
    }, ctx, at)
  }

  const nextProjects = state.projects.map((p) =>
    p.id === projectId
      ? { ...p, roleCounts: { ...p.roleCounts, [job]: p.roleCounts[job] + delta } }
      : p,
  )
  const updatedProject = nextProjects.find((p) => p.id === projectId)!
  const nextAgents = reconcileProjectStaffing(ctx, state, updatedProject, state.agents)

  return withCtx({
    ...state,
    agents: nextAgents,
    projects: nextProjects,
    stats: {
      ...state.stats,
      agentsDeployed: Math.max(state.stats.agentsDeployed, nextAgents.length),
    },
    events: pushEvent(ctx, state.events, 'project', `Staffed +1 ${job} on ${project.clientName}.`, at),
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

export function buyRamUpgrade(state: GameState, upgradeId: string, at: number): GameState {
  const ctx = ctxFrom(state)
  const upgrade = RAM_UPGRADES.find((u) => u.id === upgradeId)
  if (!upgrade || state.purchasedRamUpgrades.includes(upgradeId)) return state
  if (!housingMeetsRequirement(state.apartment, upgrade.housingRequired)) return state
  if (state.cash < upgrade.cost) return state

  const purchasedRamUpgrades = [...state.purchasedRamUpgrades, upgradeId]
  return withCtx({
    ...state,
    cash: state.cash - upgrade.cost,
    purchasedRamUpgrades,
    totalRam: getTotalRam({ purchasedRamUpgrades }),
    events: pushEvent(ctx, state.events, 'milestone', `Installed ${upgrade.label}. ${upgrade.tagline}`, at),
  }, ctx, at)
}

export function buyGpuUpgrade(state: GameState, upgradeId: string, at: number): GameState {
  const ctx = ctxFrom(state)
  const upgrade = GPU_UPGRADES.find((u) => u.id === upgradeId)
  if (!upgrade || state.purchasedGpuUpgrades.includes(upgradeId)) return state
  if (!housingMeetsRequirement(state.apartment, upgrade.housingRequired)) return state
  if (state.cash < upgrade.cost) return state

  const purchasedGpuUpgrades = [...state.purchasedGpuUpgrades, upgradeId]
  return withCtx({
    ...state,
    cash: state.cash - upgrade.cost,
    purchasedGpuUpgrades,
    totalGpus: getTotalGpus({ purchasedGpuUpgrades }),
    events: pushEvent(ctx, state.events, 'milestone', `Installed ${upgrade.label}. ${upgrade.tagline}`, at),
  }, ctx, at)
}

export function upgradeModelTier(state: GameState, at: number): GameState {
  const ctx = ctxFrom(state)
  const nextTier = state.modelTierIndex + 1
  const next = getModelTier(nextTier)
  if (!next) return state
  if (state.cash < next.upgradeCost) return state
  if (!canUpgradeModelTier(getTotalRam(state), state.modelTierIndex)) return state

  const despawned = state.agents.length
  const upgradeMessage =
    despawned > 0
      ? `Upgraded to ${next.displayName}. ${next.tagline} ${despawned} agent${despawned === 1 ? '' : 's'} despawned — redeploy on the new tier.`
      : `Upgraded to ${next.displayName}. ${next.tagline}`

  return withCtx({
    ...state,
    cash: state.cash - next.upgradeCost,
    modelTierIndex: nextTier,
    agents: [],
    projects: clearAgentAssignmentsOnProjects(state.projects),
    events: pushEvent(ctx, state.events, 'milestone', upgradeMessage, at),
  }, ctx, at)
}

export function buyFineTune(state: GameState, fineTuneIdArg: string, at: number): GameState {
  const ctx = ctxFrom(state)
  if (state.purchasedFineTunes.includes(fineTuneIdArg)) return state
  if (state.cash < 90) return state
  const tierMatch = fineTuneIdArg.match(/^tune-(\d+)-/)
  if (!tierMatch) return state
  const tier = Number(tierMatch[1])
  if (tier > state.modelTierIndex) return state

  return withCtx({
    ...state,
    cash: state.cash - 90,
    purchasedFineTunes: [...state.purchasedFineTunes, fineTuneIdArg],
    events: pushEvent(ctx, state.events, 'milestone', `Fine-tune purchased: ${fineTuneIdArg}.`, at),
  }, ctx, at)
}

export function buyVibingCourse(state: GameState, courseId: string, at: number): GameState {
  const ctx = ctxFrom(state)
  const course = VIBING_COURSES.find((c) => c.id === courseId)
  if (!course || state.vibingCourses.includes(courseId)) return state
  if (state.cash < course.cost) return state

  return withCtx({
    ...state,
    cash: state.cash - course.cost,
    vibingCourses: [...state.vibingCourses, courseId],
    events: pushEvent(
      ctx,
      state.events,
      'milestone',
      `Enrolled in ${course.label}: "${course.tagline}"`,
      at,
    ),
  }, ctx, at)
}

export function upgradeApartment(state: GameState, at: number): GameState {
  const ctx = ctxFrom(state)
  const tiers = ['cardboard', 'shared_1br', 'studio', 'loft', 'penthouse'] as const
  const idx = tiers.indexOf(state.apartment)
  if (idx < 0 || idx >= tiers.length - 1) return state
  const next = tiers[idx + 1]
  const cost = APARTMENT_CONFIG[next].upgradeCost
  if (state.cash < cost) return state

  return withCtx({
    ...state,
    cash: state.cash - cost,
    apartment: next,
    apartmentLeaseRemaining: RENT_INTERVAL_DAYS,
    rentDueInDays: RENT_INTERVAL_DAYS,
    events: pushEvent(
      ctx,
      state.events,
      'milestone',
      `Moved to ${APARTMENT_CONFIG[next].label}. New hardware tiers unlocked.`,
      at,
    ),
  }, ctx, at)
}

export function retire(state: GameState, at: number): GameState {
  if (state.phase !== 'playing' || state.cash < WIN_CASH) return state
  const ctx = ctxFrom(state)
  return withCtx({
    ...state,
    phase: 'won',
    events: pushEvent(ctx, state.events, 'milestone', '$10M cash. Retire. You win.', at),
  }, ctx, at)
}

export function resetGame(at: number, rngSeed?: number): GameState {
  return createInitialState(at, rngSeed)
}

export function getNetWorth(state: Pick<GameState, 'cash'>): number {
  return state.cash
}

export function getNextApartment(state: Pick<GameState, 'apartment'>): string | null {
  const tiers = ['cardboard', 'shared_1br', 'studio', 'loft', 'penthouse'] as const
  const idx = tiers.indexOf(state.apartment)
  return idx < tiers.length - 1 ? tiers[idx + 1] : null
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
  state: Pick<GameState, 'modelTierIndex' | 'purchasedFineTunes' | 'gameDay'>,
): number {
  const params = agentParamsFor(state, 'code')
  return storyPointProgressPerTick(params, state.gameDay)
}

export function canStaffAdditionalAgent(state: GameState): boolean {
  return hasUnassignedAgent(state.agents) || canSpawnAgent(state)
}

export function agentCapacity(state: GameState): { used: number; max: number; totalRam: number; totalGpus: number } {
  const totalRam = getTotalRam(state)
  const totalGpus = getTotalGpus(state)
  return {
    used: state.agents.length,
    max: maxAgents(totalRam, state.modelTierIndex),
    totalRam,
    totalGpus,
  }
}

export { fineTuneId, getModelTier, MODEL_TIERS }
