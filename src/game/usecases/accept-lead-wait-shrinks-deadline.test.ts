import { describe, expect, it } from 'vitest'
import { acceptLeadMsg } from '../messages'
import { advanceGameDays } from './_helpers/advanceGameDays'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithAvailableLead } from './_helpers/stateWithAvailableLead'
import { T0 } from './_helpers/testConstants'

describe('accept-lead-wait-shrinks-deadline', () => {
  it('matches use case invariants', () => {
    let state = stateWithAvailableLead()
    const lead = state.leads.find((l) => l.status === 'available')!
    const originalDuration = lead.durationDays

    state = advanceGameDays(state, 2, T0 + 5000)
    state = dispatchChain(state, [acceptLeadMsg(T0 + 6000, lead.id)])

    const project = state.projects.find((p) => p.clientName === lead.clientName)!
    expect(project.durationDays).toBeLessThan(originalDuration)
    expect(project.daysRemaining).toBe(project.durationDays)
  })
})
