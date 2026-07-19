import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAVE_KEY } from '../game/constants'
import { createInitialState } from '../game/simulation/gameLogic'
import { loadPersistedState } from './persist'
import { flushPersistSave, resetPersistSaveScheduler, trackPersistSave } from './saveScheduler'

describe('saveScheduler', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPersistSaveScheduler()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetPersistSaveScheduler()
  })

  it('debounces routine saves', () => {
    const state = createInitialState(1000, 1)
    trackPersistSave(state)

    expect(loadPersistedState()).toBeNull()
    vi.advanceTimersByTime(500)
    expect(loadPersistedState()?.cash).toBe(state.cash)
  })

  it('flushPersistSave writes immediately with a fresh snapshotAt', () => {
    const state = createInitialState(1000, 1)
    trackPersistSave(state)

    flushPersistSave(state, 9999)

    expect(loadPersistedState()?.snapshotAt).toBe(9999)
    vi.advanceTimersByTime(500)
    expect(loadPersistedState()?.snapshotAt).toBe(9999)
  })

  it('flush cancels a pending debounced save and persists the latest state', () => {
    const base = createInitialState(1000, 1)
    const upgraded = { ...base, cash: 99_999 }

    trackPersistSave(base)
    flushPersistSave(upgraded, 5000)
    vi.advanceTimersByTime(500)

    expect(loadPersistedState()?.cash).toBe(99_999)
    expect(localStorage.getItem(SAVE_KEY)).toContain('99999')
  })
})
