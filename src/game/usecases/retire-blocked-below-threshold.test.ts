import { describe, expect, it } from 'vitest'
import { retireMsg, stateChanged } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('retire-blocked-below-threshold', () => {
  it('matches use case invariants', () => {
    const before = initialPlaying()

    const after = dispatchChain(before, [retireMsg(T0 + 1000)])

    expect(stateChanged(before, after)).toBe(false)
  })
})
