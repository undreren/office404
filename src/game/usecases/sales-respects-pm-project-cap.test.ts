import { describe, expect, it } from 'vitest'
import {
  acceptLeadMsg,
  buyAgentSlotMsg,
  buyVibingCourseMsg,
  timeElapsed,
  toggleSpecialistRoleMsg,
} from '../messages'
import { countActiveClientProjects } from '../mechanics'
import { maxClientProjectSlots } from '../prestige'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithAvailableLead } from './_helpers/stateWithAvailableLead'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'
import type { GameState } from '../types'

function withActiveSalesAgent(state: GameState): GameState {
  const withSlot = dispatchChain(state, [buyAgentSlotMsg(T0 + 400)])
  const withCourse = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, 'sales')])
  return dispatchChain(withCourse, [toggleSpecialistRoleMsg(T0 + 1500, 'sales', true)])
}

function withPmCourseOnly(state: GameState): GameState {
  const withSlot = dispatchChain(state, [buyAgentSlotMsg(T0 + 500)])
  return dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1100, 'project_manager')])
}

describe('sales-respects-pm-project-cap', () => {
  it('does not auto-accept a second lead when PM course is owned but no PM is assigned', () => {
    const base = stateWithCash(stateWithAvailableLead(), 5000)
    const withPmCourse = withPmCourseOnly(base)
    expect(maxClientProjectSlots(withPmCourse.meta, 0)).toBe(1)

    const withSales = withActiveSalesAgent(withPmCourse)
    const firstLead = withSales.leads.find((l) => l.status === 'available')!

    const withFirstProject = dispatchChain(withSales, [acceptLeadMsg(T0 + 2000, firstLead.id)])
    expect(countActiveClientProjects(withFirstProject.projects)).toBe(1)

    const withSecondLead: GameState = {
      ...withFirstProject,
      leads: [
        ...withFirstProject.leads,
        {
          id: 'lead-second',
          clientName: 'Second Client',
          clientTagline: 'Needs a PM slot',
          blurb: 'Needs a PM slot',
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

    const after = dispatchChain(withSecondLead, [timeElapsed(T0 + 3000, 1)])

    expect(after.leads.find((l) => l.id === 'lead-second')?.status).toBe('available')
    expect(countActiveClientProjects(after.projects)).toBe(1)
  })

  it('does not auto-accept into a PM-gated slot when PM role is listed but no PM agent exists', () => {
    const base = stateWithCash(stateWithAvailableLead(), 5000)
    const withPmCourse = withPmCourseOnly(base)
    const withSales = withActiveSalesAgent(withPmCourse)

    const desynced: GameState = {
      ...withSales,
      assignedSpecialistRoles: [...withSales.assignedSpecialistRoles, 'project_manager'],
    }
    expect(desynced.agents.some((a) => a.automationJob === 'project_manager')).toBe(false)

    const firstLead = desynced.leads.find((l) => l.status === 'available')!
    const withFirstProject = dispatchChain(desynced, [acceptLeadMsg(T0 + 2000, firstLead.id)])
    expect(countActiveClientProjects(withFirstProject.projects)).toBe(1)

    const withSecondLead: GameState = {
      ...withFirstProject,
      leads: [
        ...withFirstProject.leads,
        {
          id: 'lead-second',
          clientName: 'Second Client',
          clientTagline: 'Needs PM agent',
          blurb: 'Needs PM agent',
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

    const after = dispatchChain(withSecondLead, [timeElapsed(T0 + 3000, 1)])

    expect(after.leads.find((l) => l.id === 'lead-second')?.status).toBe('available')
    expect(countActiveClientProjects(after.projects)).toBe(1)
  })

  it('does not auto-accept two leads on one tick when only one slot exists without PM', () => {
    const base = stateWithCash(stateWithAvailableLead(), 5000)
    const withSales = withActiveSalesAgent(withPmCourseOnly(base))

    const withTwoLeads: GameState = {
      ...withSales,
      leads: [
        ...withSales.leads,
        {
          id: 'lead-extra',
          clientName: 'Extra Client',
          clientTagline: 'Waiting',
          blurb: 'Waiting',
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

    const after = dispatchChain(withTwoLeads, [timeElapsed(T0 + 3000, 1)])

    expect(after.leads.filter((l) => l.status === 'accepted').length).toBe(1)
    expect(after.leads.filter((l) => l.status === 'available').length).toBe(1)
    expect(countActiveClientProjects(after.projects)).toBe(1)
  })

  it('does not auto-accept after PM unassign leaves only one unlocked client slot', () => {
    const base = stateWithCash(stateWithAvailableLead(), 5000)
    const withPm = dispatchChain(withPmCourseOnly(base), [
      toggleSpecialistRoleMsg(T0 + 1200, 'project_manager', true),
    ])
    const withSales = withActiveSalesAgent(withPm)

    const firstLead = withSales.leads.find((l) => l.status === 'available')!
    const withFirst = dispatchChain(withSales, [acceptLeadMsg(T0 + 2000, firstLead.id)])

    const withSecondLead: GameState = {
      ...withFirst,
      leads: [
        ...withFirst.leads,
        {
          id: 'lead-second',
          clientName: 'Second Client',
          clientTagline: 'Extra slot',
          blurb: 'Extra slot',
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
    const withTwoProjects = dispatchChain(withSecondLead, [
      acceptLeadMsg(T0 + 2500, 'lead-second'),
    ])
    expect(countActiveClientProjects(withTwoProjects.projects)).toBe(2)

    const unassigned = dispatchChain(withTwoProjects, [
      toggleSpecialistRoleMsg(T0 + 2800, 'project_manager', false),
    ])
    expect(countActiveClientProjects(unassigned.projects)).toBe(1)

    const withWaitingLead: GameState = {
      ...unassigned,
      leads: [
        ...unassigned.leads,
        {
          id: 'lead-after-unassign',
          clientName: 'Blocked Client',
          clientTagline: 'No PM',
          blurb: 'No PM',
          payment: 140,
          durationDays: 15,
          totalStoryPoints: 4,
          spawnedGameDay: 0,
          status: 'available',
          repRequired: 0,
          source: 'real',
        },
      ],
    }

    const after = dispatchChain(withWaitingLead, [timeElapsed(T0 + 3000, 1)])

    expect(after.leads.find((l) => l.id === 'lead-after-unassign')?.status).toBe('available')
    expect(countActiveClientProjects(after.projects)).toBe(1)
  })
})
