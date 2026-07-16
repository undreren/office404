import { describe, expect, it } from 'vitest'
import { createInitialState } from '../game/simulation/gameLogic'
import { loadPersistedState, savePersistedState } from './persist'

describe('product-backlog-hydrate', () => {
  it('seeds a queued backlog item when in_house is unlocked but backlog is empty', () => {
    const state = createInitialState(1000, 42)
    state.meta = {
      ...state.meta,
      hallucinationLevels: { in_house: 1 },
    }
    state.productBacklog = []

    savePersistedState(state)
    const loaded = loadPersistedState()

    expect(loaded).not.toBeNull()
    expect(loaded!.productBacklog.some((item) => item.status === 'queued')).toBe(true)
  })
})
