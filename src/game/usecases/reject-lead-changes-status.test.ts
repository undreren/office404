import { describe, expect, it } from 'vitest'
import { rejectLeadMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithAvailableLead } from './_helpers/stateWithAvailableLead'
import { T0 } from './_helpers/testConstants'

describe('reject-lead-changes-status', () => {
  it('matches use case invariants', () => {
    const before = stateWithAvailableLead()
    const lead = before.leads.find((l) => l.status === 'available')!
    const projectCount = before.projects.length

    const state = dispatchChain(before, [rejectLeadMsg(T0 + 3000, lead.id)])

    expect(state.leads.find((l) => l.id === lead.id)?.status).toBe('rejected')
    expect(state.projects.length).toBe(projectCount)
  })
})
