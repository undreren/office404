import { describe, expect, it } from 'vitest'
import { buyVibingCourseMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('buy-vibing-course-added', () => {
  it('matches use case invariants', () => {
    const before = stateWithCash(initialPlaying(), 150)

    const state = dispatchChain(before, [buyVibingCourseMsg(T0 + 1000, 'prompt_engineering')])

    expect(state.vibingCourses).toContain('prompt_engineering')
    expect(state.cash).toBe(0)
  })
})
