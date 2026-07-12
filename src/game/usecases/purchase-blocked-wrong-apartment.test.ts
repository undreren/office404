import { describe, expect, it } from 'vitest'
import { buyRamUpgradeMsg, stateChanged } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('purchase-blocked-wrong-apartment', () => {
  it('matches use case invariants', () => {
    const before = stateWithCash(initialPlaying(), 200)

    const after = dispatchChain(before, [buyRamUpgradeMsg(T0 + 1000, 'neighbors-ddr4')])

    expect(stateChanged(before, after)).toBe(false)
  })
})
