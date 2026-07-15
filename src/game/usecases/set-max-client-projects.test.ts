import { describe, expect, it } from 'vitest'
import {
  baseClientProjectSlots,
  maxClientProjectSlots,
  maxClientProjectSlotsCap,
} from '../prestige'
import { buyVibingCourseMsg, setMaxClientProjectsMsg } from '../messages'
import { VIBE_SLOTS_COURSE_ID, vibingCourseCost, VIBING_COURSES } from '../upgrades'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

describe('set-max-client-projects', () => {
  it('does not raise the cap when buying Parallel Vibes', () => {
    const course = VIBING_COURSES.find((c) => c.id === VIBE_SLOTS_COURSE_ID)!
    let state = stateWithCash(initialPlaying(), vibingCourseCost(course, 0))

    state = dispatchChain(state, [buyVibingCourseMsg(T0 + 1000, VIBE_SLOTS_COURSE_ID)])

    expect(state.vibingCourseTiers[VIBE_SLOTS_COURSE_ID]).toBe(1)
    expect(maxClientProjectSlots(state.meta, state.vibingCourseTiers, state.maxClientProjects)).toBe(
      baseClientProjectSlots(state.meta),
    )
    expect(maxClientProjectSlotsCap(state.meta, state.vibingCourseTiers)).toBe(
      baseClientProjectSlots(state.meta) + 1,
    )
  })

  it('raises active slots when the player sets them on Status', () => {
    const course = VIBING_COURSES.find((c) => c.id === VIBE_SLOTS_COURSE_ID)!
    let state = stateWithCash(initialPlaying(), vibingCourseCost(course, 0))
    state = dispatchChain(state, [buyVibingCourseMsg(T0 + 1000, VIBE_SLOTS_COURSE_ID)])

    const cap = maxClientProjectSlotsCap(state.meta, state.vibingCourseTiers)
    state = dispatchChain(state, [setMaxClientProjectsMsg(T0 + 2000, cap)])

    expect(state.maxClientProjects).toBe(cap)
    expect(maxClientProjectSlots(state.meta, state.vibingCourseTiers, state.maxClientProjects)).toBe(cap)
  })

  it('clamps to Parallel Vibes tier cap', () => {
    const course = VIBING_COURSES.find((c) => c.id === VIBE_SLOTS_COURSE_ID)!
    let state = stateWithCash(initialPlaying(), vibingCourseCost(course, 0) * 2)
    state = dispatchChain(state, [
      buyVibingCourseMsg(T0 + 1000, VIBE_SLOTS_COURSE_ID),
      buyVibingCourseMsg(T0 + 2000, VIBE_SLOTS_COURSE_ID),
    ])

    const cap = maxClientProjectSlotsCap(state.meta, state.vibingCourseTiers)
    const blocked = dispatchChain(state, [setMaxClientProjectsMsg(T0 + 3000, cap + 5)])

    expect(blocked.maxClientProjects).toBe(cap)
  })
})
