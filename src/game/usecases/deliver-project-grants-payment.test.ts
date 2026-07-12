import { describe, expect, it } from 'vitest'
import { deliverProjectMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithDeliverableProject } from './_helpers/stateWithTutorialComplete'
import { T0 } from './_helpers/testConstants'

describe('deliver-project-grants-payment', () => {
  it('matches use case invariants', () => {
    const payment = 500
    const { state: ready, projectId } = stateWithDeliverableProject(initialPlaying(), payment)
    const cashBefore = ready.cash
    const countBefore = ready.projects.length

    const state = dispatchChain(ready, [deliverProjectMsg(T0 + 1000, projectId)])

    expect(state.cash).toBe(cashBefore + payment)
    expect(state.projects.length).toBe(countBefore - 1)
    expect(state.projects.some((p) => p.id === projectId)).toBe(false)
  })
})
