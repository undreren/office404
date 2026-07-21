import type { GameState } from '../game/types'
import { describe, expect, it } from 'vitest'
import { SAVE_KEY } from '../game/constants'
import { createDefaultMeta } from '../game/meta'
import { createInitialState } from '../game/simulation/gameLogic'
import {
  decodeSaveImport,
  encodeSaveExport,
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

  it('migrates purchased fine-tunes to tier 1', () => {
    const legacy = createInitialState(0, 1)
    legacy.purchasedFineTunes = ['tune-0-code']
    delete (legacy as Partial<GameState>).fineTuneTiers
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: 10, meta: createDefaultMeta(), state: legacy }),
    )
    const loaded = loadPersistedState()
    expect(loaded?.fineTuneTiers['tune-0-code']).toBe(1)
  })

  it('partializeSave uses current version', () => {
    const state = createInitialState(0, 1)
    const saved = partializeSave(state)
    expect(saved.version).toBe(SAVE_VERSION)
    expect(saved.meta.retirementCount).toBe(0)
  })

  it('does not persist incident log events across save round-trip', () => {
    const state = createInitialState(1000, 42)
    state.events = [
      {
        id: 'evt-1',
        timestamp: 1000,
        type: 'system',
        message: 'Day zero. The cardboard box has Wi-Fi.',
      },
    ]
    const saved = partializeSave(state)
    expect(saved.state).not.toHaveProperty('events')

    const code = encodeSaveExport(state)
    expect(code.startsWith('o404:v')).toBe(true)
    const loaded = decodeSaveImport(code)
    expect(loaded).not.toBeNull()
    expect(loaded!.cash).toBe(state.cash)
    expect(loaded!.events).toEqual([])
    expect(loaded!.meta).toEqual(state.meta)
  })

  it('rejects invalid import codes', () => {
    expect(decodeSaveImport('')).toBeNull()
    expect(decodeSaveImport('not-valid-base64!!!')).toBeNull()
  })
})
