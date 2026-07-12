import { describe, expect, it } from 'vitest'
import { adjustRoleCountMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('unstaff-coder-decreases-role-count', () => {
  it('matches use case invariants', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const staffed = dispatchChain(base, [
      adjustRoleCountMsg(T0 + 1000, project.id, 'refine', -1),
      adjustRoleCountMsg(T0 + 2000, project.id, 'code', 1),
    ])

    const state = dispatchChain(staffed, [adjustRoleCountMsg(T0 + 3000, project.id, 'code', -1)])

    expect(state.projects[0]!.roleCounts.code).toBe(0)
  })
})
