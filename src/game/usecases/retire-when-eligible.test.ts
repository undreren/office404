import { describe, expect, it } from 'vitest'
import { WIN_CASH } from '../constants'
import { retireMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('retire-when-eligible', () => {
  it('matches use case invariants', () => {
    const before = stateWithCash(initialPlaying(), WIN_CASH)

    const state = dispatchChain(before, [retireMsg(T0 + 1000)])

    expect(state.phase).toBe('won')
  })
})
