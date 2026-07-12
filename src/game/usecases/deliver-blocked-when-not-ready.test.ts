import { describe, expect, it } from 'vitest'
import { deliverProjectMsg, stateChanged } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('deliver-blocked-when-not-ready', () => {
  it('matches use case invariants', () => {
    const before = initialPlaying()
    const project = before.projects[0]!

    const after = dispatchChain(before, [deliverProjectMsg(T0 + 1000, project.id)])

    expect(stateChanged(before, after)).toBe(false)
  })
})
