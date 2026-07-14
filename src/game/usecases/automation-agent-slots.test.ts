import { describe, expect, it } from 'vitest'
import {
  buyAgentSlotMsg,
  buyVibingCourseMsg,
  stateChanged,
  timeElapsed,
  toggleSpecialistRoleMsg,
} from '../messages'
import { agentCapacity } from '../simulation/gameLogic'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'
import type { GameState } from '../types'

describe('automation-agent-slots', () => {
  it('does not spawn a specialist when a course unlocks — player assigns via checkbox', () => {
    const before = stateWithCash(initialPlaying(), 500)
    const withSlot = dispatchChain(before, [buyAgentSlotMsg(T0 + 500)])

    const state = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, 'marketing')])

    expect(state.agents.some((a) => a.isAutomation && a.automationJob === 'marketing')).toBe(false)
    expect(state.assignedSpecialistRoles).not.toContain('marketing')
    expect(agentCapacity(state).used).toBe(1)
  })

  it('assigns a specialist agent when the role is toggled on and roster space exists', () => {
    const before = stateWithCash(initialPlaying(), 500)
    const withSlot = dispatchChain(before, [buyAgentSlotMsg(T0 + 500)])
    const unlocked = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, 'marketing')])

    const assigned = dispatchChain(unlocked, [toggleSpecialistRoleMsg(T0 + 2000, 'marketing', true)])

    expect(assigned.assignedSpecialistRoles).toContain('marketing')
    expect(assigned.agents.some((a) => a.isAutomation && a.automationJob === 'marketing')).toBe(true)
    expect(agentCapacity(assigned).used).toBe(2)
  })

  it('yeets a project agent when assigning a specialist on a full roster', () => {
    const before = stateWithCash(initialPlaying(), 350)
    const unlocked = dispatchChain(before, [buyVibingCourseMsg(T0 + 1000, 'marketing')])
    const project = unlocked.projects[0]!

    const assigned = dispatchChain(unlocked, [toggleSpecialistRoleMsg(T0 + 2000, 'marketing', true)])

    expect(assigned.assignedSpecialistRoles).toContain('marketing')
    expect(assigned.agents.some((a) => a.isAutomation && a.automationJob === 'marketing')).toBe(true)
    expect(assigned.agents.some((a) => a.projectId === project.id && a.job === 'refine')).toBe(false)
    expect(assigned.projects[0]!.roleCounts.refine).toBe(0)
    expect(agentCapacity(assigned).used).toBe(1)
  })

  it('blocks assigning a specialist when the roster is full and no project agents can be yeeted', () => {
    const before = stateWithCash(initialPlaying(), 350)
    const unlocked = dispatchChain(before, [buyVibingCourseMsg(T0 + 1000, 'marketing')])
    const onlyAgent = unlocked.agents[0]!
    const automationOnly: GameState = {
      ...unlocked,
      agents: [
        {
          ...onlyAgent,
          isAutomation: true,
          automationJob: 'procurement',
          job: 'procurement',
          projectId: null,
          status: 'idle',
        },
      ],
      assignedSpecialistRoles: ['procurement'],
      vibingCourses: [...unlocked.vibingCourses, 'procurement'],
    }

    const blocked = dispatchChain(automationOnly, [toggleSpecialistRoleMsg(T0 + 2000, 'marketing', true)])

    expect(stateChanged(automationOnly, blocked)).toBe(false)
    expect(blocked.assignedSpecialistRoles).not.toContain('marketing')
  })

  it('removes the agent and frees the roster slot when a specialist role is toggled off', () => {
    const before = stateWithCash(initialPlaying(), 500)
    const withSlot = dispatchChain(before, [buyAgentSlotMsg(T0 + 500)])
    const unlocked = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, 'marketing')])
    const assigned = dispatchChain(unlocked, [toggleSpecialistRoleMsg(T0 + 2000, 'marketing', true)])
    const usedBefore = agentCapacity(assigned).used

    const unassigned = dispatchChain(assigned, [toggleSpecialistRoleMsg(T0 + 3000, 'marketing', false)])

    expect(unassigned.assignedSpecialistRoles).not.toContain('marketing')
    expect(unassigned.agents.some((a) => a.automationJob === 'marketing')).toBe(false)
    expect(agentCapacity(unassigned).used).toBe(usedBefore - 1)
  })

  it('materializes an assigned specialist when a new roster slot opens', () => {
    const before = stateWithCash(initialPlaying(), 500)
    const withSlot = dispatchChain(before, [buyAgentSlotMsg(T0 + 500)])
    const unlocked = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, 'marketing')])
    const assigned = dispatchChain(unlocked, [toggleSpecialistRoleMsg(T0 + 2000, 'marketing', true)])
    expect(assigned.agents.some((a) => a.automationJob === 'marketing')).toBe(true)

    const unassigned = dispatchChain(assigned, [toggleSpecialistRoleMsg(T0 + 2500, 'marketing', false)])
    const withSecondSlot = dispatchChain(unassigned, [buyAgentSlotMsg(T0 + 3000)])
    const reassigned = dispatchChain(withSecondSlot, [
      toggleSpecialistRoleMsg(T0 + 3500, 'marketing', true),
    ])

    expect(reassigned.agents.some((a) => a.isAutomation && a.automationJob === 'marketing')).toBe(true)
    expect(agentCapacity(reassigned).used).toBe(2)
  })

  it('does not let conductor pull an unassigned specialist onto project work', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const template = base.agents[0]!

    const before: GameState = {
      ...base,
      vibingCourses: ['conductor', 'marketing'],
      assignedSpecialistRoles: [],
      projects: [
        {
          ...project,
          useConductor: true,
          roleCounts: { refine: 1, code: 0, review: 0, test: 0, conductor: 1 },
        },
      ],
      agents: [
        {
          ...template,
          id: 'conductor-1',
          job: 'conductor',
          projectId: project.id,
          status: 'conducting',
          taskId: null,
          contextUsed: 0,
          compactingRemainingSec: 0,
        },
      ],
    }

    const state = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    expect(state.agents.some((a) => a.isAutomation)).toBe(false)
    expect(state.agents.some((a) => a.projectId === project.id && a.job === 'refine')).toBe(false)
  })

  it('auto-buys RAM when procurement specialist is assigned and cash allows', () => {
    const before = stateWithCash(initialPlaying(), 5000)
    const unlocked = dispatchChain(before, [buyVibingCourseMsg(T0 + 1000, 'procurement')])
    const assigned = dispatchChain(unlocked, [toggleSpecialistRoleMsg(T0 + 1500, 'procurement', true)])

    const after = dispatchChain(assigned, [timeElapsed(T0 + 2000, 1)])

    expect(after.agentSlotPurchases).toBe(1)
    expect(after.events.some((e) => e.message.includes('Procurement auto-bought +1 RAM'))).toBe(true)
  })

  it('auto-buys vibing courses when price is within 10% of cash and hardware is maxed', () => {
    const ownedUnderPm = [
      'prompt_engineering',
      'context_optimization',
      'refinement',
      'auto_conductor',
      'sales',
      'marketing',
      'conductor',
      'accounting',
    ]
    const before: GameState = {
      ...stateWithCash(initialPlaying(), 5140),
      agentSlotPurchases: 1,
      gpuTickPurchases: 1,
      vibingCourses: ownedUnderPm,
      vibingCourseTiers: Object.fromEntries(ownedUnderPm.map((id) => [id, 1])),
      tutorialDone: true,
    }
    const unlocked = dispatchChain(before, [buyVibingCourseMsg(T0 + 1000, 'procurement')])
    const assigned = dispatchChain(unlocked, [toggleSpecialistRoleMsg(T0 + 1500, 'procurement', true)])

    const after = dispatchChain(assigned, [timeElapsed(T0 + 2000, 1)])

    expect(after.vibingCourses).toContain('project_manager')
    expect(after.vibingCourseTiers.project_manager).toBe(1)
    expect(after.events.some((e) => e.message.includes('Procurement auto-enrolled in Project Manager'))).toBe(
      true,
    )
  })

  it('auto-buys via hallucination unlock without vibing course', () => {
    const before = stateWithCash(initialPlaying(), 5000)
    const withHallucination: GameState = {
      ...before,
      meta: {
        ...before.meta,
        hallucinationLevels: { ...before.meta.hallucinationLevels, procurement: 1 },
      },
    }
    const assigned = dispatchChain(withHallucination, [
      toggleSpecialistRoleMsg(T0 + 1500, 'procurement', true),
    ])

    const after = dispatchChain(assigned, [timeElapsed(T0 + 2000, 1)])

    expect(after.agentSlotPurchases).toBe(1)
  })

  it('pauses procurement automation when the procurement specialist is unassigned', () => {
    const before = stateWithCash(initialPlaying(), 5000)
    const withSlot = dispatchChain(before, [buyAgentSlotMsg(T0 + 500)])
    const unlocked = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, 'procurement')])
    const assigned = dispatchChain(unlocked, [toggleSpecialistRoleMsg(T0 + 1500, 'procurement', true)])
    const slotsBefore = assigned.agentSlotPurchases

    const unassigned = dispatchChain(assigned, [
      toggleSpecialistRoleMsg(T0 + 2000, 'procurement', false),
      timeElapsed(T0 + 3000, 60),
    ])

    expect(unassigned.agents.some((a) => a.automationJob === 'procurement')).toBe(false)
    expect(unassigned.agentSlotPurchases).toBe(slotsBefore)
  })
})
