import { describe, expect, it } from 'vitest'
import { maxAgentSlotPurchases } from '../mechanics'
import { buyAgentSlotMsg, stateChanged } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('purchase-blocked-wrong-apartment', () => {
  it('matches use case invariants', () => {
    const before = {
      ...stateWithCash(initialPlaying(), 500),
      agentSlotPurchases: maxAgentSlotPurchases('cardboard'),
    }

    const after = dispatchChain(before, [buyAgentSlotMsg(T0 + 1000)])

    expect(stateChanged(before, after)).toBe(false)
  })
})
