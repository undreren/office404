import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Agent, GameEvent, GameStore, Lead, LoadedModel, PlayerAction, Project, Server, Task } from './types'
import { getModel, migrateModelId } from './models'
import {
  createTutorialProject,
  createProjectFromLead,
  generateLead,
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
  PLAYER_EFFECTIVE_PARAMS,
  QUALITY_REFACTOR_PER_DAY,
  QUALITY_REFACTOR_PRE_MERGE_MULT,
  RACK_CONFIG,
  RACK_REFURBISH_VALUE,
  REFINE_MIN_STORY_POINTS,
  RENT_INTERVAL_DAYS,
  SANITY_FORCED_VIBE_MULTIPLIER,
  SANITY_PASSIVE_DRAIN,
  SANITY_SPRINT_DRAIN,
  SANITY_VIBE_RESTORE,
  SAVE_KEY,
  SECONDS_PER_GAME_DAY,
  TOKEN_PACK_AMOUNT,
  TOKEN_PACK_COST,
  WIN_NET_WORTH,
} from './constants'
import {
  LAPTOP_HOST_ID,
  agentTickSpeed,
  canAgentHandleTask,
  computeQualityHit,
  computeHostUsedRam,
  computeTotalAvailableRam,
  computeTotalUsedRam,
  contextFillPct,
  effectiveSuccessRate,
  getAgentParameters,
  getHostRam,
  getTaskQualityParameters,
  playerActionDurationDays,
  ramForLoadedModel,
  tokensPerTick,
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
    selectedTaskId: tutorial.tasks[0]?.id ?? null,
    playerAction: null as PlayerAction | null,
    reviewRevealedHit: null as number | null,
    tutorialDone: false,
    leadSpawnCooldown: LEAD_SPAWN_INTERVAL_DAYS,
    events: [
      {
        id: uid('evt'),
        timestamp: Date.now(),
        type: 'system' as const,
        message: 'Day 0. $0. Load a 1B on your laptop and sprint if you must. No free lunch.',
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

function tryProgressTask(
  projects: Project[],
  taskId: string,
  completedByAgentId: string | null,
): { projects: Project[]; becameReady: boolean } {
  let becameReady = false
  const next = updateTask(projects, taskId, (t) => {
    if (t.status === 'merged' || t.status === 'pr_ready') return t
    const earned = Math.min(t.storyPointsRequired, t.storyPointsEarned + 1)
    const status = earned >= t.storyPointsRequired ? 'pr_ready' : 'in_progress'
    if (status === 'pr_ready') becameReady = true
    return {
      ...t,
      storyPointsEarned: earned,
      status,
      completedByAgentId: status === 'pr_ready' ? completedByAgentId : t.completedByAgentId,
      assignedAgentId: status === 'pr_ready' ? null : t.assignedAgentId,
    }
  })
  return { projects: next, becameReady }
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
          reviewRevealedHit,
          selectedTaskId,
        } = state

        let nextAgents = agents.map((a) => ({ ...a }))
        let nextServers = servers.map((s) => ({ ...s }))
        let nextLoadedModels = loadedModels.map((lm) => ({ ...lm }))
        let nextProjects = projects.map((p) => ({ ...p, tasks: p.tasks.map((t) => ({ ...t })) }))
        let nextLeads = leads.map((l) => ({ ...l }))
        let nextEvents = [...events]
        let nextStats = { ...stats }
        let nextPlayerAction = playerAction ? { ...playerAction } : null
        let nextReviewHit = reviewRevealedHit
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

        if (nextPlayerAction && nextPlayerAction.type !== 'vibe' && nextPlayerAction.type !== 'sprint' && nextPlayerAction.type !== 'refactor') {
          nextPlayerAction.progress += dayProgress
          if (nextPlayerAction.progress >= nextPlayerAction.duration) {
            const taskId = nextPlayerAction.taskId
            if (nextPlayerAction.type === 'review') {
              const found = findTask(nextProjects, taskId)
              if (found) {
                const params = getTaskQualityParameters(found.task, nextAgents)
                const hit = computeQualityHit(found.task.storyPointsRequired, params)
                nextReviewHit = hit
                nextEvents = pushEvent(
                  nextEvents,
                  'project',
                  `Review complete. Estimated quality hit: -${hit.toFixed(1)}. Merge or refactor.`,
                )
              }
              nextPlayerAction = null
            } else if (nextPlayerAction.type === 'refine') {
              const found = findTask(nextProjects, taskId)
              if (found && found.task.storyPointsRequired >= REFINE_MIN_STORY_POINTS && !found.task.refined) {
                const [a, b] = splitTask(found.task)
                nextProjects = nextProjects.map((p) =>
                  p.id === found.project.id
                    ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId).concat([a, b]) }
                    : p,
                )
                if (selectedTaskId === taskId) selectedTaskId = a.id
                nextEvents = pushEvent(nextEvents, 'project', `Refined "${found.task.title}" into ${a.storyPointsRequired}+${b.storyPointsRequired} SP tickets.`)
              }
              nextPlayerAction = null
            }
          }
        }

        if (nextPlayerAction?.type === 'sprint' && nextPlayerAction.taskId) {
          const found = findTask(nextProjects, nextPlayerAction.taskId)
          if (found && found.task.status !== 'merged' && found.task.status !== 'pr_ready') {
            const success = effectiveSuccessRate(
              PLAYER_EFFECTIVE_PARAMS,
              found.task.storyPointsRequired,
              0,
            )
            if (Math.random() < success) {
              const result = tryProgressTask(nextProjects, nextPlayerAction.taskId, null)
              nextProjects = result.projects
              if (result.becameReady) {
                nextPlayerAction = null
                nextEvents = pushEvent(nextEvents, 'system', 'Sprint complete — ticket is PR ready.')
              }
            }
          }
          sanity = Math.max(0, sanity - SANITY_SPRINT_DRAIN * dayProgress)
        }

        if (nextPlayerAction?.type === 'refactor' && nextPlayerAction.taskId) {
          const found = findTask(nextProjects, nextPlayerAction.taskId)
          if (found && found.project.quality < 100) {
            const bonusRate = QUALITY_REFACTOR_PER_DAY * QUALITY_REFACTOR_PRE_MERGE_MULT
            const bonus = bonusRate * dayProgress
            const newQuality = Math.min(100, found.project.quality + bonus)
            nextProjects = nextProjects.map((p) =>
              p.id === found.project.id ? { ...p, quality: newQuality } : p,
            )
            if (newQuality >= 100) {
              nextPlayerAction = null
              nextEvents = pushEvent(nextEvents, 'project', 'Quality maxed. Refactor complete.')
            }
          } else {
            nextPlayerAction = null
          }
        }

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
          if (!model || !agent.taskId) continue

          const taskRef = findTask(nextProjects, agent.taskId)
          if (!taskRef || taskRef.task.status === 'merged' || taskRef.task.status === 'pr_ready') continue

          if (model.kind === 'local') {
            const hostId = agent.serverId
            if (!hostId) continue
            if (hostId !== LAPTOP_HOST_ID) {
              const server = nextServers.find((s) => s.id === hostId)
              if (!server || server.onFire) continue
            }
          }

          if (agent.status === 'compacted') continue
          if (agent.status !== 'working') continue

          const baseSpeed = agentTickSpeed(agent, nextAgents, nextServers, gpus)
          if (baseSpeed <= 0) continue

          agent.uptime += dayProgress

          if (model.kind === 'cloud') {
            const cost = model.tokenCostPerTick * baseSpeed * deltaSec
            if (tokens <= 0) continue
            tokenBurn += cost
            agent.totalTokensBurned += cost
          }

          const fillPct = contextFillPct(agent.contextUsed, model.contextSize)
          const tok = tokensPerTick(model.contextSize) * baseSpeed * deltaSec
          agent.contextUsed += tok

          if (agent.contextUsed >= model.contextSize * 1000) {
            agent.status = 'compacted'
            agent.contextUsed = model.contextSize * 1000
            nextStats.compactionsSurvived += 1
            nextEvents = pushEvent(
              nextEvents,
              'crash',
              `${agent.name} compacted! Context overflow. Tap restart.`,
            )
            continue
          }

          const success = effectiveSuccessRate(
            model.parameters,
            taskRef.task.storyPointsRequired,
            fillPct,
          )
          if (Math.random() < success * baseSpeed) {
            const result = tryProgressTask(nextProjects, agent.taskId, agent.id)
            nextProjects = result.projects
            if (result.becameReady) {
              agent.taskId = null
              agent.status = 'idle'
              agent.contextUsed = 0
            }
          }
        }

        tokens = Math.max(0, tokens - tokenBurn)

        for (const agent of nextAgents) {
          if (agent.status !== 'compacted' || !agent.taskId) continue
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

        for (const project of nextProjects) {
          if (project.status !== 'active') continue
          if (!project.tasks.every((t) => t.status === 'merged')) continue

          project.status = 'completed'
          cash += project.payment
          const onTime = project.lateCount === 0
          reputation += onTime ? ON_TIME_REP_BONUS : 1
          nextStats.projectsCompleted += 1
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
        }

        nextProjects = nextProjects.filter((p) => p.status === 'active')

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
          reviewRevealedHit: nextReviewHit,
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

      startSprint() {
        const state = get()
        if (state.playerAction?.forced) return
        if (state.playerAction?.type === 'sprint') {
          set({ playerAction: null })
          return
        }
        if (!state.selectedTaskId || state.sanity < 5) return
        const found = findTask(state.projects, state.selectedTaskId)
        if (!found || found.task.status === 'merged' || found.task.status === 'pr_ready') return
        set({
          playerAction: {
            type: 'sprint',
            taskId: state.selectedTaskId,
            progress: 0,
            duration: 9999,
          },
          events: pushEvent(state.events, 'system', `Sprinting on "${found.task.title}". Caveman mode engaged.`),
        })
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

      startRefine(taskId) {
        const state = get()
        if (state.playerAction?.forced) return
        const found = findTask(state.projects, taskId)
        if (!found || found.task.storyPointsRequired < REFINE_MIN_STORY_POINTS || found.task.refined) return
        const duration = playerActionDurationDays(found.task.storyPointsRequired, found.project.quality)
        set({
          playerAction: { type: 'refine', taskId, progress: 0, duration },
          events: pushEvent(state.events, 'project', `Refining "${found.task.title}"… ticket mitosis incoming.`),
        })
      },

      startRefactor(taskId) {
        const state = get()
        if (state.playerAction?.forced) return
        if (state.playerAction?.type === 'refactor' && state.playerAction.taskId === taskId) {
          set({ playerAction: null })
          return
        }
        const found = findTask(state.projects, taskId)
        if (!found || found.project.quality >= 100) return
        set({
          playerAction: { type: 'refactor', taskId, progress: 0, duration: 9999 },
          events: pushEvent(state.events, 'project', `Refactoring "${found.task.title}"… quality over progress.`),
        })
      },

      startReview(taskId) {
        const state = get()
        if (state.playerAction?.forced) return
        const found = findTask(state.projects, taskId)
        if (!found || found.task.status !== 'pr_ready') return
        const duration = playerActionDurationDays(found.task.storyPointsRequired, found.project.quality)
        set({
          playerAction: { type: 'review', taskId, progress: 0, duration },
          reviewRevealedHit: null,
          events: pushEvent(state.events, 'project', `Reviewing PR for "${found.task.title}"…`),
        })
      },

      justMerge(taskId) {
        const state = get()
        if (state.playerAction?.forced) return
        const found = findTask(state.projects, taskId)
        if (!found || found.task.status !== 'pr_ready') return

        const params = getTaskQualityParameters(found.task, state.agents)
        const hit = computeQualityHit(found.task.storyPointsRequired, params)
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
            `Just Merged "${found.task.title}". Quality -${hit.toFixed(1)}.`,
          ),
        })
      },

      completeMerge(taskId) {
        const state = get()
        const found = findTask(state.projects, taskId)
        if (!found || found.task.status !== 'pr_ready') return

        const params = getTaskQualityParameters(found.task, state.agents)
        const hit = state.reviewRevealedHit ?? computeQualityHit(found.task.storyPointsRequired, params)
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
          reviewRevealedHit: null,
          playerAction: null,
          stats: { ...state.stats, tasksMerged: state.stats.tasksMerged + 1 },
          events: pushEvent(
            state.events,
            'project',
            `Merged "${found.task.title}" after review. Quality -${hit.toFixed(1)}.`,
          ),
        })
      },

      cancelPlayerAction() {
        const state = get()
        if (state.playerAction?.forced) return
        set({ playerAction: null, reviewRevealedHit: null })
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

      assignAgent(agentId, taskId) {
        const state = get()
        const agent = state.agents.find((a) => a.id === agentId)
        const found = findTask(state.projects, taskId)
        if (!agent || !found || agent.taskId) return
        if (found.task.status === 'merged' || found.task.status === 'pr_ready') return
        if (found.task.assignedAgentId) return

        const model = getModel(agent.modelId)
        if (!model) return
        if (!canAgentHandleTask(model.parameters, found.task.storyPointsRequired)) return

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

        const nextAgents = state.agents.map((a) =>
          a.id === agentId
            ? { ...a, taskId, status: 'working' as const, contextUsed: 0 }
            : a,
        )

        set({
          agents: nextAgents,
          projects: updateTask(state.projects, taskId, (t) => ({
            ...t,
            assignedAgentId: agentId,
            status: 'in_progress',
          })),
          ...syncRam({ loadedModels: state.loadedModels, agents: nextAgents, servers: state.servers }),
          events: pushEvent(state.events, 'system', `${agent.name} assigned to "${found.task.title}".`),
        })
      },

      unassignAgent(agentId) {
        const state = get()
        const agent = state.agents.find((a) => a.id === agentId)
        if (!agent?.taskId) return

        const taskId = agent.taskId
        const nextAgents = state.agents.map((a) =>
          a.id === agentId
            ? { ...a, taskId: null, status: 'idle' as const, contextUsed: 0 }
            : a,
        )

        set({
          agents: nextAgents,
          projects: updateTask(state.projects, taskId, (t) => ({
            ...t,
            assignedAgentId: null,
            status: t.storyPointsEarned > 0 ? 'in_progress' : 'open',
          })),
          ...syncRam({ loadedModels: state.loadedModels, agents: nextAgents, servers: state.servers }),
          events: pushEvent(
            state.events,
            'system',
            `${agent.name} yanked off task. Context wiped.`,
          ),
        })
      },

      restartAgent(agentId) {
        const state = get()
        const agent = state.agents.find((a) => a.id === agentId)
        if (!agent || agent.status !== 'compacted') return

        set({
          agents: state.agents.map((a) =>
            a.id === agentId
              ? { ...a, status: 'working' as const, contextUsed: 0 }
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
        if (agent.taskId) {
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
          taskId: null,
          status: 'idle',
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
          taskId: null,
          status: 'idle',
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
          taskId: null,
          status: 'idle',
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
      version: 6,
      migrate: (persisted, version) => {
        const s = persisted as Partial<GameStore>
        if (version < 6) {
          return createInitialState() as unknown as GameStore
        }
        if (s.agents) {
          s.agents = s.agents.map((a) => ({
            ...a,
            modelId: migrateModelId(a.modelId),
            loadedModelId: a.loadedModelId ?? null,
          }))
        }
        if (s.projects) {
          s.projects = s.projects.map((p) => ({
            ...p,
            tasks: p.tasks.map((t) => ({
              ...t,
              completedByAgentId: t.completedByAgentId ?? null,
            })),
          }))
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
        reviewRevealedHit: state.reviewRevealedHit,
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

export function modelSuccessForTask(modelId: string, taskSp = 1, contextFillPctValue = 0): number {
  const model = getModel(modelId)
  if (!model) return 0
  return effectiveSuccessRate(model.parameters, taskSp, contextFillPctValue)
}

export function playerSuccessForTask(taskSp: number): number {
  return effectiveSuccessRate(PLAYER_EFFECTIVE_PARAMS, taskSp, 0)
}

export function projectedQualityHit(
  task: Task,
  agents: Agent[],
): number {
  const params = getTaskQualityParameters(task, agents)
  return computeQualityHit(task.storyPointsRequired, params)
}

export function playerProjectedQualityHit(taskSp: number): number {
  return computeQualityHit(taskSp, PLAYER_EFFECTIVE_PARAMS)
}

export {
  effectiveSuccessRate,
  computeQualityHit,
  canAgentHandleTask,
  getAgentParameters,
  LAPTOP_HOST_ID,
}
