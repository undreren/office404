import { describe, expect, it } from 'vitest'
import { acceptLeadMsg, stateChanged } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithAvailableLead } from './_helpers/stateWithAvailableLead'
import { T0 } from './_helpers/testConstants'

describe('accept-lead-blocked-low-reputation', () => {
  it('matches use case invariants', () => {
    const before = stateWithAvailableLead()
    const lead = before.leads.find((l) => l.status === 'available')!
    const patched = {
      ...before,
      reputation: 0,
      leads: before.leads.map((l) =>
        l.id === lead.id ? { ...l, repRequired: 10 } : l,
      ),
    }

    const after = dispatchChain(patched, [acceptLeadMsg(T0 + 3000, lead.id)])

    expect(stateChanged(patched, after)).toBe(false)
    expect(after.projects.length).toBe(patched.projects.length)
  })
})
