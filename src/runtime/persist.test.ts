import { describe, expect, it } from 'vitest'
import { SAVE_KEY } from '../game/constants'
import { createDefaultMeta } from '../game/meta'
import { createInitialState } from '../game/simulation/gameLogic'
import {
  loadPersistedState,
  partializeSave,
  SAVE_VERSION,
  savePersistedState,
} from './persist'

describe('persist', () => {
  it('round-trips v8 save with meta', () => {
    const state = createInitialState(1000, 42)
    savePersistedState(state)
    const loaded = loadPersistedState()
    expect(loaded).not.toBeNull()
    expect(loaded!.cash).toBe(state.cash)
    expect(loaded!.meta).toEqual(state.meta)
    expect(loaded!.agentSlotPurchases).toBe(0)
    expect(loaded!.gpuTickPurchases).toBe(0)
  })

  it('migrates legacy v7 blob to prestige fields', () => {
    const legacyState = {
      phase: 'playing',
      cash: 50,
      reputation: 5,
      gameDay: 0,
      rentDueInDays: 30,
      apartment: 'cardboard',
      apartmentLeaseRemaining: 30,
      totalRam: 2,
      totalGpus: 1,
      modelTierIndex: 0,
      purchasedRamUpgrades: [],
      purchasedGpuUpgrades: [],
      purchasedFineTunes: [],
      vibingCourses: [],
      agents: [],
      projects: [],
      leads: [],
      selectedTaskId: null,
      tutorialDone: true,
      seenStoryIntro: true,
      acknowledgedTutorialStep: 3,
      seenTabIntros: [],
      leadSpawnCooldown: 4,
      events: [],
      stats: {
        projectsCompleted: 0,
        tasksMerged: 0,
        agentsDeployed: 0,
        compactionsSurvived: 0,
      },
      snapshotAt: 1000,
      rng: 42,
      nextId: 1,
    }
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: 7, state: legacyState }),
    )
    const loaded = loadPersistedState()
    expect(loaded).not.toBeNull()
    expect(loaded!.phase).toBe('playing')
    expect(loaded!.meta).toEqual(createDefaultMeta())
    expect(loaded!.mrr).toBe(0)
    expect(loaded!.agentSlotPurchases).toBeGreaterThanOrEqual(0)
    expect(loaded!.gpuTickPurchases).toBe(0)
    expect(loaded!.meta.retirementCount).toBe(0)
  })

  it('partializeSave uses current version', () => {
    const state = createInitialState(0, 1)
    const saved = partializeSave(state)
    expect(saved.version).toBe(SAVE_VERSION)
    expect(saved.meta.retirementCount).toBe(0)
  })
})
