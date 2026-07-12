import { describe, expect, it } from 'vitest'
import { INITIAL_REPUTATION } from '../constants'
import { resetGameMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { advanceGameDays } from './_helpers/advanceGameDays'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { SEED, T0 } from './_helpers/testConstants'

describe('reset-game-clears-state', () => {
  it('matches use case invariants', () => {
    let state = initialPlaying()
    state = advanceGameDays(stateWithCash(state, 500), 10, T0 + 5000)

    state = dispatchChain(state, [resetGameMsg(T0 + 10_000, SEED)])

    expect(state.phase).toBe('playing')
    expect(state.projects).toHaveLength(1)
    expect(state.projects[0]!.isTutorial).toBe(true)
    expect(state.agents).toHaveLength(1)
    expect(state.agents[0]!.job).toBe('refine')
    expect(state.cash).toBe(0)
    expect(state.reputation).toBe(INITIAL_REPUTATION)
  })
})
