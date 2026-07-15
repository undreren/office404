import { describe, expect, it } from 'vitest'
import { BASE_RAM_GB, RAM_PER_UPGRADE_GB } from '../constants'
import { ramSlotCost, totalRamGb } from '../mechanics'
import { buyAgentSlotMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithApartment } from './_helpers/stateWithApartment'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('buy-agent-slot', () => {
  it('matches use case invariants', () => {
    const before = stateWithCash(stateWithApartment(initialPlaying(), 'shared_1br'), 200)
    const ramBefore = totalRamGb(before)
    const cost = ramSlotCost(before.agentSlotPurchases)

    const state = dispatchChain(before, [buyAgentSlotMsg(T0 + 1000)])

    expect(state.agentSlotPurchases).toBe(before.agentSlotPurchases + 1)
    expect(totalRamGb(state)).toBe(ramBefore + RAM_PER_UPGRADE_GB)
    expect(state.cash).toBe(200 - cost)
    expect(totalRamGb(state)).toBeGreaterThan(BASE_RAM_GB)
  })
})
