import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Agent, GameEvent, GameStore, Lead, LoadedModel, PlayerAction, Project, Server, Task } from './types'
import { getModel, migrateModelId } from './models'
import {
  createTutorialProject,
  createProjectFromLead,
  generateLead,
  countActiveTasks,
  pickRefineTarget,
  pickCodingTask as pickCodingTaskFromProject,
  requirementToTask,
  splitTask,
} from './projects'
import { generateAgentName, generatePersonality } from './personalities'
import {
  APARTMENT_CONFIG,
  EXPIRED_LEAD_REP_PENALTY,
  EXTINGUISH_COST,
  FORCED_VIBE_THRESHOLD,
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
  SANITY_FORCED_VIBE_MULTIPLIER,
  SANITY_PASSIVE_DRAIN,
  SANITY_VIBE_RESTORE,
  SAVE_KEY,
  SECONDS_PER_GAME_DAY,
  TOKEN_PACK_AMOUNT,
  TOKEN_PACK_COST,
  WIN_NET_WORTH,
} from './constants'
import {
  LAPTOP_HOST_ID,
  agentJobDurationDays,
  agentTickSpeed,
  computeQualityHit,
  computeRevealedQualityHit,
  computeHostUsedRam,
  computeTotalAvailableRam,
  computeTotalUsedRam,
  effectiveSuccessRate,
  fillAgentContext,
  formatStoryPoints,
  getAgentParameters,
  getHostRam,
  getTaskQualityParameters,
  improveReviewEstimate,
  jobStatusFor,
  ramForLoadedModel,
  refactorRatePerDay,
  refineJobDurationDays,
  refineSuccessRate,
  reviewAccuracy,
  storyPointIncrement,
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
  return { ...agent, ...emptyAgentJob(), contextUsed: 0 }
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

function pickCodingTask(project: Project, agentId: string): Task | null {
  return pickCodingTaskFromProject(project, agentId)
}

function tryProgressTask(
  projects: Project[],
  taskId: string,
  completedByAgentId: string | null,
): { projects: Project[]; becameDone: boolean } {
  let becameDone = false
  const next = updateTask(projects, taskId, (t) => {
    if (t.status === 'merged' || t.status === 'pr_ready' || t.status === 'done') return t
    const increment = storyPointIncrement(t.storyPointsRequired, t.storyPointsEarned)
    const earned = Math.min(t.storyPointsRequired, t.storyPointsEarned + increment)
    const status = earned >= t.storyPointsRequired ? 'done' : 'in_progress'
    if (status === 'done') becameDone = true
    return {
      ...t,
      storyPointsEarned: earned,
      status,
      completedByAgentId: status === 'done' ? completedByAgentId : t.completedByAgentId,
      assignedAgentId: status === 'done' ? null : t.assignedAgentId,
    }
  })
  return { projects: next, becameDone }
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
        const state = get()
        if (state.phase !== 'playing') return

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
        } = state

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
        let phase: GameStore['phase'] = state.phase

        gameDay += dayProgress
        rentDueInDays -= dayProgress
        apartmentLeaseRemaining -= dayProgress
        leadSpawnCooldown -= dayProgress

        if (rentDueInDays <= 0) {
          const rent = APARTMENT_CONFIG[state.apartment].rent
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

        const forcedVibe = sanity <= FORCED_VIBE_THRESHOLD
        if (forcedVibe && (!nextPlayerAction || nextPlayerAction.type !== 'vibe')) {
          nextPlayerAction = {
            type: 'vibe',
            taskId: '',
            progress: 0,
            duration: 999,
            forced: true,
          }
          nextEvents = pushEvent(nextEvents, 'system', 'Sanity critical. Forced smoke break at half speed.')
        }

        const vibeMult = nextPlayerAction?.forced ? SANITY_FORCED_VIBE_MULTIPLIER : 1

        if (nextPlayerAction?.type === 'vibe') {
          sanity = Math.min(100, sanity + SANITY_VIBE_RESTORE * dayProgress * vibeMult)
          if (!forcedVibe && sanity >= 95) nextPlayerAction = null
          if (forcedVibe && sanity >= 100) {
            nextPlayerAction = null
            nextEvents = pushEvent(nextEvents, 'system', 'Sanity restored. Back to the suffering.')
          }
        } else if (!nextPlayerAction) {
          sanity = Math.max(0, sanity - SANITY_PASSIVE_DRAIN * dayProgress)
        }

        let tokenBurn = 0
        const gpus = rackGpus()
        for (const agent of nextAgents) {
          const model = getModel(agent.modelId)
          if (!model || !agent.job) continue
          if (agent.status === 'compacted' || agent.status === 'crashed') continue

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
            agent.status = 'compacted'
            agent.contextUsed = model.contextSize * 1000
            nextStats.compactionsSurvived += 1
            nextEvents = pushEvent(
              nextEvents,
              'crash',
              `${agent.name} compacted! Context overflow. Tap restart.`,
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
              taskRef.task.status === 'done' ||
              taskRef.task.status === 'merged' ||
              taskRef.task.status === 'pr_ready'
            ) {
              const nextTask = pickCodingTask(project, agent.id)
              if (!nextTask) continue

              agent.taskId = nextTask.id
              nextProjects = updateTask(nextProjects, nextTask.id, (t) => ({
                ...t,
                assignedAgentId: agent.id,
                status: t.status === 'open' ? 'in_progress' : t.status,
              }))
              taskRef = { project, task: nextTask }
            }

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
              if (result.becameDone) {
                agent.taskId = null
                nextEvents = pushEvent(
                  nextEvents,
                  'project',
                  `${agent.name} finished coding "${taskRef.task.title}". Waiting for a PR.`,
                )
              }
            }
          } else if (agent.job === 'review' && agent.projectId) {
            const project = nextProjects.find((p) => p.id === agent.projectId)
            if (!project || project.status !== 'active') {
              Object.assign(agent, clearAgentJob(agent))
              continue
            }

            const prTasks = project.tasks.filter((t) => t.status === 'pr_ready')
            if (prTasks.length === 0) continue

            let task = agent.taskId ? prTasks.find((t) => t.id === agent.taskId) : undefined
            if (!task) {
              task = prTasks.find((t) => t.revealedQualityHit === null) ?? prTasks[0]
              agent.taskId = task.id
              agent.jobProgress = 0
              agent.jobDuration = agentJobDurationDays(
                task.storyPointsRequired,
                project.quality,
                model.parameters,
              )
            }

            fillAgentContext(agent, model, baseSpeed, deltaSec)
            if (agent.contextUsed >= model.contextSize * 1000) {
              overflow()
              continue
            }

            agent.jobProgress += dayProgress * baseSpeed
            if (agent.jobProgress >= agent.jobDuration) {
              const taskCount = countActiveTasks(project)
              const authorParams = getTaskQualityParameters(task, nextAgents)
              const trueHit = computeQualityHit(task.storyPointsRequired, authorParams, taskCount)
              const revealed =
                task.revealedQualityHit === null
                  ? computeRevealedQualityHit(trueHit, model.parameters, task.storyPointsRequired)
                  : improveReviewEstimate(
                      task.revealedQualityHit,
                      trueHit,
                      model.parameters,
                      task.storyPointsRequired,
                    )

              nextProjects = updateTask(nextProjects, task.id, (t) => ({
                ...t,
                revealedQualityHit: revealed,
              }))
              agent.jobProgress = 0
              agent.taskId = null

              nextEvents = pushEvent(
                nextEvents,
                'project',
                `${agent.name} reviewed "${task.title}". Est. quality hit: -${revealed.toFixed(1)}.`,
              )
            }
          } else if (agent.job === 'refine' && agent.projectId) {
            const project = nextProjects.find((p) => p.id === agent.projectId)
            if (!project || project.status !== 'active') {
              Object.assign(agent, clearAgentJob(agent))
              continue
            }

            const target = pickRefineTarget(project)
            if (!target) continue

            const targetId = target.kind === 'requirement' ? target.requirement.id : target.task.id
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
            }

            fillAgentContext(agent, model, baseSpeed, deltaSec)
            if (agent.contextUsed >= model.contextSize * 1000) {
              overflow()
              continue
            }

            agent.jobProgress += dayProgress * baseSpeed
            if (agent.jobProgress >= agent.jobDuration) {
              const success = refineSuccessRate(model.parameters, targetSp)
              if (Math.random() < success) {
                if (target.kind === 'requirement') {
                  const task = requirementToTask(target.requirement)
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
                  nextAgents = nextAgents.map((ag) => {
                    if (ag.taskId === target.task.id) {
                      return { ...ag, taskId: null }
                    }
                    return ag
                  })
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
              } else {
                agent.jobProgress = 0
                agent.taskId = null
                const label =
                  target.kind === 'requirement' ? target.requirement.title : target.task.title
                nextEvents = pushEvent(
                  nextEvents,
                  'project',
                  `${agent.name} botched refining "${label}". Scope survived. Barely.`,
                )
              }
            }
          } else if (agent.job === 'refactor' && agent.projectId) {
            const project = nextProjects.find((p) => p.id === agent.projectId)
            if (!project || project.status !== 'active') {
              Object.assign(agent, clearAgentJob(agent))
              continue
            }

            const doneTasks = project.tasks.filter((t) => t.status === 'done')
            if (doneTasks.length === 0) continue

            let task = agent.taskId ? doneTasks.find((t) => t.id === agent.taskId) : undefined
            if (!task) {
              task = doneTasks[0]
              agent.taskId = task.id
              agent.jobProgress = 0
              agent.jobDuration = agentJobDurationDays(
                task.storyPointsRequired,
                project.quality,
                model.parameters,
              )
            }

            fillAgentContext(agent, model, baseSpeed, deltaSec)
            if (agent.contextUsed >= model.contextSize * 1000) {
              overflow()
              continue
            }

            agent.jobProgress += dayProgress * baseSpeed
            if (agent.jobProgress >= agent.jobDuration) {
              nextProjects = updateTask(nextProjects, task.id, (t) => ({
                ...t,
                status: 'pr_ready',
              }))
              agent.jobProgress = 0
              agent.taskId = null
              nextEvents = pushEvent(
                nextEvents,
                'project',
                `${agent.name} opened PR for "${task.title}".`,
              )
            }
          }
        }

        tokens = Math.max(0, tokens - tokenBurn)

        for (const agent of nextAgents) {
          if (agent.status !== 'compacted' || agent.job !== 'code' || !agent.taskId) continue
          nextProjects = updateTask(nextProjects, agent.taskId, (t) => ({
            ...t,
            storyPointsEarned: Math.max(0, t.storyPointsEarned - 1 * dayProgress),
          }))
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
          tutorialDone: state.tutorialDone || !nextProjects.some((p) => p.isTutorial),
        })
      },

      selectTask(taskId) {
        set({ selectedTaskId: taskId })
      },

      startVibe() {
        const state = get()
        if (state.playerAction?.forced) return
        if (state.playerAction?.type === 'vibe' && !state.playerAction.forced) {
          set({ playerAction: null })
          return
        }
        set({
          playerAction: { type: 'vibe', taskId: '', progress: 0, duration: 9999 },
          events: pushEvent(state.events, 'system', 'Smoke break. Agents keep ticking. You keep existing.'),
        })
      },

      mergePr(taskId) {
        const state = get()
        if (state.playerAction?.forced) return
        const found = findTask(state.projects, taskId)
        if (!found || found.task.status !== 'pr_ready' || found.task.revealedQualityHit === null) return

        const params = getTaskQualityParameters(found.task, state.agents)
        const taskCount = countActiveTasks(found.project)
        const hit = computeQualityHit(found.task.storyPointsRequired, params, taskCount)
        const nextProjects = state.projects.map((p) =>
          p.id === found.project.id
            ? {
                ...p,
                quality: Math.max(0, p.quality - hit),
                tasks: p.tasks.map((t) =>
                  t.id === taskId ? { ...t, status: 'merged' as const, pendingQualityHit: hit } : t,
                ),
              }
            : p,
        )

        set({
          projects: nextProjects,
          stats: { ...state.stats, tasksMerged: state.stats.tasksMerged + 1 },
          events: pushEvent(
            state.events,
            'project',
            `Merged "${found.task.title}". Quality -${hit.toFixed(1)} (review guessed -${found.task.revealedQualityHit.toFixed(1)}).`,
          ),
        })
      },

      justMergePr(taskId) {
        const state = get()
        if (state.playerAction?.forced) return
        const found = findTask(state.projects, taskId)
        if (!found || found.task.status !== 'pr_ready') return

        const params = getTaskQualityParameters(found.task, state.agents)
        const taskCount = countActiveTasks(found.project)
        const hit = computeQualityHit(found.task.storyPointsRequired, params, taskCount)
        const nextProjects = state.projects.map((p) =>
          p.id === found.project.id
            ? {
                ...p,
                quality: Math.max(0, p.quality - hit),
                tasks: p.tasks.map((t) =>
                  t.id === taskId ? { ...t, status: 'merged' as const, pendingQualityHit: hit } : t,
                ),
              }
            : p,
        )

        set({
          projects: nextProjects,
          stats: { ...state.stats, tasksMerged: state.stats.tasksMerged + 1 },
          events: pushEvent(
            state.events,
            'project',
            `Just Merged "${found.task.title}" without review. Quality -${hit.toFixed(1)}.`,
          ),
        })
      },

      cancelPlayerAction() {
        const state = get()
        if (state.playerAction?.forced) return
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
        const state = get()
        const project = state.projects.find((p) => p.id === projectId)
        if (!project || project.status !== 'active') return
        if (!project.tasks.every((t) => t.status === 'merged')) return

        const cash = state.cash + project.payment
        const onTime = project.lateCount === 0
        const reputation = state.reputation + (onTime ? ON_TIME_REP_BONUS : 1)
        const nextStats = { ...state.stats, projectsCompleted: state.stats.projectsCompleted + 1 }
        const nextProjects = state.projects.filter((p) => p.id !== projectId)

        let nextEvents = state.events
        if (project.isTutorial && !state.tutorialDone) {
          nextEvents = pushEvent(
            nextEvents,
            'milestone',
            `Tutorial complete! +$${project.payment}. Buy a Mark Mini. You've been deluded into hope.`,
          )
        } else {
          nextEvents = pushEvent(
            nextEvents,
            'milestone',
            `Shipped ${project.clientName}! +$${project.payment}${onTime ? ' (on time!)' : ' (late, but done)'}.`,
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
        const netWorth = computeNetWorth({ cash, servers: state.servers })
        if (netWorth >= WIN_NET_WORTH) {
          phase = 'won'
          nextEvents = pushEvent(nextEvents, 'milestone', '$10M net worth. Sell the racks. Retire. You win.')
        } else if (reputation <= LOSE_REPUTATION && nextProjects.length === 0) {
          phase = 'lost'
          nextEvents = pushEvent(nextEvents, 'system', 'No reputation. No clients. Cardboard box acquired. Game over.')
        }

        set({
          cash,
          reputation,
          projects: nextProjects,
          stats: nextStats,
          events: nextEvents,
          playerAction: nextPlayerAction,
          selectedTaskId,
          phase,
          tutorialDone: state.tutorialDone || !nextProjects.some((p) => p.isTutorial),
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

        const codingTask = job === 'code' ? pickCodingTask(project, agentId) : null

        const nextAgents = state.agents.map((a) =>
          a.id === agentId
            ? {
                ...a,
                job,
                projectId,
                taskId: codingTask?.id ?? null,
                jobProgress: 0,
                jobDuration: 0,
                status:
                  job === 'code'
                    ? ('working' as const)
                    : job === 'review'
                      ? ('reviewing' as const)
                      : job === 'refine'
                        ? ('refining' as const)
                        : ('refactoring' as const),
                contextUsed: 0,
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
                : 'opening PRs'

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
        if (!agent || agent.status !== 'compacted') return

        set({
          agents: state.agents.map((a) =>
            a.id === agentId
              ? { ...a, status: jobStatusFor(a.job), contextUsed: 0 }
              : a,
          ),
          events: pushEvent(state.events, 'system', `${agent.name} restarted. Context cleared — back to work.`),
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
        } else if (agent.job === 'review' && agent.taskId) {
          nextProjects = updateTask(nextProjects, agent.taskId, (t) => ({
            ...t,
            revealedQualityHit: null,
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
      version: 8,
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
                status,
              }
            })
            return { ...p, requirements, tasks }
          })
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
  return (
    project.status === 'active' &&
    project.requirements.every((r) => r.status === 'refined') &&
    project.tasks.length > 0 &&
    project.tasks.every((t) => t.status === 'merged')
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
  refineSuccessRate,
  refactorRatePerDay,
  agentJobDurationDays,
  LAPTOP_HOST_ID,
}
