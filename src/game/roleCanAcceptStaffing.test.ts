import { describe, expect, it } from 'vitest'
import { roleCanAcceptStaffing } from './projects'
import { tutorialReadyForCodeFixture } from '../runtime/fixture-builders'

describe('roleCanAcceptStaffing', () => {
  it('only code is staffable when tutorial tasks are refined and open', () => {
    const state = tutorialReadyForCodeFixture()
    const project = state.projects[0]!

    expect(roleCanAcceptStaffing(project, 'refine', state.agents)).toBe(false)
    expect(roleCanAcceptStaffing(project, 'code', state.agents)).toBe(true)
    expect(roleCanAcceptStaffing(project, 'review', state.agents)).toBe(false)
    expect(roleCanAcceptStaffing(project, 'test', state.agents)).toBe(false)
  })
})
