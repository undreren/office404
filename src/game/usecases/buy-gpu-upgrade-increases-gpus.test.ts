import { describe, expect, it } from 'vitest'
import { BASE_GPU } from '../constants'
import { buyGpuUpgradeMsg } from '../messages'
import { GPU_UPGRADES } from '../upgrades'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithApartment } from './_helpers/stateWithApartment'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('buy-gpu-upgrade-increases-gpus', () => {
  it('matches use case invariants', () => {
    const upgrade = GPU_UPGRADES.find((u) => u.id === 'marketplace-gpu')!
    const before = stateWithCash(stateWithApartment(initialPlaying(), 'shared_1br'), 200)
    const gpusBefore = before.totalGpus

    const state = dispatchChain(before, [buyGpuUpgradeMsg(T0 + 1000, 'marketplace-gpu')])

    expect(state.purchasedGpuUpgrades).toContain('marketplace-gpu')
    expect(state.totalGpus).toBe(gpusBefore + upgrade.gpus)
    expect(state.totalGpus).toBeGreaterThan(BASE_GPU)
  })
})
