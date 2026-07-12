import { describe, expect, it } from 'vitest'
import { buyRamUpgradeMsg, stateChanged } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithApartment } from './_helpers/stateWithApartment'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('purchase-blocked-already-owned', () => {
  it('matches use case invariants', () => {
    const before = {
      ...stateWithCash(stateWithApartment(initialPlaying(), 'shared_1br'), 200),
      purchasedRamUpgrades: ['neighbors-ddr4'],
    }

    const after = dispatchChain(before, [buyRamUpgradeMsg(T0 + 1000, 'neighbors-ddr4')])

    expect(stateChanged(before, after)).toBe(false)
  })
})
