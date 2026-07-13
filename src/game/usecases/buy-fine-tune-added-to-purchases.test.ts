import { describe, expect, it } from 'vitest'
import { buyFineTuneMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('buy-fine-tune-added-to-purchases', () => {
  it('matches use case invariants', () => {
    const before = stateWithCash(initialPlaying(), 90)

    const state = dispatchChain(before, [buyFineTuneMsg(T0 + 1000, 'tune-0-code')])

    expect(state.purchasedFineTunes).toContain('tune-0-code')
    expect(state.fineTuneTiers['tune-0-code']).toBe(1)
    expect(state.cash).toBe(0)
  })
})
