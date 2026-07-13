import { describe, expect, it } from 'vitest'
import {
  acceptLeadMsg,
  buyAgentSlotMsg,
  buyVibingCourseMsg,
  adjustRoleCountMsg,
  toggleSpecialistRoleMsg,
} from '../messages'
import { countActiveClientProjects, clientLeadPipelineTarget, countAssignedPmAgents } from '../mechanics'
import { maxClientProjectSlots } from '../prestige'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithAvailableLead } from './_helpers/stateWithAvailableLead'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'
import type { GameState, Project } from '../types'

function extraProject(index: number): Project {
  return {
    id: `proj-extra-${index}`,
    clientName: `Client ${index}`,
    clientTagline: 'Test',
    blurb: 'Test',
    payment: 100,
    durationDays: 20,
    daysRemaining: 20,
    deliveryQuality: 80,
    testPercent: 0,
    testStoryPointsRequired: 0,
    testStoryPointsCompleted: 0,
    totalStoryPoints: 5,
    status: 'active',
    requirements: [],
    tasks: [],
    isTutorial: false,
    kind: 'client',
    lateCount: 0,
    repPenaltyMultiplier: 1,
    roleCounts: { refine: 1, code: 0, review: 0, test: 0, conductor: 0 },
    useConductor: false,
    duplicateProjectId: null,
    mrrContribution: 0,
  }
}

function withPmSpecialist(state: GameState): GameState {
  const withSlot = dispatchChain(state, [buyAgentSlotMsg(T0 + 500)])
  const withCourse = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, 'project_manager')])
  return dispatchChain(withCourse, [toggleSpecialistRoleMsg(T0 + 1500, 'project_manager', true)])
}

describe('pm-unassign-enforces-project-cap', () => {
  it('locks overflow projects, clears their staffing, and caps leads when PM is unassigned', () => {
    const base = stateWithCash(stateWithAvailableLead(), 5000)
    const withPm = withPmSpecialist(base)
    const maxWithPm = maxClientProjectSlots(withPm.meta, countAssignedPmAgents(withPm.agents))
    expect(maxWithPm).toBeGreaterThan(1)

    const projectA = extraProject(1)
    const projectB = extraProject(2)
    const staffed: GameState = {
      ...withPm,
      projects: [projectA, projectB],
      agents: [
        {
          id: 'agt-a',
          name: 'Refine Bot A',
          job: 'refine',
          taskId: null,
          projectId: projectA.id,
          jobProgress: 0,
          jobDuration: 0,
          status: 'refining',
          personality: withPm.agents[0]!.personality,
          contextUsed: 0,
          compactingRemainingSec: 0,
          uptime: 0,
        },
        {
          id: 'agt-b',
          name: 'Refine Bot B',
          job: 'refine',
          taskId: null,
          projectId: projectB.id,
          jobProgress: 0,
          jobDuration: 0,
          status: 'refining',
          personality: withPm.agents[0]!.personality,
          contextUsed: 0,
          compactingRemainingSec: 0,
          uptime: 0,
        },
        ...withPm.agents.filter((a) => a.isAutomation && a.automationJob === 'project_manager'),
      ],
      leads: [
        ...withPm.leads,
        {
          id: 'lead-extra-1',
          clientName: 'Extra Lead 1',
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
        {
          id: 'lead-extra-2',
          clientName: 'Extra Lead 2',
          clientTagline: 'Also waiting',
          blurb: 'Also waiting',
          payment: 130,
          durationDays: 15,
          totalStoryPoints: 4,
          spawnedGameDay: 0,
          status: 'available',
          repRequired: 0,
          source: 'real',
        },
      ],
    }

    const unassigned = dispatchChain(staffed, [
      toggleSpecialistRoleMsg(T0 + 2000, 'project_manager', false),
    ])

    const maxWithoutPm = maxClientProjectSlots(unassigned.meta, 0)
    expect(countActiveClientProjects(unassigned.projects)).toBe(maxWithoutPm)
    expect(unassigned.projects[0]!.isLocked).not.toBe(true)
    expect(unassigned.projects[1]!.isLocked).toBe(true)
    expect(unassigned.projects[1]!.roleCounts.refine).toBe(0)
    expect(unassigned.agents.some((a) => a.projectId === projectB.id)).toBe(false)

    const pipelineTarget = clientLeadPipelineTarget(
      unassigned.meta,
      0,
      unassigned.projects,
    )
    expect(unassigned.leads.filter((l) => l.status === 'available').length).toBe(pipelineTarget)

    const withFreshLead: GameState = {
      ...unassigned,
      leads: [
        ...unassigned.leads,
        {
          id: 'lead-after-cap',
          clientName: 'Blocked Lead',
          clientTagline: 'Nope',
          blurb: 'Nope',
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
    const blocked = dispatchChain(withFreshLead, [acceptLeadMsg(T0 + 3000, 'lead-after-cap')])
    expect(blocked.projects.length).toBe(unassigned.projects.length)
    expect(blocked.leads.find((l) => l.id === 'lead-after-cap')?.status).toBe('available')
  })

  it('blocks staffing changes on locked projects', () => {
    const base = stateWithCash(stateWithAvailableLead(), 5000)
    const withPm = withPmSpecialist(base)
    const projectA = extraProject(1)
    const projectB = extraProject(2)
    const staffed: GameState = {
      ...withPm,
      projects: [projectA, projectB],
      agents: [],
    }

    const unassigned = dispatchChain(staffed, [
      toggleSpecialistRoleMsg(T0 + 2000, 'project_manager', false),
    ])
    const locked = unassigned.projects[1]!

    const afterStaff = dispatchChain(unassigned, [
      adjustRoleCountMsg(T0 + 3000, locked.id, 'refine', 1),
    ])

    expect(afterStaff.projects[1]!.roleCounts.refine).toBe(0)
    expect(afterStaff.agents.some((a) => a.projectId === locked.id)).toBe(false)
  })
})
