import { describe, expect, it } from 'vitest'
import { fineTuneCost } from '../models'
import { buyFineTuneMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('fine-tune-tiered-cost', () => {
  it('charges exponentially per level', () => {
    expect(fineTuneCost(0)).toBe(90)
    expect(fineTuneCost(1)).toBe(162)
    expect(fineTuneCost(2)).toBe(292)
    expect(fineTuneCost(3)).toBe(525)
  })

  it('tracks tier upgrades and deducts escalating cash', () => {
    const before = stateWithCash(initialPlaying(), fineTuneCost(0) + fineTuneCost(1))

    const state = dispatchChain(before, [
      buyFineTuneMsg(T0 + 1000, 'tune-0-code'),
      buyFineTuneMsg(T0 + 2000, 'tune-0-code'),
    ])

    expect(state.fineTuneTiers['tune-0-code']).toBe(2)
    expect(state.purchasedFineTunes).toContain('tune-0-code')
    expect(state.cash).toBe(0)
  })
})
