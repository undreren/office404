import { describe, expect, it } from 'vitest'
import { LADDER_BASE_CASH } from '../prestige'
import { retireMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('prestige-retire-grants-hallucinations', () => {
  it('matches use case invariants', () => {
    const before = stateWithCash(initialPlaying(), LADDER_BASE_CASH)

    const state = dispatchChain(before, [retireMsg(T0 + 1000)])

    expect(state.phase).toBe('playing')
    expect(state.meta.retirementCount).toBe(1)
    expect(state.meta.hallucinationPoints).toBeGreaterThan(0)
    expect(state.meta.totalHallucinationsEarned).toBeGreaterThan(0)
    expect(state.cash).toBeLessThan(LADDER_BASE_CASH)
  })
})
