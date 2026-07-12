import { describe, expect, it } from 'vitest'
import { toggleConductorMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('toggle-conductor-resets-roles', () => {
  it('matches use case invariants', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const before = {
      ...base,
      vibingCourses: ['conductor'],
      projects: [
        {
          ...project,
          roleCounts: { refine: 1, code: 1, review: 1, test: 0, conductor: 0 },
        },
      ],
    }

    const state = dispatchChain(before, [toggleConductorMsg(T0 + 1000, project.id, true)])

    expect(state.projects[0]!.useConductor).toBe(true)
    expect(state.projects[0]!.roleCounts).toEqual({
      refine: 0,
      code: 0,
      review: 0,
      test: 0,
      conductor: 1,
    })
  })
})
