import { describe, expect, it } from 'vitest'
import { getTotalRam } from '../mechanics'
import { upgradeModelTierMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('upgrade-model-tier-despawns-agents', () => {
  it('matches use case invariants', () => {
    const before = {
      ...stateWithCash(initialPlaying(), 200),
      purchasedRamUpgrades: ['neighbors-ddr4'],
      totalRam: getTotalRam({ purchasedRamUpgrades: ['neighbors-ddr4'] }),
    }
    expect(before.agents.length).toBeGreaterThan(0)

    const state = dispatchChain(before, [upgradeModelTierMsg(T0 + 1000)])

    expect(state.modelTierIndex).toBe(before.modelTierIndex + 1)
    expect(state.agents).toHaveLength(0)
  })
})
