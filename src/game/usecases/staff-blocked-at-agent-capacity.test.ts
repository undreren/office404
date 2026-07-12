import { describe, expect, it } from 'vitest'
import { adjustRoleCountMsg, stateChanged } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateAtAgentCapacity } from './_helpers/stateAtAgentCapacity'
import { T0 } from './_helpers/testConstants'

describe('staff-blocked-at-agent-capacity', () => {
  it('matches use case invariants', () => {
    const before = stateAtAgentCapacity()
    const project = before.projects[0]!

    const after = dispatchChain(before, [adjustRoleCountMsg(T0 + 1000, project.id, 'code', 1)])

    expect(stateChanged(before, after)).toBe(false)
  })
})
