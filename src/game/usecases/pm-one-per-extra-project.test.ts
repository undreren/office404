import { describe, expect, it } from 'vitest'
import {
  acceptLeadMsg,
  buyAgentSlotMsg,
  buyVibingCourseMsg,
  toggleSpecialistRoleMsg,
} from '../messages'
import { countAssignedPmAgents, maxAssignablePmAgents } from '../mechanics'
import { maxClientProjectSlots } from '../prestige'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithAvailableLead } from './_helpers/stateWithAvailableLead'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

describe('pm-one-per-extra-project', () => {
  it('requires one assigned PM per extra client project beyond the first', () => {
    const base = stateWithCash(stateWithAvailableLead(), 5000)
    const withSlots = dispatchChain(base, [
      buyAgentSlotMsg(T0 + 400),
      buyAgentSlotMsg(T0 + 500),
      buyVibingCourseMsg(T0 + 1000, 'project_manager'),
    ])
    expect(maxAssignablePmAgents(withSlots)).toBe(1)
    expect(maxClientProjectSlots(withSlots.meta, 0)).toBe(1)
    expect(maxClientProjectSlots(withSlots.meta, 1)).toBe(2)

    const withPm = dispatchChain(withSlots, [toggleSpecialistRoleMsg(T0 + 1500, 'project_manager', true)])
    expect(countAssignedPmAgents(withPm.agents)).toBe(1)

    const lead = withPm.leads.find((l) => l.status === 'available')!
    const withSecondProject = dispatchChain(withPm, [acceptLeadMsg(T0 + 2000, lead.id)])
    expect(withSecondProject.projects.filter((p) => p.status === 'active' && p.kind === 'client').length).toBe(1)

    const secondLead: typeof withSecondProject = {
      ...withSecondProject,
      leads: [
        ...withSecondProject.leads,
        {
          id: 'lead-second',
          clientName: 'Second Client',
          clientTagline: 'More work',
          blurb: 'More work',
          payment: 120,
          durationDays: 15,
          totalStoryPoints: 4,
          spawnedGameDay: 0,
          status: 'available',
          repRequired: 0,
          source: 'real',
        },
      ],
    }
    const withTwoProjects = dispatchChain(secondLead, [acceptLeadMsg(T0 + 2500, 'lead-second')])
    expect(withTwoProjects.projects.filter((p) => p.status === 'active' && p.kind === 'client').length).toBe(2)

    const withFreshLead: typeof withTwoProjects = {
      ...withTwoProjects,
      leads: [
        ...withSecondProject.leads,
        {
          id: 'lead-third',
          clientName: 'Third Client',
          clientTagline: 'Too many',
          blurb: 'Too many',
          payment: 150,
          durationDays: 15,
          totalStoryPoints: 4,
          spawnedGameDay: 0,
          status: 'available',
          repRequired: 0,
          source: 'real',
        },
      ],
    }
    const blocked = dispatchChain(withFreshLead, [acceptLeadMsg(T0 + 3000, 'lead-third')])
    expect(blocked.projects.length).toBe(2)
    expect(blocked.leads.find((l) => l.id === 'lead-third')?.status).toBe('available')
  })

  it('allows a second PM assignment when the course tier supports it', () => {
    const base = stateWithCash(stateWithAvailableLead(), 10_000)
    let state = dispatchChain(base, [
      buyAgentSlotMsg(T0 + 400),
      buyAgentSlotMsg(T0 + 500),
      buyAgentSlotMsg(T0 + 600),
      buyVibingCourseMsg(T0 + 1000, 'project_manager'),
      buyVibingCourseMsg(T0 + 1100, 'project_manager'),
    ])
    expect(maxAssignablePmAgents(state)).toBe(2)

    state = dispatchChain(state, [
      toggleSpecialistRoleMsg(T0 + 1500, 'project_manager', true),
      toggleSpecialistRoleMsg(T0 + 1600, 'project_manager', true),
    ])
    expect(countAssignedPmAgents(state.agents)).toBe(2)
    expect(maxClientProjectSlots(state.meta, 2)).toBe(3)
  })
})
