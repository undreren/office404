import { describe, expect, it } from 'vitest'
import { SECONDS_PER_GAME_DAY } from '../constants'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('game-over-no-rep-no-projects', () => {
  it('matches use case invariants', () => {
    const before = {
      ...initialPlaying(),
      reputation: 0,
      projects: [],
      agents: [],
    }

    const state = dispatchChain(before, [timeElapsed(T0 + 1000, SECONDS_PER_GAME_DAY)])

    expect(state.phase).toBe('lost')
  })
})
