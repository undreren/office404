import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Agent, GameEvent, GameStore, Lead, PlayerAction, Project, Server, Task } from './types'
import { MODELS } from './models'
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
  GPU_SPEED_PER_LEVEL,
  GPU_UPGRADE_COST,
  INITIAL_CASH,
  INITIAL_GPU,
  INITIAL_MAX_TOKENS,
  INITIAL_RAM,
  INITIAL_REPUTATION,
  INITIAL_SANITY,
  INITIAL_TOKENS,
  LATE_FEE_PERCENT,
  LATE_REP_PENALTY_BASE,
  LEAD_SPAWN_INTERVAL_DAYS,
  LOCAL_TICK_HARD_CAP,
  LOSE_REPUTATION,
  MAX_EVENTS,
  MAX_LEADS,
  ON_TIME_REP_BONUS,
  PLAYER_ACTION_REFACTOR_DAYS,
  PLAYER_ACTION_REFINE_DAYS,
  PLAYER_ACTION_REVIEW_DAYS,
  QUALITY_BASE_HIT,
  QUALITY_JUST_MERGE_MULT,
  QUALITY_REFACTOR_BONUS,
  QUALITY_REFACTOR_PRE_MERGE_MULT,
  QUALITY_REVIEW_REDUCTION,
  QUALITY_UNREFINED_MULT,
  RACK_CONFIG,
  RACK_REFURBISH_VALUE,
  REFINE_MIN_COMPLEXITY,
  RENT_INTERVAL_DAYS,
  SANITY_FORCED_VIBE_MULTIPLIER,
  SANITY_PASSIVE_DRAIN,
  SANITY_SPRINT_DRAIN,
  SANITY_VIBE_RESTORE,
  SAVE_KEY,
  SECONDS_PER_GAME_DAY,
  SPRINT_SP_PER_DAY,
  TOKEN_PACK_AMOUNT,
  TOKEN_PACK_COST,
  WIN_NET_WORTH,
} from './constants'

let idCounter = 0
function uid(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now()}-${idCounter}`
}

function pushEvent(events: GameEvent[], type: GameEvent['type'], message: string): GameEvent[] {
  const entry: GameEvent = { id: uid('evt'), timestamp: Date.now(), type, message }
  return [entry, ...events].slice(0, MAX_EVENTS)
}

function createStarterServer(): Server {
  return {
    id: uid('srv'),
    name: 'Basement Mark Mini',
    tier: 'mark_mini',
    capacity: RACK_CONFIG.mark_mini.capacity,
    gpuLevel: 1,
    onFire: false,
    fireDuration: 0,
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
    gpuUnits: INITIAL_GPU,
    totalRam: INITIAL_RAM,
    usedRam: 0,
    ownedLocalModels: ['local-7b', 'local-13b', 'local-34b'] as string[],
    servers: [createStarterServer()],
    agents: [] as Agent[],
    projects: [tutorial],
    leads: [] as Lead[],
    selectedTaskId: tutorial.tasks[0]?.id ?? null,
    playerAction: null as PlayerAction | null,
    reviewRevealedHit: null as number | null,
    tutorialDone: false,
    leadSpawnCooldown: LEAD_SPAWN_INTERVAL_DAYS,
    lastTickAt: Date.now(),
    events: [
      {
        id: uid('evt'),
        timestamp: Date.now(),
        type: 'system' as const,
        message: 'Day 0. No local model. Petty cash. A prayer. Good luck, freelancer.',
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

function computeUsedRam(agents: Agent[]): number {
  return agents.reduce((sum, a) => sum + (MODELS[a.modelId]?.ramCost ?? 0), 0)
}

function computeNetWorth(state: Pick<GameStore, 'cash' | 'servers'>): number {
  const rackValue = state.servers.reduce((sum, s) => sum + (RACK_REFURBISH_VALUE[s.tier] ?? 0), 0)
  return state.cash + rackValue
}

function qualityDifficultyMult(quality: number): number {
  return 1 + (100 - quality) / 50
}

function computeQualityHit(task: Task, project: Project, justMerge: boolean, reviewed: boolean): number {
  let hit = QUALITY_BASE_HIT * qualityDifficultyMult(project.quality)
  if (!task.refined) hit *= QUALITY_UNREFINED_MULT
  if (justMerge) hit *= QUALITY_JUST_MERGE_MULT
  if (reviewed) hit *= QUALITY_REVIEW_REDUCTION
  return Math.max(1, hit + Math.random() * 3)
}

function agentTickSpeed(agent: Agent, gpuUnits: number): number {
  const model = MODELS[agent.modelId]
  if (!model) return 0
  if (model.kind === 'cloud') return 1
  const gpuBoost = 1 + (gpuUnits - 1) * GPU_SPEED_PER_LEVEL
  return Math.min(LOCAL_TICK_HARD_CAP, model.localTickCap * gpuBoost)
}

function countAgentsOnServer(agents: Agent[], serverId: string): number {
  return agents.filter((a) => a.serverId === serverId).length
}

function allTasksMerged(project: Project): boolean {
  return project.tasks.every((t) => t.status === 'merged')
}

function projectProgress(project: Project): number {
  const merged = project.tasks.filter((t) => t.status === 'merged').reduce((s, t) => s + t.storyPointsRequired, 0)
  return merged / project.totalStoryPoints
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
          projects,
          leads,
          events,
          stats,
          playerAction,
          leadSpawnCooldown,
          reviewRevealedHit,
          selectedTaskId,
          gpuUnits,
        } = state

        let nextAgents = agents.map((a) => ({ ...a }))
        let nextServers = servers.map((s) => ({ ...s }))
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

        // Rent
        if (rentDueInDays <= 0) {
          const rent = APARTMENT_CONFIG[state.apartment].rent
          cash -= rent
          rentDueInDays += RENT_INTERVAL_DAYS
          nextEvents = pushEvent(nextEvents, 'system', `Rent due: -$${rent}. Landlord sends a heart emoji.`)
        }

        // Lead spawning
        if (leadSpawnCooldown <= 0 && nextLeads.filter((l) => l.status === 'available').length < MAX_LEADS) {
          nextLeads = [generateLead(reputation), ...nextLeads]
          leadSpawnCooldown = LEAD_SPAWN_INTERVAL_DAYS
          nextEvents = pushEvent(nextEvents, 'lead', 'New client lead appeared. They want it yesterday.')
        }

        // Expire leads
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

        // Project deadlines
        for (const project of nextProjects) {
          if (project.status !== 'active') continue
          project.daysRemaining -= dayProgress

          if (project.daysRemaining <= 0 && !allTasksMerged(project)) {
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

        // Forced vibe at low sanity
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

        const playerBusy = nextPlayerAction !== null
        const vibeMult = nextPlayerAction?.forced ? SANITY_FORCED_VIBE_MULTIPLIER : 1

        // Player action progress
        if (nextPlayerAction && nextPlayerAction.type !== 'vibe') {
          nextPlayerAction.progress += dayProgress
          const done = nextPlayerAction.progress >= nextPlayerAction.duration

          if (done) {
            const taskId = nextPlayerAction.taskId
            if (nextPlayerAction.type === 'sprint') {
              // sprint is continuous, handled below
            } else if (nextPlayerAction.type === 'review') {
              const found = findTask(nextProjects, taskId)
              if (found) {
                const hit = computeQualityHit(found.task, found.project, false, true)
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
              if (found && found.task.complexity >= REFINE_MIN_COMPLEXITY) {
                const [a, b] = splitTask(found.task)
                nextProjects = nextProjects.map((p) =>
                  p.id === found.project.id
                    ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId).concat([a, b]) }
                    : p,
                )
                if (selectedTaskId === taskId) selectedTaskId = a.id
                nextEvents = pushEvent(nextEvents, 'project', `Refined "${found.task.title}" into two smaller tickets.`)
              }
              nextPlayerAction = null
            } else if (nextPlayerAction.type === 'refactor') {
              const found = findTask(nextProjects, taskId)
              if (found) {
                const bonus = QUALITY_REFACTOR_BONUS * QUALITY_REFACTOR_PRE_MERGE_MULT
                nextProjects = nextProjects.map((p) =>
                  p.id === found.project.id
                    ? { ...p, quality: Math.min(100, p.quality + bonus) }
                    : p,
                )
                nextEvents = pushEvent(nextEvents, 'project', `Refactored code. Project quality +${bonus.toFixed(0)}.`)
              }
              nextPlayerAction = null
            }
          }
        }

        // Sprint SP gain
        if (nextPlayerAction?.type === 'sprint' && nextPlayerAction.taskId) {
          const spGain = SPRINT_SP_PER_DAY * dayProgress
          let becameReady = false
          nextProjects = updateTask(nextProjects, nextPlayerAction.taskId, (t) => {
            if (t.status === 'merged' || t.status === 'pr_ready') return t
            const earned = Math.min(t.storyPointsRequired, t.storyPointsEarned + spGain)
            const status = earned >= t.storyPointsRequired ? 'pr_ready' : 'in_progress'
            if (status === 'pr_ready') becameReady = true
            return { ...t, storyPointsEarned: earned, status }
          })
          if (becameReady) {
            const found = findTask(nextProjects, nextPlayerAction.taskId)
            if (found?.task.assignedAgentId) {
              const aid = found.task.assignedAgentId
              nextAgents = nextAgents.map((a) =>
                a.id === aid ? { ...a, taskId: null, status: 'idle' as const, contextUsed: 0 } : a,
              )
              nextProjects = updateTask(nextProjects, nextPlayerAction.taskId, (t) => ({
                ...t,
                assignedAgentId: null,
              }))
            }
          }
          sanity = Math.max(0, sanity - SANITY_SPRINT_DRAIN * dayProgress)
        }

        // Vibe sanity restore
        if (nextPlayerAction?.type === 'vibe') {
          sanity = Math.min(100, sanity + SANITY_VIBE_RESTORE * dayProgress * vibeMult)
          if (!forcedVibe && sanity >= 95) {
            nextPlayerAction = null
          }
          if (forcedVibe && sanity >= 100) {
            nextPlayerAction = null
            nextEvents = pushEvent(nextEvents, 'system', 'Sanity restored. Back to the suffering.')
          }
        } else if (!playerBusy) {
          sanity = Math.max(0, sanity - SANITY_PASSIVE_DRAIN * dayProgress)
        }

        // Agent ticks
        let tokenBurn = 0
        for (const agent of nextAgents) {
          const model = MODELS[agent.modelId]
          if (!model || !agent.taskId) continue

          const taskRef = findTask(nextProjects, agent.taskId)
          if (!taskRef || taskRef.task.status === 'merged' || taskRef.task.status === 'pr_ready') continue

          const server = nextServers.find((s) => s.id === agent.serverId)
          if (!server || server.onFire) continue

          if (agent.status === 'compacted') continue

          if (agent.status === 'warming') {
            agent.warmupRemaining -= dayProgress
            if (agent.warmupRemaining <= 0) {
              agent.status = 'working'
              agent.warmupRemaining = 0
            }
            continue
          }

          if (agent.status !== 'working') continue

          const tickSpeed = agentTickSpeed(agent, gpuUnits) * dayProgress
          agent.uptime += dayProgress

          if (model.kind === 'cloud') {
            const cost = model.tokenCostPerTick * tickSpeed
            if (tokens <= 0) continue
            tokenBurn += cost
            agent.totalTokensBurned += cost
          }

          agent.contextUsed += model.contextFillRate * tickSpeed

          if (agent.contextUsed >= model.contextSize) {
            agent.status = 'compacted'
            agent.contextUsed = model.contextSize
            nextStats.compactionsSurvived += 1
            nextEvents = pushEvent(
              nextEvents,
              'crash',
              `${agent.name} compacted! Context overflow. Tap restart.`,
            )
            continue
          }

          if (Math.random() < model.successChance * tickSpeed) {
            nextProjects = updateTask(nextProjects, agent.taskId, (t) => {
              const earned = Math.min(t.storyPointsRequired, t.storyPointsEarned + 1 * tickSpeed * 2)
              const status = earned >= t.storyPointsRequired ? 'pr_ready' : 'in_progress'
              return { ...t, storyPointsEarned: earned, status }
            })
            const updated = findTask(nextProjects, agent.taskId)
            if (updated?.task.status === 'pr_ready') {
              agent.taskId = null
              agent.status = 'idle'
              agent.contextUsed = 0
            }
          }
        }

        tokens = Math.max(0, tokens - tokenBurn)

        // Compaction backslide
        for (const agent of nextAgents) {
          if (agent.status !== 'compacted' || !agent.taskId) continue
          nextProjects = updateTask(nextProjects, agent.taskId, (t) => ({
            ...t,
            storyPointsEarned: Math.max(0, t.storyPointsEarned - 0.5 * dayProgress),
          }))
        }

        // Server fires
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

        // Complete projects
        for (const project of nextProjects) {
          if (project.status !== 'active') continue
          if (!allTasksMerged(project)) continue

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
          projects: nextProjects,
          leads: nextLeads,
          events: nextEvents,
          stats: nextStats,
          playerAction: nextPlayerAction,
          reviewRevealedHit: nextReviewHit,
          leadSpawnCooldown,
          selectedTaskId,
          phase,
          usedRam: computeUsedRam(nextAgents),
          tutorialDone: state.tutorialDone || !nextProjects.some((p) => p.isTutorial),
          lastTickAt: Date.now(),
        })
      },

      applyOfflineProgress(elapsedSec: number) {
        const capped = Math.min(elapsedSec, 8 * 60 * 60)
        if (capped < 5) return
        const ticks = Math.floor(capped)
        for (let i = 0; i < ticks; i++) get().tick(1)
        const remainder = capped - ticks
        if (remainder > 0) get().tick(remainder)
        set((s) => ({
          events: pushEvent(s.events, 'system', `Away for ${Math.floor(capped / 60)}m. Agents kept… something.`),
        }))
      },

      selectTask(taskId) {
        set({ selectedTaskId: taskId })
      },

      startSprint() {
        const state = get()
        if (state.playerAction || !state.selectedTaskId || state.sanity < 5) return
        const found = findTask(state.projects, state.selectedTaskId)
        if (!found || found.task.status === 'merged' || found.task.status === 'pr_ready') return
        set({
          playerAction: {
            type: 'sprint',
            taskId: state.selectedTaskId,
            progress: 0,
            duration: 9999,
          },
          reviewRevealedHit: null,
          events: pushEvent(state.events, 'system', `Sprinting on "${found.task.title}". Caveman mode engaged.`),
        })
      },

      startVibe() {
        const state = get()
        if (state.playerAction) return
        set({
          playerAction: { type: 'vibe', taskId: '', progress: 0, duration: 9999 },
          events: pushEvent(state.events, 'system', 'Smoke break. Agents keep ticking. You keep existing.'),
        })
      },

      startRefine(taskId) {
        const state = get()
        if (state.playerAction) return
        const found = findTask(state.projects, taskId)
        if (!found || found.task.complexity < REFINE_MIN_COMPLEXITY || found.task.refined) return
        set({
          playerAction: {
            type: 'refine',
            taskId,
            progress: 0,
            duration: PLAYER_ACTION_REFINE_DAYS,
          },
          events: pushEvent(state.events, 'project', `Refining "${found.task.title}"… ticket mitosis incoming.`),
        })
      },

      startRefactor(taskId) {
        const state = get()
        if (state.playerAction) return
        const found = findTask(state.projects, taskId)
        if (!found) return
        set({
          playerAction: {
            type: 'refactor',
            taskId,
            progress: 0,
            duration: PLAYER_ACTION_REFACTOR_DAYS,
          },
          events: pushEvent(state.events, 'project', `Refactoring "${found.task.title}"… quality over progress.`),
        })
      },

      startReview(taskId) {
        const state = get()
        if (state.playerAction) return
        const found = findTask(state.projects, taskId)
        if (!found || found.task.status !== 'pr_ready') return
        set({
          playerAction: {
            type: 'review',
            taskId,
            progress: 0,
            duration: PLAYER_ACTION_REVIEW_DAYS,
          },
          reviewRevealedHit: null,
          events: pushEvent(state.events, 'project', `Reviewing PR for "${found.task.title}"…`),
        })
      },

      justMerge(taskId) {
        const state = get()
        if (state.playerAction) return
        const found = findTask(state.projects, taskId)
        if (!found || found.task.status !== 'pr_ready') return

        const hit = computeQualityHit(found.task, found.project, true, false)
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
            `Just Merged "${found.task.title}". Quality -${hit.toFixed(1)}. YOLO.`,
          ),
        })
      },

      completeMerge(taskId) {
        const state = get()
        const found = findTask(state.projects, taskId)
        if (!found || found.task.status !== 'pr_ready') return

        const hit = state.reviewRevealedHit ?? computeQualityHit(found.task, found.project, false, true)
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
        if (state.projects.length >= 4) return

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

        const warmup = Math.ceil(MODELS[agent.modelId].contextSize * 0.15)
        set({
          agents: state.agents.map((a) =>
            a.id === agentId
              ? { ...a, taskId, status: 'warming' as const, warmupRemaining: warmup, contextUsed: 0 }
              : a,
          ),
          projects: updateTask(state.projects, taskId, (t) => ({
            ...t,
            assignedAgentId: agentId,
            status: 'in_progress',
          })),
          events: pushEvent(state.events, 'system', `${agent.name} assigned to "${found.task.title}".`),
        })
      },

      unassignAgent(agentId) {
        const state = get()
        const agent = state.agents.find((a) => a.id === agentId)
        if (!agent?.taskId) return

        const taskId = agent.taskId
        set({
          agents: state.agents.map((a) =>
            a.id === agentId
              ? { ...a, taskId: null, status: 'idle' as const, contextUsed: 0, warmupRemaining: 0 }
              : a,
          ),
          projects: updateTask(state.projects, taskId, (t) => ({
            ...t,
            assignedAgentId: null,
            status: t.storyPointsEarned > 0 ? 'in_progress' : 'open',
          })),
          events: pushEvent(
            state.events,
            'system',
            `${agent.name} yanked off task. Context wiped. Review comments are your problem now.`,
          ),
        })
      },

      restartAgent(agentId) {
        const state = get()
        const agent = state.agents.find((a) => a.id === agentId)
        if (!agent || agent.status !== 'compacted') return

        const warmup = Math.ceil(MODELS[agent.modelId].contextSize * 0.2)
        set({
          agents: state.agents.map((a) =>
            a.id === agentId
              ? { ...a, status: 'warming' as const, contextUsed: 0, warmupRemaining: warmup }
              : a,
          ),
          events: pushEvent(state.events, 'system', `${agent.name} restarted. Context rebuilding…`),
        })
      },

      deployCloudAgent(modelId, serverId) {
        const state = get()
        const model = MODELS[modelId]
        const server = state.servers.find((s) => s.id === serverId)
        if (!model || model.kind !== 'cloud' || !server || server.onFire) return false
        if (state.cash < model.deployCost) return false
        if (countAgentsOnServer(state.agents, serverId) >= server.capacity) return false

        const agent: Agent = {
          id: uid('agt'),
          name: generateAgentName(),
          modelId,
          serverId,
          taskId: null,
          status: 'idle',
          personality: generatePersonality(),
          contextUsed: 0,
          warmupRemaining: 0,
          totalTokensBurned: 0,
          uptime: 0,
        }

        set({
          cash: state.cash - model.deployCost,
          agents: [...state.agents, agent],
          stats: { ...state.stats, agentsDeployed: state.stats.agentsDeployed + 1 },
          events: pushEvent(state.events, 'system', `Deployed ${agent.name} (${model.name}). Token meter weeps.`),
        })
        return true
      },

      installLocalAgent(modelId, serverId) {
        const state = get()
        const model = MODELS[modelId]
        const server = state.servers.find((s) => s.id === serverId)
        if (!model || model.kind !== 'local' || !server || server.onFire) return false
        if (!state.ownedLocalModels.includes(modelId)) return false
        if (state.usedRam + model.ramCost > state.totalRam) return false
        if (countAgentsOnServer(state.agents, serverId) >= server.capacity) return false

        const agent: Agent = {
          id: uid('agt'),
          name: generateAgentName(),
          modelId,
          serverId,
          taskId: null,
          status: 'idle',
          personality: generatePersonality(),
          contextUsed: 0,
          warmupRemaining: 0,
          totalTokensBurned: 0,
          uptime: 0,
        }

        set({
          agents: [...state.agents, agent],
          usedRam: computeUsedRam([...state.agents, agent]),
          stats: { ...state.stats, agentsDeployed: state.stats.agentsDeployed + 1 },
          events: pushEvent(state.events, 'system', `Installed ${agent.name} (${model.name}). Free. Depressing.`),
        })
        return true
      },

      buyLocalModel(modelId) {
        const state = get()
        const model = MODELS[modelId]
        if (!model || model.kind !== 'local') return false
        if (state.ownedLocalModels.includes(modelId)) return false
        if (model.purchaseCost > 0 && state.cash < model.purchaseCost) return false

        set({
          cash: state.cash - model.purchaseCost,
          ownedLocalModels: [...state.ownedLocalModels, modelId],
          events: pushEvent(state.events, 'milestone', `Acquired ${model.name}. Shelf ware unlocked.`),
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
          capacity: config.capacity,
          gpuLevel: 1,
          onFire: false,
          fireDuration: 0,
        }

        set({
          cash: state.cash - config.cost,
          servers: [...state.servers, server],
          events: pushEvent(state.events, 'milestone', `Procured ${server.name}. Landlord concerned.`),
        })
        return true
      },

      upgradeGpu() {
        const state = get()
        if (state.cash < GPU_UPGRADE_COST) return false
        set({
          cash: state.cash - GPU_UPGRADE_COST,
          gpuUnits: state.gpuUnits + 1,
          events: pushEvent(state.events, 'milestone', `GPU upgraded. Local ticks slightly less embarrassing.`),
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
          totalRam: INITIAL_RAM + APARTMENT_CONFIG[next].ramBonus,
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

      resetGame() {
        set(createInitialState())
      },
    }),
    {
      name: SAVE_KEY,
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
        gpuUnits: state.gpuUnits,
        totalRam: state.totalRam,
        usedRam: state.usedRam,
        ownedLocalModels: state.ownedLocalModels,
        servers: state.servers,
        agents: state.agents,
        projects: state.projects,
        leads: state.leads,
        selectedTaskId: state.selectedTaskId,
        playerAction: state.playerAction,
        reviewRevealedHit: state.reviewRevealedHit,
        tutorialDone: state.tutorialDone,
        leadSpawnCooldown: state.leadSpawnCooldown,
        lastTickAt: state.lastTickAt,
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
  return projectProgress(project) * 100
}
