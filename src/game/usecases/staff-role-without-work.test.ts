import { describe, expect, it } from 'vitest'
import { adjustRoleCountMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { tutorialReadyForCodeFixture } from '../../runtime/fixture-builders'
import { T0 } from './_helpers/testConstants'

describe('staff-role-without-work', () => {
  it('staffs review even when no PRs are ready', () => {
    const before = tutorialReadyForCodeFixture()
    const project = before.projects[0]!

    const state = dispatchChain(before, [adjustRoleCountMsg(T0 + 1000, project.id, 'review', 1)])

    expect(state.projects[0]!.roleCounts.review).toBe(1)
    expect(state.agents.some((a) => a.job === 'review' && a.projectId === project.id)).toBe(true)
  })
})
