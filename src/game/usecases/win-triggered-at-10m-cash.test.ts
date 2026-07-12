import { describe, expect, it } from 'vitest'
import { WIN_CASH } from '../constants'
import { deliverProjectMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithDeliverableProject } from './_helpers/stateWithTutorialComplete'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

describe('win-triggered-at-10m-cash', () => {
  it('matches use case invariants', () => {
    const payment = 500
    const { state: ready, projectId } = stateWithDeliverableProject(
      stateWithCash(initialPlaying(), WIN_CASH - payment),
      payment,
    )

    const state = dispatchChain(ready, [deliverProjectMsg(T0 + 1000, projectId)])

    expect(state.phase).toBe('won')
    expect(state.cash).toBeGreaterThanOrEqual(WIN_CASH)
  })
})
