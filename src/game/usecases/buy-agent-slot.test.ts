import { describe, expect, it } from 'vitest'
import { BASE_AGENT_SLOTS } from '../constants'
import { buyAgentSlotMsg } from '../messages'
import { ramSlotCost, totalAgentSlots } from '../mechanics'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithApartment } from './_helpers/stateWithApartment'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('buy-agent-slot', () => {
  it('matches use case invariants', () => {
    const before = stateWithCash(stateWithApartment(initialPlaying(), 'shared_1br'), 200)
    const slotsBefore = totalAgentSlots(before)
    const cost = ramSlotCost(before.agentSlotPurchases)

    const state = dispatchChain(before, [buyAgentSlotMsg(T0 + 1000)])

    expect(state.agentSlotPurchases).toBe(before.agentSlotPurchases + 1)
    expect(totalAgentSlots(state)).toBe(slotsBefore + 1)
    expect(state.cash).toBe(200 - cost)
    expect(totalAgentSlots(state)).toBeGreaterThan(BASE_AGENT_SLOTS)
  })
})
