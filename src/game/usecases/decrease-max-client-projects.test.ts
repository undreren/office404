import { describe, expect, it } from 'vitest'
import { baseClientProjectSlots, maxClientProjectSlots, maxClientProjectSlotsCap } from '../prestige'
import { buyVibingCourseMsg, setMaxClientProjectsMsg } from '../messages'
import {
  clientLeadPipelineTarget,
  clientSlotsNeedingLeads,
  countActiveClientProjects,
} from '../mechanics'
import { VIBE_SLOTS_COURSE_ID, vibingCourseCost, VIBING_COURSES } from '../upgrades'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithAvailableLead } from './_helpers/stateWithAvailableLead'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'
import type { Project } from '../types'

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
    roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 0 },
    useConductor: false,
    duplicateProjectId: null,
    mrrContribution: 0,
    slotIndex: index,
  }
}

describe('decrease max client projects', () => {
  it('lowers the chosen cap after raising it', () => {
    const course = VIBING_COURSES.find((c) => c.id === VIBE_SLOTS_COURSE_ID)!
    let state = stateWithCash(stateWithAvailableLead(), vibingCourseCost(course, 0))
    state = dispatchChain(state, [buyVibingCourseMsg(T0 + 1000, VIBE_SLOTS_COURSE_ID)])

    const base = baseClientProjectSlots(state.meta)
    const cap = maxClientProjectSlotsCap(state.meta, state.vibingCourseTiers)
    expect(cap).toBe(base + 1)

    state = dispatchChain(state, [setMaxClientProjectsMsg(T0 + 2000, cap)])
    expect(maxClientProjectSlots(state.meta, state.vibingCourseTiers, state.maxClientProjects)).toBe(cap)

    state = dispatchChain(state, [setMaxClientProjectsMsg(T0 + 3000, base)])
    expect(maxClientProjectSlots(state.meta, state.vibingCourseTiers, state.maxClientProjects)).toBe(base)
  })

  it('keeps overflow gigs running and pauses replenishment until active drops below the cap', () => {
    const course = VIBING_COURSES.find((c) => c.id === VIBE_SLOTS_COURSE_ID)!
    let state = stateWithCash(stateWithAvailableLead(), vibingCourseCost(course, 0) * 3)
    state = dispatchChain(state, [
      buyVibingCourseMsg(T0 + 1000, VIBE_SLOTS_COURSE_ID),
      buyVibingCourseMsg(T0 + 2000, VIBE_SLOTS_COURSE_ID),
      setMaxClientProjectsMsg(T0 + 3000, maxClientProjectSlotsCap(state.meta, { vibe_slots: 2 })),
    ])
    state = {
      ...state,
      projects: [extraProject(0), extraProject(1)],
    }
    expect(countActiveClientProjects(state.projects)).toBe(2)

    const base = baseClientProjectSlots(state.meta)
    state = dispatchChain(state, [setMaxClientProjectsMsg(T0 + 4000, base)])
    expect(maxClientProjectSlots(state.meta, state.vibingCourseTiers, state.maxClientProjects)).toBe(base)
    expect(countActiveClientProjects(state.projects)).toBe(2)
    expect(state.projects.some((p) => p.isLocked)).toBe(false)
    expect(clientLeadPipelineTarget(state, 0, state.projects)).toBe(0)
    expect(clientSlotsNeedingLeads(state, state.projects, state.leads)).toEqual([])
  })
})
