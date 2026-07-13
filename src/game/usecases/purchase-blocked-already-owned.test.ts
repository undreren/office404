import { describe, expect, it } from 'vitest'
import { maxAgentSlotPurchases } from '../mechanics'
import { buyAgentSlotMsg, stateChanged } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithApartment } from './_helpers/stateWithApartment'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('purchase-blocked-already-owned', () => {
  it('matches use case invariants', () => {
    const maxPurchases = maxAgentSlotPurchases('shared_1br')
    const before = {
      ...stateWithCash(stateWithApartment(initialPlaying(), 'shared_1br'), 500),
      agentSlotPurchases: maxPurchases,
    }

    const after = dispatchChain(before, [buyAgentSlotMsg(T0 + 1000)])

    expect(stateChanged(before, after)).toBe(false)
  })
})
