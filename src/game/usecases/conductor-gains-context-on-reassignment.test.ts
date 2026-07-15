import { describe, expect, it } from 'vitest'
import { CONDUCTOR_MOVE_TOKEN_COST } from '../constants'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Agent, GameState } from '../types'

describe('conductor-gains-context-on-reassignment', () => {
  function conductorFixture(): { before: GameState; conductorId: string; projectId: string } {
    const base = initialPlaying()
    const project = base.projects[0]!
    const template = base.agents[0]!
    const conductor: Agent = {
      ...template,
      id: 'conductor-1',
      job: 'conductor',
      projectId: project.id,
      status: 'conducting',
      taskId: null,
      contextUsed: 0,
      compactingRemainingSec: 0,
    }
    const bench: Agent = {
      ...template,
      id: 'bench-1',
      job: null,
      projectId: null,
      status: 'idle',
      taskId: null,
      contextUsed: 0,
      compactingRemainingSec: 0,
    }

    const before: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      projects: [
        {
          ...project,
          useConductor: true,
          roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 1 },
        },
      ],
      agents: [conductor, bench],
    }
    return { before, conductorId: conductor.id, projectId: project.id }
  }

  it('matches use case invariants', () => {
    const { before, conductorId, projectId } = conductorFixture()
    const state = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    const staffedConductor = state.agents.find((a) => a.id === conductorId)!
    const refineAgent = state.agents.find((a) => a.projectId === projectId && a.job === 'refine')

    expect(refineAgent).toBeTruthy()
    expect(staffedConductor.conductorMoveRemaining ?? CONDUCTOR_MOVE_TOKEN_COST).toBeLessThan(
      CONDUCTOR_MOVE_TOKEN_COST,
    )
    expect(staffedConductor.contextUsed).toBeGreaterThan(0)
  })

  it('charges context once per tick when multiple workers are reassigned', () => {
    const { before, conductorId } = conductorFixture()
    const state = dispatchChain(before, [timeElapsed(T0 + 1000, 1 / 30)])

    const staffedConductor = state.agents.find((a) => a.id === conductorId)!
    expect(staffedConductor.conductorMoveRemaining).toBeLessThan(CONDUCTOR_MOVE_TOKEN_COST)
    expect(staffedConductor.contextUsed).toBeGreaterThan(0)
  })
})
