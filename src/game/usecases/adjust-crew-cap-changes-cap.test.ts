import { describe, expect, it } from 'vitest'
import { adjustCrewCapMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('adjust-crew-cap-changes-cap', () => {
  it('matches use case invariants', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const capBefore = project.crewCap

    const state = dispatchChain(base, [adjustCrewCapMsg(T0 + 1000, project.id, 2)])

    expect(state.projects[0]!.crewCap).toBe(capBefore + 2)
  })
})
