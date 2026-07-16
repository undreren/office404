import { describe, expect, it } from 'vitest'
import { buyVibingCourseMsg } from '../messages'
import { isVibingCourseVisible, PRODUCT_OWNER_COURSE_ID } from '../upgrades'
import { createDefaultMeta } from '../meta'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

describe('product-owner-course-visibility', () => {
  it('hides the course until in_house is unlocked', () => {
    expect(isVibingCourseVisible(PRODUCT_OWNER_COURSE_ID, createDefaultMeta())).toBe(false)
    expect(
      isVibingCourseVisible(PRODUCT_OWNER_COURSE_ID, {
        ...createDefaultMeta(),
        hallucinationLevels: { in_house: 1 },
      }),
    ).toBe(true)
  })

  it('blocks purchase before in_house is unlocked', () => {
    const before = stateWithCash(initialPlaying(), 10_000)
    const after = dispatchChain(before, [buyVibingCourseMsg(T0 + 1000, PRODUCT_OWNER_COURSE_ID)])

    expect(after.vibingCourses).not.toContain(PRODUCT_OWNER_COURSE_ID)
    expect(after.cash).toBe(10_000)
  })
})
