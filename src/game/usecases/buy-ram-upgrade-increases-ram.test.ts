import { describe, expect, it } from 'vitest'
import { BASE_RAM_GB } from '../constants'
import { buyRamUpgradeMsg } from '../messages'
import { RAM_UPGRADES } from '../upgrades'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithApartment } from './_helpers/stateWithApartment'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('buy-ram-upgrade-increases-ram', () => {
  it('matches use case invariants', () => {
    const upgrade = RAM_UPGRADES.find((u) => u.id === 'neighbors-ddr4')!
    const before = stateWithCash(stateWithApartment(initialPlaying(), 'shared_1br'), 200)
    const ramBefore = before.totalRam

    const state = dispatchChain(before, [buyRamUpgradeMsg(T0 + 1000, 'neighbors-ddr4')])

    expect(state.purchasedRamUpgrades).toContain('neighbors-ddr4')
    expect(state.totalRam).toBe(ramBefore + upgrade.ramGb)
    expect(state.totalRam).toBeGreaterThan(BASE_RAM_GB)
  })
})
