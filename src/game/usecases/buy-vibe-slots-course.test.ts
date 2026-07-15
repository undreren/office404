import { describe, expect, it } from 'vitest'
import { maxClientProjectSlots } from '../prestige'
import { buyVibingCourseMsg } from '../messages'
import { VIBE_SLOTS_COURSE_ID, VIBE_SLOTS_MAX_TIER, vibingCourseCost, VIBING_COURSES } from '../upgrades'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

describe('buy-vibe-slots-course', () => {
  it('adds one client project slot per tier up to four', () => {
    const course = VIBING_COURSES.find((c) => c.id === VIBE_SLOTS_COURSE_ID)!
    expect(course.maxTier).toBe(VIBE_SLOTS_MAX_TIER)

    let state = stateWithCash(initialPlaying(), 500_000)
    expect(maxClientProjectSlots(state.meta, state.vibingCourseTiers)).toBe(1)

    for (let tier = 1; tier <= VIBE_SLOTS_MAX_TIER; tier++) {
      const cost = vibingCourseCost(course, tier - 1)
      state = stateWithCash(state, cost)
      state = dispatchChain(state, [buyVibingCourseMsg(T0 + tier * 1000, VIBE_SLOTS_COURSE_ID)])
      expect(state.vibingCourseTiers[VIBE_SLOTS_COURSE_ID]).toBe(tier)
      expect(maxClientProjectSlots(state.meta, state.vibingCourseTiers)).toBe(1 + tier)
    }

    const blocked = dispatchChain(state, [buyVibingCourseMsg(T0 + 50_000, VIBE_SLOTS_COURSE_ID)])
    expect(blocked.vibingCourseTiers[VIBE_SLOTS_COURSE_ID]).toBe(VIBE_SLOTS_MAX_TIER)
  })
})
