import { describe, expect, it } from 'vitest'
import { deliverProjectMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithDeliverableProject } from './_helpers/stateWithTutorialComplete'
import { T0 } from './_helpers/testConstants'

describe('projects-completed-increments-stat', () => {
  it('matches use case invariants', () => {
    const { state: ready, projectId } = stateWithDeliverableProject(initialPlaying(), 300)
    const before = ready.stats.projectsCompleted

    const state = dispatchChain(ready, [deliverProjectMsg(T0 + 1000, projectId)])

    expect(state.stats.projectsCompleted).toBe(before + 1)
  })
})
