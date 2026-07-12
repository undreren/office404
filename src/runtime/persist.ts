import { SAVE_KEY } from '../game/constants'
import type { GameState } from '../game/types'

const SAVE_VERSION = 4

export type PersistedState = Omit<GameState, never>

export function partializeState(state: GameState): PersistedState {
  return {
    phase: state.phase,
    cash: state.cash,
    reputation: state.reputation,
    gameDay: state.gameDay,
    rentDueInDays: state.rentDueInDays,
    apartment: state.apartment,
    apartmentLeaseRemaining: state.apartmentLeaseRemaining,
    totalRam: state.totalRam,
    totalGpus: state.totalGpus,
    modelTierIndex: state.modelTierIndex,
    purchasedRamUpgrades: state.purchasedRamUpgrades,
    purchasedGpuUpgrades: state.purchasedGpuUpgrades,
    purchasedFineTunes: state.purchasedFineTunes,
    vibingCourses: state.vibingCourses,
    agents: state.agents,
    projects: state.projects,
    leads: state.leads,
    selectedTaskId: state.selectedTaskId,
    tutorialDone: state.tutorialDone,
    leadSpawnCooldown: state.leadSpawnCooldown,
    events: state.events,
    stats: state.stats,
    snapshotAt: state.snapshotAt,
    rng: state.rng,
    nextId: state.nextId,
  }
}

export function loadPersistedState(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: GameState; version?: number }
    if (!parsed.state) return null
    if (parsed.version !== undefined && parsed.version < SAVE_VERSION) return null
    return parsed.state
  } catch {
    return null
  }
}

export function savePersistedState(state: GameState): void {
  const payload = { state: partializeState(state), version: SAVE_VERSION }
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload))
}

export function injectPersistedState(state: GameState): void {
  savePersistedState(state)
}
