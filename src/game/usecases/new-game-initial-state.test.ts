import { describe, expect, it } from 'vitest'
import { newGame } from '../messages'
import { createInitialState } from '../simulation/gameLogic'
import { dispatchChain } from './_helpers/dispatchChain'

const SEED = 42
const T0 = 1_000_000

describe('new-game-initial-state', () => {
  it('matches use case invariants', () => {
    const state = dispatchChain(createInitialState(0, SEED), [newGame(T0, SEED)])

    expect(state.phase).toBe('playing')
    expect(state.projects).toHaveLength(1)
    expect(state.projects[0]!.isTutorial).toBe(true)
    expect(state.agents).toHaveLength(1)
    expect(state.agents[0]!.job).toBe('refine')
    expect(state.agents[0]!.projectId).toBe(state.projects[0]!.id)
    expect(state.cash).toBe(0)
    expect(state.reputation).toBe(5)
    expect(state.snapshotAt).toBe(T0)
    expect(state.rng).toBeTypeOf('number')
  })
})
