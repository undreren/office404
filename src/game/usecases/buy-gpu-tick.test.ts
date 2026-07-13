import { describe, expect, it } from 'vitest'
import { BASE_GPU_TICKS } from '../constants'
import { buyGpuTickMsg } from '../messages'
import { gpuTickCost, totalGpuTicks } from '../mechanics'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithApartment } from './_helpers/stateWithApartment'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('buy-gpu-tick', () => {
  it('matches use case invariants', () => {
    const before = stateWithCash(stateWithApartment(initialPlaying(), 'shared_1br'), 200)
    const ticksBefore = totalGpuTicks(before)
    const cost = gpuTickCost(before.gpuTickPurchases)

    const state = dispatchChain(before, [buyGpuTickMsg(T0 + 1000)])

    expect(state.gpuTickPurchases).toBe(before.gpuTickPurchases + 1)
    expect(totalGpuTicks(state)).toBe(ticksBefore + 1)
    expect(state.cash).toBe(200 - cost)
    expect(totalGpuTicks(state)).toBeGreaterThan(BASE_GPU_TICKS)
  })
})
