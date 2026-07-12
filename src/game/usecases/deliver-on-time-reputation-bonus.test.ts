import { describe, expect, it } from 'vitest'
import { ON_TIME_REP_BONUS } from '../constants'
import { deliverProjectMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithDeliverableProject } from './_helpers/stateWithTutorialComplete'
import { T0 } from './_helpers/testConstants'

describe('deliver-on-time-reputation-bonus', () => {
  it('matches use case invariants', () => {
    const { state: ready, projectId } = stateWithDeliverableProject(initialPlaying(), 400)
    const repBefore = ready.reputation

    const state = dispatchChain(ready, [deliverProjectMsg(T0 + 1000, projectId)])

    expect(state.reputation - repBefore).toBeGreaterThanOrEqual(ON_TIME_REP_BONUS)
  })
})
