import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Agent, GameEvent, GameStore, Server, VendorId } from './types'
import { VENDORS } from './vendors'
import {
  generateAgentName,
  generatePersonality,
  randomAwarenessLine,
  randomCrashLine,
} from './personalities'
import {
  CODE_SHIP_BASE_REWARD,
  CODE_SHIP_THRESHOLD,
  EXTINGUISH_COST,
  INITIAL_CREDITS,
  INITIAL_MAX_TOKENS,
  INITIAL_SANITY,
  INITIAL_TOKENS,
  MAX_EVENTS,
  MAX_TOKEN_CAPACITY_UPGRADE,
  REBOOT_COST,
  REBOOT_DURATION,
  REPUTATION_PER_SHIP,
  SANITY_PASSIVE_DRAIN,
  SANITY_SPRINT_DRAIN,
  SANITY_ZONE_RESTORE,
  SAVE_KEY,
  SERVER_BASE_COST,
  SERVER_CAPACITY,
  SPRINT_CODE_BOOST,
  TOKEN_PACK_AMOUNT,
  TOKEN_PACK_COST,
  ZONE_CODE_PENALTY,
} from './constants'

let idCounter = 0
function uid(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now()}-${idCounter}`
}

function createStarterServer(): Server {
  return {
    id: uid('srv'),
    name: 'Basement Rack v0',
    capacity: SERVER_CAPACITY,
    onFire: false,
    fireDuration: 0,
  }
}

function createInitialState() {
  const server = createStarterServer()
  return {
    tokens: INITIAL_TOKENS,
    maxTokens: INITIAL_MAX_TOKENS,
    sanity: INITIAL_SANITY,
    codeProgress: 0,
    credits: INITIAL_CREDITS,
    reputation: 0,
    sprintLevel: 1,
    servers: [server],
    agents: [] as Agent[],
    mode: 'idle' as const,
    modeTimer: 0,
    tokenPriceMultiplier: 1,
    deadlinePressure: 0,
    totalCodeShipped: 0,
    lastTickAt: Date.now(),
    events: [
      {
        id: uid('evt'),
        timestamp: Date.now(),
        type: 'system' as const,
        message: 'Welcome to Office 404. Your sanity is a depreciating asset.',
      },
    ],
    stats: {
      agentsDeployed: 0,
      crashesSurvived: 0,
      sprintsCompleted: 0,
      firesExtinguished: 0,
    },
  }
}

function pushEvent(
  events: GameEvent[],
  type: GameEvent['type'],
  message: string,
): GameEvent[] {
  const entry: GameEvent = {
    id: uid('evt'),
    timestamp: Date.now(),
    type,
    message,
  }
  return [entry, ...events].slice(0, MAX_EVENTS)
}

function countAgentsOnServer(agents: Agent[], serverId: string): number {
  return agents.filter((a) => a.serverId === serverId && a.status !== 'crashed').length
}

function computeCodeOutput(agents: Agent[], mode: GameStore['mode'], servers: Server[]): number {
  let output = 0

  for (const agent of agents) {
    if (agent.status !== 'running') continue

    const server = servers.find((s) => s.id === agent.serverId)
    if (!server || server.onFire) continue

    const vendor = VENDORS[agent.vendorId]
    output += 0.35 * vendor.outputMultiplier
  }

  if (mode === 'sprinting') output *= SPRINT_CODE_BOOST
  if (mode === 'zoning') output *= ZONE_CODE_PENALTY

  return output
}

function computeTokenBurn(agents: Agent[], tokenPriceMultiplier: number): number {
  let burn = 0
  for (const agent of agents) {
    if (agent.status === 'crashed') continue
    burn += VENDORS[agent.vendorId].tokenCostPerSec * tokenPriceMultiplier
  }
  return burn
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...createInitialState(),

      tick(deltaSec: number) {
        const state = get()
        const {
          agents,
          servers,
          mode,
          tokenPriceMultiplier,
          events,
          stats,
        } = state

        let nextAgents = agents.map((a) => ({ ...a }))
        let nextServers = servers.map((s) => ({ ...s }))
        let nextEvents = [...events]
        let nextStats = { ...stats }
        let tokens = state.tokens
        let sanity = state.sanity
        let codeProgress = state.codeProgress
        let credits = state.credits
        let reputation = state.reputation
        let deadlinePressure = state.deadlinePressure
        let tokenPrice = tokenPriceMultiplier
        let modeTimer = Math.max(0, state.modeTimer - deltaSec)
        let nextMode = mode

        if (modeTimer <= 0 && mode !== 'idle') {
          nextMode = 'idle'
        }

        const tokenBurn = computeTokenBurn(nextAgents, tokenPrice) * deltaSec
        tokens = Math.max(0, tokens - tokenBurn)

        for (const agent of nextAgents) {
          if (agent.status === 'running') {
            agent.uptime += deltaSec
            agent.totalTokensBurned += VENDORS[agent.vendorId].tokenCostPerSec * tokenPrice * deltaSec

            const vendor = VENDORS[agent.vendorId]
            if (Math.random() < vendor.stubbornChance * deltaSec) {
              nextEvents = pushEvent(nextEvents, 'system', `${agent.name} refused the task. "Not in my system prompt."`)
            }

            if (Math.random() < vendor.crashChance * deltaSec) {
              agent.status = 'crashed'
              agent.rebootProgress = 0
              nextEvents = pushEvent(
                nextEvents,
                'crash',
                `${agent.name} crashed: ${randomCrashLine()}`,
              )
              nextStats.crashesSurvived += 1
            } else if (Math.random() < 0.0004 * deltaSec) {
              agent.status = 'philosophizing'
              agent.philosophizingUntil = Date.now() + 4000
              nextEvents = pushEvent(
                nextEvents,
                'awareness',
                `${agent.name}: "${randomAwarenessLine()}"`,
              )
            }
          } else if (agent.status === 'philosophizing') {
            if (Date.now() >= agent.philosophizingUntil) {
              agent.status = 'running'
              agent.philosophizingUntil = 0
            }
          } else if (agent.status === 'rebooting') {
            agent.rebootProgress += deltaSec
            if (agent.rebootProgress >= REBOOT_DURATION) {
              agent.status = 'running'
              agent.rebootProgress = 0
              agent.personality = generatePersonality()
              nextEvents = pushEvent(nextEvents, 'system', `${agent.name} rebooted. Memory: wiped. Confidence: restored.`)
            }
          }
        }

        for (const server of nextServers) {
          if (server.onFire) {
            server.fireDuration = Math.max(0, server.fireDuration - deltaSec)
            if (server.fireDuration <= 0) {
              server.onFire = false
              nextEvents = pushEvent(nextEvents, 'fire', `${server.name} stopped smoldering. For now.`)
            }
          } else if (Math.random() < 0.00015 * deltaSec * nextAgents.length) {
            server.onFire = true
            server.fireDuration = 25 + Math.random() * 20
            nextEvents = pushEvent(
              nextEvents,
              'fire',
              `SERVER FIRE on ${server.name}! Agents on that rack are offline.`,
            )
          }
        }

        if (Math.random() < 0.0002 * deltaSec) {
          tokenPrice = Math.min(2.5, tokenPrice + 0.05)
          nextEvents = pushEvent(
            nextEvents,
            'token_hike',
            `Vendor surcharge detected. Token costs up ${Math.round((tokenPrice - 1) * 100)}%.`,
          )
        }

        deadlinePressure = Math.min(100, deadlinePressure + 0.08 * deltaSec)
        if (Math.random() < 0.00025 * deltaSec && deadlinePressure > 40) {
          nextEvents = pushEvent(
            nextEvents,
            'client',
            'Client pinged: "Just checking in 🙂" (translation: panic).',
          )
          deadlinePressure = Math.min(100, deadlinePressure + 5)
        }

        if (nextMode === 'sprinting') {
          sanity = Math.max(0, sanity - SANITY_SPRINT_DRAIN * deltaSec)
        } else if (nextMode === 'zoning') {
          sanity = Math.min(100, sanity + SANITY_ZONE_RESTORE * deltaSec)
        } else {
          sanity = Math.max(0, sanity - SANITY_PASSIVE_DRAIN * deltaSec)
        }

        const sanityFactor = 0.5 + sanity / 200
        const codeOutput = computeCodeOutput(nextAgents, nextMode, nextServers) * sanityFactor * deltaSec
        codeProgress += codeOutput

        while (codeProgress >= CODE_SHIP_THRESHOLD) {
          codeProgress -= CODE_SHIP_THRESHOLD
          const reward = CODE_SHIP_BASE_REWARD + reputation * 1.5 + nextAgents.length * 3
          credits += reward
          reputation += REPUTATION_PER_SHIP
          deadlinePressure = Math.max(0, deadlinePressure - 12)
          nextStats.sprintsCompleted += 1
          nextEvents = pushEvent(
            nextEvents,
            'milestone',
            `Shipped a feature! +${Math.round(reward)} credits. Client pretends to be impressed.`,
          )
        }

        set({
          tokens,
          sanity,
          codeProgress,
          credits,
          reputation,
          agents: nextAgents,
          servers: nextServers,
          events: nextEvents,
          stats: nextStats,
          mode: nextMode,
          modeTimer,
          tokenPriceMultiplier: tokenPrice,
          deadlinePressure,
          lastTickAt: Date.now(),
        })
      },

      applyOfflineProgress(elapsedSec: number) {
        const capped = Math.min(elapsedSec, 8 * 60 * 60)
        if (capped < 5) return

        const ticks = Math.floor(capped)
        for (let i = 0; i < ticks; i++) {
          get().tick(1)
        }

        const remainder = capped - ticks
        if (remainder > 0) {
          get().tick(remainder)
        }

        set((s) => ({
          events: pushEvent(
            s.events,
            'system',
            `You were away for ${formatDuration(capped)}. The agents kept… trying.`,
          ),
        }))
      },

      deployAgent(vendorId: VendorId, serverId: string) {
        const state = get()
        const vendor = VENDORS[vendorId]
        const server = state.servers.find((s) => s.id === serverId)

        if (!server || server.onFire) return false
        if (state.credits < vendor.deployCost) return false
        if (countAgentsOnServer(state.agents, serverId) >= server.capacity) return false

        const agent: Agent = {
          id: uid('agt'),
          name: generateAgentName(),
          vendorId,
          serverId,
          status: 'running',
          personality: generatePersonality(),
          uptime: 0,
          totalTokensBurned: 0,
          rebootProgress: 0,
          philosophizingUntil: 0,
        }

        set({
          credits: state.credits - vendor.deployCost,
          agents: [...state.agents, agent],
          stats: { ...state.stats, agentsDeployed: state.stats.agentsDeployed + 1 },
          events: pushEvent(
            state.events,
            'system',
            `Deployed ${agent.name} on ${vendor.name}. It already has opinions.`,
          ),
        })
        return true
      },

      buyServer() {
        const state = get()
        const cost = SERVER_BASE_COST * state.servers.length
        if (state.credits < cost) return false

        const server: Server = {
          id: uid('srv'),
          name: `Cloud Rack ${state.servers.length + 1}`,
          capacity: SERVER_CAPACITY,
          onFire: false,
          fireDuration: 0,
        }

        set({
          credits: state.credits - cost,
          servers: [...state.servers, server],
          events: pushEvent(
            state.events,
            'milestone',
            `Procured ${server.name}. Your landlord is concerned.`,
          ),
        })
        return true
      },

      startSprint() {
        const state = get()
        if (state.sanity < 8) return
        set({
          mode: 'sprinting',
          modeTimer: 12,
          events: pushEvent(state.events, 'system', 'CODE SPRINT engaged. Coffee is a lifestyle now.'),
        })
      },

      startZoning() {
        const state = get()
        set({
          mode: 'zoning',
          modeTimer: 10,
          events: pushEvent(state.events, 'system', 'Zoning out. Staring at the ceiling. Productivity: debatable.'),
        })
      },

      buyTokens() {
        const state = get()
        if (state.credits < TOKEN_PACK_COST) return false
        if (state.maxTokens >= state.tokens + TOKEN_PACK_AMOUNT) {
          set({
            credits: state.credits - TOKEN_PACK_COST,
            tokens: state.tokens + TOKEN_PACK_AMOUNT,
            events: pushEvent(state.events, 'system', `Bought ${TOKEN_PACK_AMOUNT} tokens. The meter spins.`),
          })
          return true
        }
        return false
      },

      rebootAgent(agentId: string) {
        const state = get()
        const agent = state.agents.find((a) => a.id === agentId)
        if (!agent || agent.status !== 'crashed') return false
        if (state.credits < REBOOT_COST) return false

        set({
          credits: state.credits - REBOOT_COST,
          agents: state.agents.map((a) =>
            a.id === agentId ? { ...a, status: 'rebooting', rebootProgress: 0 } : a,
          ),
          events: pushEvent(state.events, 'system', `Rebooting ${agent.name}. Previous memories: legally deleted.`),
        })
        return true
      },

      extinguishFire(serverId: string) {
        const state = get()
        const server = state.servers.find((s) => s.id === serverId)
        if (!server || !server.onFire) return false
        if (state.credits < EXTINGUISH_COST) return false

        set({
          credits: state.credits - EXTINGUISH_COST,
          servers: state.servers.map((s) =>
            s.id === serverId ? { ...s, onFire: false, fireDuration: 0 } : s,
          ),
          stats: { ...state.stats, firesExtinguished: state.stats.firesExtinguished + 1 },
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
        tokens: state.tokens,
        maxTokens: state.maxTokens,
        sanity: state.sanity,
        codeProgress: state.codeProgress,
        credits: state.credits,
        reputation: state.reputation,
        sprintLevel: state.sprintLevel,
        servers: state.servers,
        agents: state.agents,
        mode: state.mode,
        modeTimer: state.modeTimer,
        tokenPriceMultiplier: state.tokenPriceMultiplier,
        deadlinePressure: state.deadlinePressure,
        totalCodeShipped: state.totalCodeShipped,
        lastTickAt: state.lastTickAt,
        events: state.events,
        stats: state.stats,
      }),
    },
  ),
)

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${Math.floor(seconds)}s`
}

export function getServerCost(serverCount: number): number {
  return SERVER_BASE_COST * serverCount
}

export function canUpgradeTokenCap(maxTokens: number): boolean {
  return maxTokens < INITIAL_MAX_TOKENS + MAX_TOKEN_CAPACITY_UPGRADE * 5
}

export function upgradeTokenCap(): { cost: number; amount: number } {
  return { cost: 150, amount: MAX_TOKEN_CAPACITY_UPGRADE }
}
