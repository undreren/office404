import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Agent, GameEvent, GameStore, Lead, LoadedModel, PlayerAction, Project, Server, Task, TaskStatus } from './types'
import { getModel, migrateModelId } from './models'
import {
  countActiveTasks,
  createBugFixTask,
  createProjectFromLead,
  createReviewCommentTasks,
  createTutorialProject,
  generateLead,
  hiddenBugsOnProject,
  pickRefineTarget,
  pickCodingTask as pickCodingTaskFromProject,
  pickReviewTask,
  pickTestTask,
  projectHasTestWork,
  projectRoleHasWork,
  resolvedReviewComments,
  refineTargetId,
  requirementToTask,
  splitTask,
  syncTestScope,
  taskIsTested,
  taskNeedsTesting,
} from './projects'
import { generateAgentName, generatePersonality } from './personalities'
import {
  APARTMENT_CONFIG,
  BUG_SHIPPED_PAYMENT_PENALTY,
  BUG_SHIPPED_REP_PENALTY,
  BUG_SHIPPED_SANITY_PENALTY,
  EXPIRED_LEAD_REP_PENALTY,
  EXTINGUISH_COST,
  INITIAL_CASH,
  INITIAL_MAX_TOKENS,
  INITIAL_REPUTATION,
  INITIAL_SANITY,
  INITIAL_TOKENS,
  LATE_FEE_PERCENT,
  LATE_REP_PENALTY_BASE,
  LEAD_SPAWN_INTERVAL_DAYS,
  LOSE_REPUTATION,
  MAX_EVENTS,
  MAX_ACTIVE_PROJECTS,
  MAX_LEADS,
  ON_TIME_REP_BONUS,
  RACK_CONFIG,
  RACK_REFURBISH_VALUE,
  RENT_INTERVAL_DAYS,
  SANITY_VIBE_RESTORE,
  SAVE_KEY,
  SECONDS_PER_GAME_DAY,
  COMPACT_DURATION_SEC,
  TOKEN_PACK_AMOUNT,
  TOKEN_PACK_COST,
  WIN_NET_WORTH,
} from './constants'
import {
  LAPTOP_HOST_ID,
  agentJobDurationDays,
  agentTickSpeed,
  amnesiaLossFraction,
  bugDiscoveryChance,
  computeBugChance,
  computePrQualityFromReview,
  computeQualityHit,
  computeRevealedQualityHit,
  computeReviewCommentReduction,
  computeHostUsedRam,
  computeTotalAvailableRam,
  computeTotalUsedRam,
  effectiveSuccessRate,
  fillAgentContext,
  formatStoryPoints,
  getAgentParameters,
  getHostRam,
  getTaskQualityParameters,
  jobStatusFor,
  ramForLoadedModel,
  refactorRatePerDay,
  refineJobDurationDays,
  reviewAccuracy,
  reviewJobDurationDays,
  storyPointIncrement,
  testStoryPointIncrement,
  testSuccessRate,
} from './mechanics'

let idCounter = 0
function uid(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now()}-${idCounter}`
}

function pushEvent(events: GameEvent[], type: GameEvent['type'], message: string): GameEvent[] {
  const entry: GameEvent = { id: uid('evt'), timestamp: Date.now(), type, message }
  return [entry, ...events].slice(0, MAX_EVENTS)
}

function emptyAgentJob(): Pick<Agent, 'job' | 'taskId' | 'projectId' | 'jobProgress' | 'jobDuration' | 'status'> {
  return { job: null, taskId: null, projectId: null, jobProgress: 0, jobDuration: 0, status: 'idle' }
}

function clearAgentJob(agent: Agent): Agent {
  return { ...agent, ...emptyAgentJob(), contextUsed: 0, compactingRemainingSec: 0 }
}

function applyCompactionAmnesia(agent: Agent, projects: Project[]): Project[] {
  if (!agent.job || agent.job === 'refactor') return projects

  const loss = amnesiaLossFraction()
  if (loss <= 0) return projects

  if (agent.job === 'code' && agent.taskId) {
    return updateTask(projects, agent.taskId, (t) => ({
      ...t,
      storyPointsEarned: Math.max(0, t.storyPointsEarned * (1 - loss)),
    }))
  }
  if (agent.job === 'test' && agent.taskId) {
    return updateTask(projects, agent.taskId, (t) => ({
      ...t,
      testStoryPointsEarned: Math.max(0, t.testStoryPointsEarned * (1 - loss)),
    }))
  }
  if (agent.job === 'review' || agent.job === 'refine') {
    agent.jobProgress = Math.max(0, agent.jobProgress * (1 - loss))
  }
  return projects
}

function finishCompaction(
  agent: Agent,
  projects: Project[],
): { agent: Agent; projects: Project[] } {
  const nextProjects = applyCompactionAmnesia(agent, projects)
  return {
    agent: {
      ...agent,
      contextUsed: 0,
      compactingRemainingSec: 0,
      status: jobStatusFor(agent.job),
    },
    projects: nextProjects,
  }
}

function createInitialState() {
  const tutorial = createTutorialProject()
  return {
    phase: 'playing' as const,
    cash: INITIAL_CASH,
    tokens: INITIAL_TOKENS,
    maxTokens: INITIAL_MAX_TOKENS,
    sanity: INITIAL_SANITY,
    reputation: INITIAL_REPUTATION,
    gameDay: 0,
    rentDueInDays: RENT_INTERVAL_DAYS,
    apartment: 'cardboard' as const,
    apartmentLeaseRemaining: RENT_INTERVAL_DAYS,
    usedRam: 0,
    totalRam: 4,
    ownedLocalModels: ['local-1b', 'local-2b', 'local-4b'] as string[],
    loadedModels: [] as LoadedModel[],
    servers: [] as Server[],
    agents: [] as Agent[],
    projects: [tutorial],
    leads: [] as Lead[],
    selectedTaskId: null,
    playerAction: null as PlayerAction | null,
    tutorialDone: false,
    leadSpawnCooldown: LEAD_SPAWN_INTERVAL_DAYS,
    events: [
      {
        id: uid('evt'),
        timestamp: Date.now(),
        type: 'system' as const,
        message: 'Day 0. $0. Load a 1B on your laptop. You manage; they code. You vibe.',
      },
    ],
    stats: {
      projectsCompleted: 0,
      tasksMerged: 0,
      agentsDeployed: 0,
      compactionsSurvived: 0,
    },
  }
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

function mergeTaskOnProject(
  projects: Project[],
  taskId: string,
  agents: Agent[],
  reviewed: boolean,
): { projects: Project[]; eventMessage: string; introducedBug: boolean } | null {
  const found = findTask(projects, taskId)
  if (!found || found.task.status !== 'pr_ready') return null
  if (reviewed && !found.task.reviewed) return null

  const params = getTaskQualityParameters(found.task, agents)
  const taskCount = countActiveTasks(found.project)
  const baseHit = computeQualityHit(found.task.storyPointsRequired, params, taskCount)
  const resolvedCount = reviewed
    ? resolvedReviewComments(found.project, taskId).length
    : 0
  const commentReduction = reviewed
    ? computeReviewCommentReduction(baseHit, resolvedCount)
    : 0
  const hit = Math.max(0.5, baseHit - commentReduction)
  const prQuality = computePrQualityFromReview(
    baseHit,
    reviewed ? found.task.revealedQualityHit : null,
  )
  const bugChance = computeBugChance(
    found.project.quality,
    params,
    found.task.storyPointsRequired,
    prQuality,
  )
  const introducedBug = Math.random() < bugChance

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
              pendingQualityHit: hit,
              hasUndiscoveredBug: introducedBug,
            }
          : t,
      )
    return syncTestScope({
      ...p,
      quality: Math.max(0, p.quality - hit),
      tasks: updatedTasks,
    })
  })

  const reviewNote =
    reviewed && found.task.revealedQualityHit !== null
      ? `review guessed -${found.task.revealedQualityHit.toFixed(1)}`
      : 'no review'
  const reductionNote =
    reviewed && commentReduction > 0
      ? `, comments saved ${commentReduction.toFixed(1)}`
      : ''
  const orphanNote =
    unresolvedComments.length > 0
      ? ` ${unresolvedComments.length} review comment${unresolvedComments.length > 1 ? 's' : ''} left to rot in GitHub purgatory.`
      : ''
  const bugNote = introducedBug ? ' A bug slithered in.' : ''
  const eventMessage = reviewed
    ? `Merged "${found.task.title}". Quality -${hit.toFixed(1)} (${reviewNote}${reductionNote}).${orphanNote}${bugNote}`
    : `Just Merged "${found.task.title}" without review. Quality -${hit.toFixed(1)}.${orphanNote}${bugNote}`

  return { projects: nextProjects, eventMessage, introducedBug }
}

function computeNetWorth(state: Pick<GameStore, 'cash' | 'servers'>): number {
  const rackValue = state.servers.reduce((sum, s) => sum + (RACK_REFURBISH_VALUE[s.tier] ?? 0), 0)
  return state.cash + rackValue
}

function rackGpus(): Record<string, number> {
  return Object.fromEntries(Object.entries(RACK_CONFIG).map(([k, v]) => [k, v.gpus]))
}

function rackRam(): Record<string, number> {
  return Object.fromEntries(Object.entries(RACK_CONFIG).map(([k, v]) => [k, v.ram]))
}

function syncRam(state: Pick<GameStore, 'loadedModels' | 'agents' | 'servers'>) {
  return {
    usedRam: computeTotalUsedRam(state.loadedModels, state.agents, state.servers),
    totalRam: computeTotalAvailableRam(state.servers, rackRam()),
  }
}

function pickCodingTask(project: Project, agentId: string, agents: Agent[]): Task | null {
  return pickCodingTaskFromProject(project, agentId, agents)
}

function releaseRefineClaims(
  agents: Agent[],
  projectId: string,
  targetId: string,
  exceptAgentId: string,
): Agent[] {
  return agents.map((ag) => {
    if (ag.id === exceptAgentId) return ag
    if (ag.job === 'refine' && ag.projectId === projectId && ag.taskId === targetId) {
      return { ...ag, taskId: null, jobProgress: 0 }
    }
    return ag
  })
}

function tryProgressTask(
  projects: Project[],
  taskId: string,
  completedByAgentId: string | null,
): { projects: Project[]; becameDone: boolean; becamePrReady: boolean } {
  let becameDone = false
  let becamePrReady = false
  const next = updateTask(projects, taskId, (t) => {
    if (t.status === 'merged' || t.status === 'pr_ready') return t
    if (t.isReviewComment && t.status === 'done') return t
    const increment = storyPointIncrement(t.storyPointsRequired, t.storyPointsEarned)
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
    return {
      ...t,
      storyPointsEarned: earned,
      status,
      completedByAgentId: complete ? completedByAgentId : t.completedByAgentId,
      assignedAgentId: complete ? null : t.assignedAgentId,
    }
  })
  return { projects: next, becameDone, becamePrReady }
}

function canFitLoadOnHost(
  hostId: string,
  modelId: string,
  loadedModels: LoadedModel[],
  agents: Agent[],
  servers: Server[],
): boolean {
  const model = getModel(modelId)
  if (!model) return false
  const hostRam = getHostRam(hostId, servers, rackRam())
  const used = computeHostUsedRam(hostId, loadedModels, agents)
  return used + model.loadRam <= hostRam
}

function canFitTaskOnHost(
  hostId: string,
  loadedModelId: string,
  modelId: string,
  loadedModels: LoadedModel[],
  agents: Agent[],
  servers: Server[],
): boolean {
  const model = getModel(modelId)
  if (!model) return false
  const hostRam = getHostRam(hostId, servers, rackRam())
  const used = computeHostUsedRam(hostId, loadedModels, agents)
  const current = ramForLoadedModel(modelId, agents, loadedModelId)
  const withTask = model.loadRam + (agents.filter((a) => a.loadedModelId === loadedModelId && a.taskId).length + 1) * (model.loadRam / 2)
  return used - current + withTask <= hostRam
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...createInitialState(),

      tick(deltaSec: number) {
        const stateAtStart = get()
        if (stateAtStart.phase !== 'playing') return

        const dayProgress = deltaSec / SECONDS_PER_GAME_DAY
        let {
          cash,
          tokens,
          sanity,
          reputation,
          gameDay,
          rentDueInDays,
          apartmentLeaseRemaining,
          agents,
          servers,
          loadedModels,
          projects,
          leads,
          events,
          stats,
          playerAction,
          leadSpawnCooldown,
          selectedTaskId,
        } = stateAtStart

        let nextAgents = agents.map((a) => ({ ...a }))
        let nextServers = servers.map((s) => ({ ...s }))
        let nextLoadedModels = loadedModels.map((lm) => ({ ...lm }))
        let nextProjects = projects.map((p) => ({
          ...p,
          requirements: p.requirements.map((r) => ({ ...r })),
          tasks: p.tasks.map((t) => ({ ...t })),
        }))
        let nextLeads = leads.map((l) => ({ ...l }))
        let nextEvents = [...events]
        let nextStats = { ...stats }
        let nextPlayerAction = playerAction ? { ...playerAction } : null
        let phase: GameStore['phase'] = stateAtStart.phase

        gameDay += dayProgress
        rentDueInDays -= dayProgress
        apartmentLeaseRemaining -= dayProgress
        leadSpawnCooldown -= dayProgress

        if (rentDueInDays <= 0) {
          const rent = APARTMENT_CONFIG[stateAtStart.apartment].rent
          cash -= rent
          rentDueInDays += RENT_INTERVAL_DAYS
          nextEvents = pushEvent(nextEvents, 'system', `Rent due: -$${rent}. Landlord sends a heart emoji.`)
        }

        if (leadSpawnCooldown <= 0 && nextLeads.filter((l) => l.status === 'available').length < MAX_LEADS) {
          nextLeads = [generateLead(reputation), ...nextLeads]
          leadSpawnCooldown = LEAD_SPAWN_INTERVAL_DAYS
          nextEvents = pushEvent(nextEvents, 'lead', 'New client lead appeared. They want it yesterday.')
        }

        for (const lead of nextLeads) {
          if (lead.status === 'available') {
            lead.daysToExpire -= dayProgress
            if (lead.daysToExpire <= 0) {
              lead.status = 'expired'
              reputation = Math.max(0, reputation - EXPIRED_LEAD_REP_PENALTY)
              nextEvents = pushEvent(
                nextEvents,
                'lead',
                `${lead.clientName} ghosted you. Reputation -${EXPIRED_LEAD_REP_PENALTY}.`,
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
              nextEvents,
              'project',
              `${project.clientName}: LATE. -$${fee} fee, -${repHit} rep. Extension granted. Suffering continues.`,
            )
          }
        }

        sanity = Math.min(100, sanity + SANITY_VIBE_RESTORE * dayProgress)

        let tokenBurn = 0
        const gpus = rackGpus()
        const tokensBeforeTick = tokens

        for (let agentIdx = 0; agentIdx < nextAgents.length; agentIdx++) {
          let agent = nextAgents[agentIdx]
          if (agent.status !== 'compacting') continue

          agent.compactingRemainingSec = Math.max(0, agent.compactingRemainingSec - deltaSec)
          if (agent.compactingRemainingSec > 0) {
            nextAgents[agentIdx] = agent
            continue
          }

          const finished = finishCompaction(agent, nextProjects)
          agent = finished.agent
          nextProjects = finished.projects
          nextAgents[agentIdx] = agent
          nextEvents = pushEvent(
            nextEvents,
            'crash',
            `${agent.name} context compacted. Woke up fuzzy — some task progress lost.`,
          )
        }

        for (let agentIdx = 0; agentIdx < nextAgents.length; agentIdx++) {
          let agent = nextAgents[agentIdx]
          const model = getModel(agent.modelId)
          if (!model || !agent.job) continue
          if (agent.status === 'compacting' || agent.status === 'compacted' || agent.status === 'crashed') {
            continue
          }

          if (model.kind === 'local') {
            const hostId = agent.serverId
            if (!hostId) continue
            if (hostId !== LAPTOP_HOST_ID) {
              const server = nextServers.find((s) => s.id === hostId)
              if (!server || server.onFire) continue
            }
          }

          const baseSpeed = agentTickSpeed(agent, nextAgents, nextServers, gpus)
          if (baseSpeed <= 0) continue

          agent.uptime += dayProgress

          if (model.kind === 'cloud') {
            const cost = model.tokenCostPerTick * baseSpeed * deltaSec
            if (tokens <= 0) continue
            tokenBurn += cost
            agent.totalTokensBurned += cost
          }

          const overflow = () => {
            agent.status = 'compacting'
            agent.compactingRemainingSec = COMPACT_DURATION_SEC
            agent.contextUsed = model.contextSize * 1000
            nextStats.compactionsSurvived += 1
            nextEvents = pushEvent(
              nextEvents,
              'crash',
              `${agent.name} context full — auto-compacting (${COMPACT_DURATION_SEC}s)...`,
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
              nextAgents[agentIdx] = agent
              nextProjects = updateTask(nextProjects, nextTask.id, (t) => ({
                ...t,
                assignedAgentId: agent.id,
                status: t.status === 'open' ? 'in_progress' : t.status,
              }))
              taskRef = { project, task: nextTask }
            }

            agent.status = 'working'

            const fillPct = fillAgentContext(agent, model, baseSpeed, deltaSec)
            if (agent.contextUsed >= model.contextSize * 1000) {
              overflow()
              continue
            }

            const success = effectiveSuccessRate(
              model.parameters,
              taskRef.task.storyPointsRequired,
              fillPct,
            )
            if (Math.random() < success * baseSpeed) {
              const result = tryProgressTask(nextProjects, agent.taskId!, agent.id)
              nextProjects = result.projects
              if (result.becamePrReady) {
                agent.taskId = null
                nextEvents = pushEvent(
                  nextEvents,
                  'project',
                  `${agent.name} finished "${taskRef.task.title}". PR opened — ready for review.`,
                )
              } else if (result.becameDone) {
                agent.taskId = null
                nextEvents = pushEvent(
                  nextEvents,
                  'project',
                  `${agent.name} addressed review comment: "${taskRef.task.title}".`,
                )
              }
            }
          } else if (agent.job === 'review' && agent.projectId) {
            const project = nextProjects.find((p) => p.id === agent.projectId)
            if (!project || project.status !== 'active') {
              Object.assign(agent, clearAgentJob(agent))
              continue
            }

            const prTasks = project.tasks.filter((t) => t.status === 'pr_ready' && !t.reviewed)
            if (prTasks.length === 0) {
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
              agent.jobDuration = reviewJobDurationDays(
                task.storyPointsRequired,
                project.quality,
                model.parameters,
              )
              nextAgents[agentIdx] = agent
            }

            fillAgentContext(agent, model, baseSpeed, deltaSec)
            if (agent.contextUsed >= model.contextSize * 1000) {
              overflow()
              nextAgents[agentIdx] = agent
              continue
            }

            agent.jobProgress += dayProgress * baseSpeed
            if (agent.jobProgress >= agent.jobDuration) {
              const taskCount = countActiveTasks(project)
              const authorParams = getTaskQualityParameters(task, nextAgents)
              const trueHit = computeQualityHit(task.storyPointsRequired, authorParams, taskCount)
              const revealed = computeRevealedQualityHit(
                trueHit,
                model.parameters,
                task.storyPointsRequired,
              )
              const comments = createReviewCommentTasks(task, model.parameters, model.kind === 'cloud')

              nextProjects = nextProjects.map((p) =>
                p.id === project.id
                  ? {
                      ...p,
                      tasks: [
                        ...p.tasks.map((t) =>
                          t.id === task.id
                            ? { ...t, revealedQualityHit: revealed, reviewed: true }
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
                nextEvents,
                'project',
                `${agent.name} reviewed "${task.title}". Est. quality hit: -${revealed.toFixed(1)}.${commentNote}`,
              )
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
              if (agent.taskId) {
                agent.taskId = null
                agent.jobProgress = 0
              }
              nextAgents[agentIdx] = agent
              continue
            }

            agent.status = 'refining'

            const targetId = refineTargetId(target)
            const targetSp =
              target.kind === 'requirement'
                ? target.requirement.storyPoints
                : target.task.storyPointsRequired

            if (agent.taskId !== targetId) {
              agent.taskId = targetId
              agent.jobProgress = 0
              agent.jobDuration = refineJobDurationDays(
                targetSp,
                project.quality,
                model.parameters,
              )
              nextAgents[agentIdx] = agent
            }

            fillAgentContext(agent, model, baseSpeed, deltaSec)
            if (agent.contextUsed >= model.contextSize * 1000) {
              overflow()
              nextAgents[agentIdx] = agent
              continue
            }

            agent.jobProgress += dayProgress * baseSpeed
            if (agent.jobProgress >= agent.jobDuration) {
              if (target.kind === 'requirement') {
                const task = requirementToTask(target.requirement)
                nextAgents = releaseRefineClaims(
                  nextAgents,
                  project.id,
                  target.requirement.id,
                  agent.id,
                )
                agent = nextAgents[agentIdx]
                nextProjects = nextProjects.map((p) =>
                  p.id === project.id
                    ? {
                        ...p,
                        requirements: p.requirements.map((r) =>
                          r.id === target.requirement.id ? { ...r, status: 'refined' as const } : r,
                        ),
                        tasks: [...p.tasks, task],
                      }
                    : p,
                )
                if (!selectedTaskId) selectedTaskId = task.id
                nextEvents = pushEvent(
                  nextEvents,
                  'project',
                  `${agent.name} refined requirement "${target.requirement.title}" into a ${formatStoryPoints(task.storyPointsRequired)} SP task.`,
                )
              } else {
                const [a, b] = splitTask(target.task)
                nextAgents = releaseRefineClaims(nextAgents, project.id, target.task.id, agent.id)
                agent = nextAgents[agentIdx]
                nextProjects = nextProjects.map((p) =>
                  p.id === project.id
                    ? {
                        ...p,
                        tasks: p.tasks.filter((t) => t.id !== target.task.id).concat([a, b]),
                      }
                    : p,
                )
                if (selectedTaskId === target.task.id) selectedTaskId = a.id
                nextEvents = pushEvent(
                  nextEvents,
                  'project',
                  `${agent.name} split "${target.task.title}" into ${formatStoryPoints(a.storyPointsRequired)}+${formatStoryPoints(b.storyPointsRequired)} SP.`,
                )
              }
              agent.jobProgress = 0
              agent.taskId = null
            }
          } else if (agent.job === 'refactor' && agent.projectId) {
            const project = nextProjects.find((p) => p.id === agent.projectId)
            if (!project || project.status !== 'active') {
              Object.assign(agent, clearAgentJob(agent))
              continue
            }

            fillAgentContext(agent, model, baseSpeed, deltaSec)
            if (agent.contextUsed >= model.contextSize * 1000) {
              overflow()
              nextAgents[agentIdx] = agent
              continue
            }

            const qualityGain = refactorRatePerDay(model.parameters) * dayProgress * baseSpeed
            if (qualityGain > 0) {
              nextProjects = nextProjects.map((p) =>
                p.id === project.id
                  ? { ...p, quality: Math.min(100, p.quality + qualityGain) }
                  : p,
              )
            }
          } else if (agent.job === 'test' && agent.projectId) {
            const project = nextProjects.find((p) => p.id === agent.projectId)
            if (!project || project.status !== 'active') {
              Object.assign(agent, clearAgentJob(agent))
              continue
            }

            if (!projectHasTestWork(project)) {
              Object.assign(agent, clearAgentJob(agent))
              continue
            }

            let testTask = agent.taskId
              ? project.tasks.find((t) => t.id === agent.taskId && taskNeedsTesting(t)) ?? null
              : null
            if (!testTask) {
              testTask = pickTestTask(project, agent.id, nextAgents)
              if (!testTask) {
                Object.assign(agent, clearAgentJob(agent))
                continue
              }
              agent.taskId = testTask.id
            }

            const fillPct = fillAgentContext(agent, model, baseSpeed, deltaSec)
            if (agent.contextUsed >= model.contextSize * 1000) {
              overflow()
              continue
            }

            const success = testSuccessRate(model.parameters, fillPct)
            if (Math.random() < success * baseSpeed) {
              const increment = testStoryPointIncrement(
                testTask.storyPointsRequired,
                testTask.testStoryPointsEarned,
              )
              const testEarned = Math.min(
                testTask.storyPointsRequired,
                testTask.testStoryPointsEarned + increment,
              )
              const taskFullyTested = testEarned >= testTask.storyPointsRequired

              let discoveredSource: Task | null = null
              if (
                testTask.hasUndiscoveredBug &&
                !testTask.bugDiscovered
              ) {
                const chance =
                  bugDiscoveryChance(model.parameters, testTask.storyPointsRequired) * increment
                if (Math.random() < chance) {
                  discoveredSource = testTask
                }
              }

              nextProjects = updateTask(nextProjects, testTask.id, (t) => ({
                ...t,
                testStoryPointsEarned: testEarned,
                bugDiscovered: discoveredSource ? true : t.bugDiscovered,
              }))

              const projectAfterTask = nextProjects.find((p) => p.id === project.id)
              if (projectAfterTask) {
                const synced = syncTestScope(projectAfterTask)
                let updatedProject: Project = synced

                if (discoveredSource) {
                  const fixTask = createBugFixTask(discoveredSource)
                  updatedProject = {
                    ...synced,
                    tasks: synced.tasks.concat(fixTask),
                    totalStoryPoints: synced.totalStoryPoints + fixTask.storyPointsRequired,
                  }
                  nextEvents = pushEvent(
                    nextEvents,
                    'project',
                    `${agent.name} found a bug in "${discoveredSource.title}". ${formatStoryPoints(fixTask.storyPointsRequired)} SP fix task opened.`,
                  )
                }

                if (taskFullyTested) {
                  nextEvents = pushEvent(
                    nextEvents,
                    'project',
                    `${agent.name} finished QA on "${testTask.title}".`,
                  )
                  agent.taskId = null
                }

                nextProjects = nextProjects.map((p) => (p.id === project.id ? updatedProject : p))
              }
            }
          }

          nextAgents[agentIdx] = agent
        }

        tokens = Math.max(0, tokens - tokenBurn)
        if (
          tokensBeforeTick > 0 &&
          tokens <= 0 &&
          nextAgents.some((a) => a.job && getModel(a.modelId)?.kind === 'cloud')
        ) {
          nextEvents = pushEvent(
            nextEvents,
            'token',
            'Out of tokens. Cloud agents paused until you buy more.',
          )
        }

        for (const server of nextServers) {
          if (server.onFire) {
            server.fireDuration = Math.max(0, server.fireDuration - dayProgress * SECONDS_PER_GAME_DAY)
            if (server.fireDuration <= 0) {
              server.onFire = false
              nextEvents = pushEvent(nextEvents, 'fire', `${server.name} stopped smoldering.`)
            }
          } else if (Math.random() < 0.00008 * deltaSec * nextAgents.length) {
            server.onFire = true
            server.fireDuration = 20 + Math.random() * 15
            nextEvents = pushEvent(nextEvents, 'fire', `SERVER FIRE on ${server.name}! Agents offline.`)
          }
        }

        const netWorth = computeNetWorth({ cash, servers: nextServers })
        if (netWorth >= WIN_NET_WORTH) {
          phase = 'won'
          nextEvents = pushEvent(nextEvents, 'milestone', '$10M net worth. Sell the racks. Retire. You win.')
        } else if (reputation <= LOSE_REPUTATION && nextProjects.length === 0) {
          phase = 'lost'
          nextEvents = pushEvent(nextEvents, 'system', 'No reputation. No clients. Cardboard box acquired. Game over.')
        }

        const ram = syncRam({ loadedModels: nextLoadedModels, agents: nextAgents, servers: nextServers })

        const latest = get()
        if (latest !== stateAtStart) {
          set({
            ...latest,
            gameDay: latest.gameDay + dayProgress,
            rentDueInDays: latest.rentDueInDays - dayProgress,
            apartmentLeaseRemaining: latest.apartmentLeaseRemaining - dayProgress,
            leadSpawnCooldown: latest.leadSpawnCooldown - dayProgress,
            sanity: Math.min(100, latest.sanity + SANITY_VIBE_RESTORE * dayProgress),
            ...syncRam({
              loadedModels: latest.loadedModels,
              agents: latest.agents,
              servers: latest.servers,
            }),
          })
          return
        }

        set({
          cash,
          tokens,
          sanity,
          reputation,
          gameDay,
          rentDueInDays,
          apartmentLeaseRemaining,
          agents: nextAgents,
          servers: nextServers,
          loadedModels: nextLoadedModels,
          projects: nextProjects,
          leads: nextLeads,
          events: nextEvents,
          stats: nextStats,
          playerAction: nextPlayerAction,
          leadSpawnCooldown,
          selectedTaskId,
          phase,
          ...ram,
          tutorialDone: stateAtStart.tutorialDone || !nextProjects.some((p) => p.isTutorial),
        })
      },

      selectTask(taskId) {
        set({ selectedTaskId: taskId })
      },

      startVibe() {
        // Always vibing — no toggle needed.
      },

      mergePr(taskId) {
        const state = get()
        const result = mergeTaskOnProject(state.projects, taskId, state.agents, true)
        if (!result) return

        set({
          projects: result.projects,
          stats: { ...state.stats, tasksMerged: state.stats.tasksMerged + 1 },
          events: pushEvent(state.events, 'project', result.eventMessage),
        })
      },

      justMergePr(taskId) {
        const state = get()
        const result = mergeTaskOnProject(state.projects, taskId, state.agents, false)
        if (!result) return

        set({
          projects: result.projects,
          stats: { ...state.stats, tasksMerged: state.stats.tasksMerged + 1 },
          events: pushEvent(state.events, 'project', result.eventMessage),
        })
      },

      cancelPlayerAction() {
        set({ playerAction: null })
      },

      acceptLead(leadId) {
        const state = get()
        const lead = state.leads.find((l) => l.id === leadId)
        if (!lead || lead.status !== 'available') return
        if (state.reputation < lead.repRequired) return
        if (state.projects.length >= MAX_ACTIVE_PROJECTS) return

        const project = createProjectFromLead(lead)
        set({
          projects: [...state.projects, project],
          leads: state.leads.map((l) => (l.id === leadId ? { ...l, status: 'accepted' as const } : l)),
          events: pushEvent(state.events, 'lead', `Accepted ${lead.clientName}. Regret incoming.`),
        })
      },

      rejectLead(leadId) {
        const state = get()
        set({
          leads: state.leads.map((l) => (l.id === leadId ? { ...l, status: 'rejected' as const } : l)),
          events: pushEvent(state.events, 'lead', 'Lead rejected. Professional boundaries (for now).'),
        })
      },

      deliverProject(projectId) {
        set((state) => {
          const project = state.projects.find((p) => p.id === projectId)
          if (!project || project.status !== 'active') return state
          if (!isReadyToDeliver(project)) return state

          const bugsShipped = hiddenBugsOnProject(project)
          let payment = project.payment
          const onTime = project.lateCount === 0
          let reputation = state.reputation + (onTime ? ON_TIME_REP_BONUS : 1)
          let sanity = state.sanity

          const nextStats = { ...state.stats, projectsCompleted: state.stats.projectsCompleted + 1 }
          const nextProjects = state.projects.filter((p) => p.id !== projectId)
          const nextAgents = state.agents.map((a) =>
            a.projectId === projectId ? clearAgentJob(a) : a,
          )

          let nextEvents = state.events
          if (bugsShipped.length > 0) {
            const paymentPenalty = Math.round(payment * BUG_SHIPPED_PAYMENT_PENALTY * bugsShipped.length)
            payment -= paymentPenalty
            reputation = Math.max(0, reputation - BUG_SHIPPED_REP_PENALTY * bugsShipped.length)
            sanity = Math.max(0, sanity - BUG_SHIPPED_SANITY_PENALTY * bugsShipped.length)
            nextEvents = pushEvent(
              nextEvents,
              'client',
              `${project.clientName} found ${bugsShipped.length} bug${bugsShipped.length > 1 ? 's' : ''} in production. -$${paymentPenalty}, -${BUG_SHIPPED_REP_PENALTY * bugsShipped.length} rep. They're livid.`,
            )
          }

          const finalCash = state.cash + payment
          if (project.isTutorial && !state.tutorialDone) {
            nextEvents = pushEvent(
              nextEvents,
              'milestone',
              `Tutorial complete! +$${payment}. Buy a Mark Mini. You've been deluded into hope.`,
            )
          } else {
            nextEvents = pushEvent(
              nextEvents,
              'milestone',
              `Shipped ${project.clientName}! +$${payment}${onTime ? ' (on time!)' : ' (late, but done)'}${bugsShipped.length > 0 ? ' (bugs included — free of charge)' : ''}.`,
            )
          }

          let nextPlayerAction = state.playerAction
          if (nextPlayerAction?.taskId && project.tasks.some((t) => t.id === nextPlayerAction!.taskId)) {
            nextPlayerAction = null
          }

          let selectedTaskId = state.selectedTaskId
          if (selectedTaskId && project.tasks.some((t) => t.id === selectedTaskId)) {
            selectedTaskId = nextProjects[0]?.tasks[0]?.id ?? null
          }

          let phase = state.phase
          const netWorth = computeNetWorth({ cash: finalCash, servers: state.servers })
          if (netWorth >= WIN_NET_WORTH) {
            phase = 'won'
            nextEvents = pushEvent(nextEvents, 'milestone', '$10M net worth. Sell the racks. Retire. You win.')
          } else if (reputation <= LOSE_REPUTATION && nextProjects.length === 0) {
            phase = 'lost'
            nextEvents = pushEvent(
              nextEvents,
              'system',
              'No reputation. No clients. Cardboard box acquired. Game over.',
            )
          }

          return {
            ...state,
            cash: finalCash,
            reputation,
            sanity,
            projects: nextProjects,
            agents: nextAgents,
            stats: nextStats,
            events: nextEvents,
            playerAction: nextPlayerAction,
            selectedTaskId,
            phase,
            tutorialDone: state.tutorialDone || !nextProjects.some((p) => p.isTutorial),
            ...syncRam({
              loadedModels: state.loadedModels,
              agents: nextAgents,
              servers: state.servers,
            }),
          }
        })
      },

      assignAgentToProject(agentId, projectId, job) {
        const state = get()
        const agent = state.agents.find((a) => a.id === agentId)
        const project = state.projects.find((p) => p.id === projectId)
        if (!agent || !project || agent.job) return
        if (project.status !== 'active') return

        if (job === 'code') {
          const model = getModel(agent.modelId)
          if (!model) return
          if (agent.serverId && agent.loadedModelId) {
            if (
              !canFitTaskOnHost(
                agent.serverId,
                agent.loadedModelId,
                agent.modelId,
                state.loadedModels,
                state.agents,
                state.servers,
              )
            ) {
              return
            }
          }
        }

        const codingTask = job === 'code' ? pickCodingTask(project, agentId, state.agents) : null
        const testTask = job === 'test' ? pickTestTask(project, agentId, state.agents) : null
        const roleHasWork = projectRoleHasWork(project, job, agentId, state.agents)

        const nextAgents = state.agents.map((a) =>
          a.id === agentId
            ? {
                ...a,
                job,
                projectId,
                taskId: codingTask?.id ?? testTask?.id ?? null,
                jobProgress: 0,
                jobDuration: 0,
                status: roleHasWork ? jobStatusFor(job) : ('idle' as const),
                contextUsed: 0,
                compactingRemainingSec: 0,
              }
            : a,
        )

        let nextProjects = state.projects
        if (codingTask) {
          nextProjects = updateTask(nextProjects, codingTask.id, (t) => ({
            ...t,
            assignedAgentId: agentId,
            status: t.status === 'open' ? 'in_progress' : t.status,
          }))
        }

        const jobLabel =
          job === 'code'
            ? 'coding'
            : job === 'review'
              ? 'reviewing PRs'
              : job === 'refine'
                ? 'refining scope'
                : job === 'test'
                  ? 'testing delivery'
                  : 'improving codebase quality'

        set({
          agents: nextAgents,
          projects: nextProjects,
          ...syncRam({ loadedModels: state.loadedModels, agents: nextAgents, servers: state.servers }),
          events: pushEvent(
            state.events,
            'project',
            `${agent.name} ${jobLabel} on ${project.clientName}.`,
          ),
        })
      },

      unassignAgent(agentId) {
        const state = get()
        const agent = state.agents.find((a) => a.id === agentId)
        if (!agent?.job) return

        let nextProjects = state.projects
        if (agent.job === 'code' && agent.taskId) {
          nextProjects = updateTask(nextProjects, agent.taskId, (t) => ({
            ...t,
            assignedAgentId: null,
            status: t.storyPointsEarned > 0 ? 'in_progress' : 'open',
          }))
        }

        const nextAgents = state.agents.map((a) => (a.id === agentId ? clearAgentJob(a) : a))

        set({
          agents: nextAgents,
          projects: nextProjects,
          ...syncRam({ loadedModels: state.loadedModels, agents: nextAgents, servers: state.servers }),
          events: pushEvent(state.events, 'system', `${agent.name} pulled off duty. Context wiped.`),
        })
      },

      restartAgent(agentId) {
        const state = get()
        const agent = state.agents.find((a) => a.id === agentId)
        if (!agent || (agent.status !== 'compacting' && agent.status !== 'compacted')) return

        const finished = finishCompaction(
          { ...agent, compactingRemainingSec: 0 },
          state.projects,
        )

        set({
          agents: state.agents.map((a) => (a.id === agentId ? finished.agent : a)),
          projects: finished.projects,
          events: pushEvent(
            state.events,
            'system',
            `${agent.name} context cleared — back to work.`,
          ),
        })
      },

      offloadAgent(agentId) {
        const state = get()
        const agent = state.agents.find((a) => a.id === agentId)
        if (!agent) return

        let nextProjects = state.projects
        if (agent.job === 'code' && agent.taskId) {
          nextProjects = updateTask(nextProjects, agent.taskId, (t) => ({
            ...t,
            assignedAgentId: null,
            status: t.storyPointsEarned > 0 ? 'in_progress' : 'open',
          }))
        }

        const nextAgents = state.agents.filter((a) => a.id !== agentId)
        const model = getModel(agent.modelId)
        set({
          agents: nextAgents,
          projects: nextProjects,
          ...syncRam({ loadedModels: state.loadedModels, agents: nextAgents, servers: state.servers }),
          events: pushEvent(
            state.events,
            'system',
            `Offloaded ${agent.name} (${model?.name ?? 'model'}).`,
          ),
        })
      },

      deployCloudAgent(modelId) {
        const state = get()
        const model = getModel(modelId)
        if (!model || model.kind !== 'cloud') return false
        if (state.cash < model.deployCost) return false

        const agent: Agent = {
          id: uid('agt'),
          name: generateAgentName(),
          modelId,
          loadedModelId: null,
          serverId: null,
          ...emptyAgentJob(),
          personality: generatePersonality(),
          contextUsed: 0,
          compactingRemainingSec: 0,
          totalTokensBurned: 0,
          uptime: 0,
        }

        set({
          cash: state.cash - model.deployCost,
          agents: [...state.agents, agent],
          stats: { ...state.stats, agentsDeployed: state.stats.agentsDeployed + 1 },
          events: pushEvent(state.events, 'system', `Deployed ${agent.name} (${model.name}) to the cloud.`),
        })
        return true
      },

      loadLocalModel(modelId, hostId, forceNewInstance = false) {
        const state = get()
        const model = getModel(modelId)
        if (!model || model.kind !== 'local') return false
        if (!state.ownedLocalModels.includes(modelId)) return false
        if (hostId === LAPTOP_HOST_ID && modelId !== 'local-1b') return false

        if (!forceNewInstance) {
          const existing = state.loadedModels.find((lm) => lm.hostId === hostId && lm.modelId === modelId)
          if (existing) {
            return get().spawnLocalAgent(existing.id)
          }
        }

        if (!canFitLoadOnHost(hostId, modelId, state.loadedModels, state.agents, state.servers)) {
          return false
        }

        const loaded: LoadedModel = {
          id: uid('load'),
          modelId,
          hostId,
        }

        const nextLoaded = [...state.loadedModels, loaded]
        const agent: Agent = {
          id: uid('agt'),
          name: generateAgentName(),
          modelId,
          loadedModelId: loaded.id,
          serverId: hostId,
          ...emptyAgentJob(),
          personality: generatePersonality(),
          contextUsed: 0,
          compactingRemainingSec: 0,
          totalTokensBurned: 0,
          uptime: 0,
        }

        const nextAgents = [...state.agents, agent]
        set({
          loadedModels: nextLoaded,
          agents: nextAgents,
          ...syncRam({ loadedModels: nextLoaded, agents: nextAgents, servers: state.servers }),
          stats: { ...state.stats, agentsDeployed: state.stats.agentsDeployed + 1 },
          events: pushEvent(
            state.events,
            'system',
            `Loaded ${model.name} on ${hostId === LAPTOP_HOST_ID ? 'laptop' : 'rack'}.`,
          ),
        })
        return true
      },

      spawnLocalAgent(loadedModelId) {
        const state = get()
        const loaded = state.loadedModels.find((lm) => lm.id === loadedModelId)
        if (!loaded) return false
        const model = getModel(loaded.modelId)
        if (!model) return false

        const agent: Agent = {
          id: uid('agt'),
          name: generateAgentName(),
          modelId: loaded.modelId,
          loadedModelId: loaded.id,
          serverId: loaded.hostId,
          ...emptyAgentJob(),
          personality: generatePersonality(),
          contextUsed: 0,
          compactingRemainingSec: 0,
          totalTokensBurned: 0,
          uptime: 0,
        }

        const nextAgents = [...state.agents, agent]
        set({
          agents: nextAgents,
          stats: { ...state.stats, agentsDeployed: state.stats.agentsDeployed + 1 },
          events: pushEvent(state.events, 'system', `Spawned worker on ${model.name}.`),
        })
        return true
      },

      unloadModel(loadedModelId) {
        const state = get()
        const loaded = state.loadedModels.find((lm) => lm.id === loadedModelId)
        if (!loaded) return false
        if (state.agents.some((a) => a.loadedModelId === loadedModelId)) return false

        const nextLoaded = state.loadedModels.filter((lm) => lm.id !== loadedModelId)
        set({
          loadedModels: nextLoaded,
          ...syncRam({ loadedModels: nextLoaded, agents: state.agents, servers: state.servers }),
          events: pushEvent(state.events, 'system', 'Unloaded model. RAM exhaled.'),
        })
        return true
      },

      buyServer(tier) {
        const state = get()
        const config = RACK_CONFIG[tier]
        const apt = APARTMENT_CONFIG[state.apartment]
        if (!config || state.servers.length >= apt.rackSlots) return false
        if (state.cash < config.cost) return false

        const server: Server = {
          id: uid('srv'),
          name: config.label,
          tier,
          onFire: false,
          fireDuration: 0,
        }

        const nextServers = [...state.servers, server]
        set({
          cash: state.cash - config.cost,
          servers: nextServers,
          ...syncRam({ loadedModels: state.loadedModels, agents: state.agents, servers: nextServers }),
          events: pushEvent(state.events, 'milestone', `Procured ${server.name}. Landlord concerned.`),
        })
        return true
      },

      sellServer(serverId) {
        const state = get()
        const server = state.servers.find((s) => s.id === serverId)
        if (!server || server.onFire) return false
        if (state.agents.some((a) => a.serverId === serverId)) return false
        if (state.loadedModels.some((lm) => lm.hostId === serverId)) return false

        const payout = RACK_REFURBISH_VALUE[server.tier] ?? 0
        const nextServers = state.servers.filter((s) => s.id !== serverId)
        set({
          cash: state.cash + payout,
          servers: nextServers,
          ...syncRam({ loadedModels: state.loadedModels, agents: state.agents, servers: nextServers }),
          events: pushEvent(
            state.events,
            'milestone',
            `Sold ${server.name} for $${payout} (50% loss). Buyer suspiciously cheerful.`,
          ),
        })
        return true
      },

      buyTokens() {
        const state = get()
        if (state.cash < TOKEN_PACK_COST) return false
        set({
          cash: state.cash - TOKEN_PACK_COST,
          tokens: Math.min(state.maxTokens, state.tokens + TOKEN_PACK_AMOUNT),
          events: pushEvent(state.events, 'token', `Bought ${TOKEN_PACK_AMOUNT} tokens.`),
        })
        return true
      },

      upgradeApartment() {
        const state = get()
        const tiers = ['cardboard', 'studio', 'loft', 'penthouse'] as const
        const idx = tiers.indexOf(state.apartment)
        if (idx < 0 || idx >= tiers.length - 1) return false
        const next = tiers[idx + 1]
        const cost = APARTMENT_CONFIG[next].upgradeCost
        if (state.cash < cost + state.apartmentLeaseRemaining * APARTMENT_CONFIG[state.apartment].rent * 0.5)
          return false

        const payout = Math.round(state.apartmentLeaseRemaining * APARTMENT_CONFIG[state.apartment].rent * 0.5)
        set({
          cash: state.cash - cost - payout,
          apartment: next,
          apartmentLeaseRemaining: RENT_INTERVAL_DAYS,
          rentDueInDays: RENT_INTERVAL_DAYS,
          events: pushEvent(
            state.events,
            'milestone',
            `Moved to ${APARTMENT_CONFIG[next].label}. Rent up. Rack slots up. Dignity unchanged.`,
          ),
        })
        return true
      },

      extinguishFire(serverId) {
        const state = get()
        const server = state.servers.find((s) => s.id === serverId)
        if (!server?.onFire || state.cash < EXTINGUISH_COST) return false
        set({
          cash: state.cash - EXTINGUISH_COST,
          servers: state.servers.map((s) =>
            s.id === serverId ? { ...s, onFire: false, fireDuration: 0 } : s,
          ),
          events: pushEvent(state.events, 'fire', `Extinguished ${server.name}. Smells like burnt ambition.`),
        })
        return true
      },

      retire() {
        const state = get()
        if (state.phase !== 'playing') return
        const netWorth = computeNetWorth({ cash: state.cash, servers: state.servers })
        if (netWorth < WIN_NET_WORTH) return
        set({
          phase: 'won',
          events: pushEvent(state.events, 'milestone', '$10M net worth. Sell the racks. Retire. You win.'),
        })
      },

      resetGame() {
        set(createInitialState())
      },
    }),
    {
      name: SAVE_KEY,
      version: 12,
      migrate: (persisted, version) => {
        const s = persisted as Partial<GameStore> & { reviewRevealedHit?: number | null }
        if (version < 6) {
          return createInitialState() as unknown as GameStore
        }
        if (s.agents) {
          s.agents = s.agents.map((a) => {
            const base = {
              ...a,
              modelId: migrateModelId(a.modelId),
              loadedModelId: a.loadedModelId ?? null,
              projectId: a.projectId ?? null,
              jobProgress: a.jobProgress ?? 0,
              jobDuration: a.jobDuration ?? 0,
              compactingRemainingSec: a.compactingRemainingSec ?? 0,
            }
            if (version < 7) {
              if (base.taskId && base.status === 'working') {
                return { ...base, job: 'code' as const, status: 'working' as const }
              }
              return { ...base, ...emptyAgentJob() }
            }
            if (version < 8 && base.job && base.taskId && !base.projectId) {
              const project = s.projects?.find((p) => p.tasks.some((t) => t.id === base.taskId))
              if (project) {
                return { ...base, projectId: project.id }
              }
            }
            if (version < 12 && base.status === 'compacted') {
              return {
                ...base,
                status: 'compacting' as const,
                compactingRemainingSec: COMPACT_DURATION_SEC,
              }
            }
            return base
          })
        }
        if (s.projects) {
          s.projects = s.projects.map((p) => {
            const requirements =
              p.requirements ??
              (p.tasks.length > 0
                ? []
                : [
                    {
                      id: uid('req'),
                      projectId: p.id,
                      title: 'Legacy scope',
                      storyPoints: p.totalStoryPoints,
                      status: 'open' as const,
                    },
                  ])
            const tasks = p.tasks.map((t) => {
              let status = t.status
              if (version < 8 && status === 'pr_ready' && (t.storyPointsEarned ?? 0) < t.storyPointsRequired) {
                status = 'in_progress'
              }
              if (version < 8 && (t as Task & { status: string }).status === 'pr_ready') {
                // keep pr_ready
              }
              return {
                ...t,
                completedByAgentId: t.completedByAgentId ?? null,
                revealedQualityHit: t.revealedQualityHit ?? null,
                hasUndiscoveredBug: t.hasUndiscoveredBug ?? false,
                bugDiscovered: t.bugDiscovered ?? false,
                isBugFix: t.isBugFix ?? false,
                sourceTaskId: t.sourceTaskId ?? null,
                isReviewComment: t.isReviewComment ?? false,
                reviewed: t.reviewed ?? false,
                testStoryPointsEarned: t.testStoryPointsEarned ?? 0,
                status,
              }
            })
            return {
              ...p,
              requirements,
              tasks,
              testPercent: p.testPercent ?? 0,
              testStoryPointsRequired: p.testStoryPointsRequired ?? 0,
              testStoryPointsCompleted: p.testStoryPointsCompleted ?? 0,
            }
          })
        }
        if (version < 11 && s.projects) {
          s.projects = s.projects.map((p) => {
            let poolRemaining = p.testStoryPointsCompleted ?? 0
            const mergedOrdered = [...p.tasks]
              .filter((t) => t.status === 'merged' && !t.isReviewComment)
              .sort((a, b) => a.storyPointsRequired - b.storyPointsRequired)

            const grants = new Map<string, number>()
            for (const task of mergedOrdered) {
              if (poolRemaining <= 0) {
                grants.set(task.id, 0)
                continue
              }
              const grant = Math.min(task.storyPointsRequired, poolRemaining)
              grants.set(task.id, grant)
              poolRemaining -= grant
            }

            const tasks = p.tasks.map((t) => ({
              ...t,
              testStoryPointsEarned: grants.get(t.id) ?? t.testStoryPointsEarned ?? 0,
            }))
            return syncTestScope({ ...p, tasks })
          })
        }
        if (version < 10 && s.projects) {
          s.projects = s.projects.map((p) => {
            const tasks = p.tasks.map((t) => {
              let status = t.status
              if (!t.isReviewComment && !t.isBugFix && status === 'done') {
                status = 'pr_ready'
              }
              return {
                ...t,
                isReviewComment: t.isReviewComment ?? false,
                reviewed: t.reviewed ?? (t.revealedQualityHit !== null && t.revealedQualityHit !== undefined),
                status,
              }
            })
            return syncTestScope({
              ...p,
              tasks,
              testPercent: p.testPercent ?? 0,
              testStoryPointsRequired: p.testStoryPointsRequired ?? 0,
              testStoryPointsCompleted: p.testStoryPointsCompleted ?? 0,
            })
          })
        }
        if (version < 9 && s.projects) {
          s.projects = s.projects.map((p) => syncTestScope({
            ...p,
            testPercent: p.testPercent ?? 0,
            testStoryPointsRequired: p.testStoryPointsRequired ?? 0,
            testStoryPointsCompleted: p.testStoryPointsCompleted ?? 0,
          }))
        }
        if (version < 7) {
          if (s.playerAction && s.playerAction.type !== 'vibe') {
            s.playerAction = null
          }
          delete s.reviewRevealedHit
        }
        if (!s.loadedModels) s.loadedModels = []
        if (s.ownedLocalModels) {
          s.ownedLocalModels = ['local-1b', 'local-2b', 'local-4b']
        }
        return s as GameStore
      },
      partialize: (state) => ({
        phase: state.phase,
        cash: state.cash,
        tokens: state.tokens,
        maxTokens: state.maxTokens,
        sanity: state.sanity,
        reputation: state.reputation,
        gameDay: state.gameDay,
        rentDueInDays: state.rentDueInDays,
        apartment: state.apartment,
        apartmentLeaseRemaining: state.apartmentLeaseRemaining,
        usedRam: state.usedRam,
        totalRam: state.totalRam,
        ownedLocalModels: state.ownedLocalModels,
        loadedModels: state.loadedModels,
        servers: state.servers,
        agents: state.agents,
        projects: state.projects,
        leads: state.leads,
        selectedTaskId: state.selectedTaskId,
        playerAction: state.playerAction,
        tutorialDone: state.tutorialDone,
        leadSpawnCooldown: state.leadSpawnCooldown,
        events: state.events,
        stats: state.stats,
      }),
    },
  ),
)

export function getNetWorth(state: Pick<GameStore, 'cash' | 'servers'>): number {
  return computeNetWorth(state)
}

export function getNextApartment(state: Pick<GameStore, 'apartment'>): string | null {
  const tiers = ['cardboard', 'studio', 'loft', 'penthouse'] as const
  const idx = tiers.indexOf(state.apartment)
  return idx < tiers.length - 1 ? tiers[idx + 1] : null
}

export function projectProgressPct(project: Project): number {
  const merged = project.tasks.filter((t) => t.status === 'merged').reduce((s, t) => s + t.storyPointsRequired, 0)
  return (merged / project.totalStoryPoints) * 100
}

export function isReadyToDeliver(project: Project): boolean {
  const synced = syncTestScope(project)
  const shippableTasks = project.tasks.filter((t) => !t.isReviewComment)
  const mergedImpl = shippableTasks.filter((t) => t.status === 'merged')
  return (
    project.status === 'active' &&
    project.requirements.every((r) => r.status === 'refined') &&
    shippableTasks.length > 0 &&
    shippableTasks.every((t) => t.status === 'merged') &&
    synced.testStoryPointsRequired > 0 &&
    mergedImpl.every(taskIsTested)
  )
}

export function modelSuccessForTask(modelId: string, taskSp = 1, contextFillPctValue = 0): number {
  const model = getModel(modelId)
  if (!model) return 0
  return effectiveSuccessRate(model.parameters, taskSp, contextFillPctValue)
}

export function projectedQualityHit(task: Task, agents: Agent[], project?: Project): number {
  const params = getTaskQualityParameters(task, agents)
  const taskCount = project ? countActiveTasks(project) : 1
  return computeQualityHit(task.storyPointsRequired, params, taskCount)
}

export {
  effectiveSuccessRate,
  computeQualityHit,
  getAgentParameters,
  reviewAccuracy,
  refactorRatePerDay,
  agentJobDurationDays,
  LAPTOP_HOST_ID,
}
