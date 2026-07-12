import { SAVE_KEY } from '../game/constants'
import { repairStaleCodingAssignments } from '../game/projects'
import type { GameState } from '../game/types'

const SAVE_VERSION = 6

export type PersistedState = Omit<GameState, never>

function normalizeLoadedState(state: GameState): GameState {
  return {
    ...state,
    projects: repairStaleCodingAssignments(state.projects, state.agents),
  }
}

function migrateState(state: GameState, fromVersion: number): GameState {
  let next = state
  if (fromVersion < 5) {
    next = {
      ...next,
      acknowledgedTutorialStep: next.acknowledgedTutorialStep ?? -1,
      seenTabIntros: next.seenTabIntros ?? [],
    }
  }
  if (fromVersion < 6) {
    next = {
      ...next,
      seenStoryIntro: next.seenStoryIntro ?? true,
    }
  }
  return next
}

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
    seenStoryIntro: state.seenStoryIntro,
    acknowledgedTutorialStep: state.acknowledgedTutorialStep,
    seenTabIntros: state.seenTabIntros,
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
    const version = parsed.version ?? 4
    if (version > SAVE_VERSION) return null
    if (version < SAVE_VERSION) {
      return normalizeLoadedState(migrateState(parsed.state, version))
    }
    return normalizeLoadedState(parsed.state)
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
