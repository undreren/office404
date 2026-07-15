import { describe, expect, it } from 'vitest'
import { CONDUCTOR_MOVE_TOKEN_COST } from '../constants'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Agent, GameState } from '../types'

describe('conductor-context-only-on-reassignment', () => {
  it('charges conductor move tokens only when reassigning workers', () => {
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

    const stable: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      projects: [
        {
          ...project,
          useConductor: true,
          roleCounts: { refine: 1, code: 0, review: 0, test: 0, conductor: 1 },
        },
      ],
      agents: [
        conductor,
        {
          ...template,
          id: 'refine-1',
          job: 'refine',
          projectId: project.id,
          status: 'idle',
          taskId: null,
          contextUsed: 0,
          compactingRemainingSec: 0,
        },
      ],
    }

    const idle = dispatchChain(stable, [timeElapsed(T0 + 1000, 1 / 30)])
    const c = idle.agents.find((a) => a.id === conductor.id)!
    expect(c.conductorMoveRemaining ?? 0).toBe(0)
    expect(c.contextUsed).toBe(0)

    const withBench: GameState = {
      ...stable,
      agents: [
        conductor,
        {
          ...template,
          id: 'bench-1',
          job: null,
          projectId: null,
          status: 'idle',
          taskId: null,
          contextUsed: 0,
          compactingRemainingSec: 0,
        },
      ],
      projects: [
        {
          ...stable.projects[0]!,
          roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 1 },
        },
      ],
    }

    const moved = dispatchChain(withBench, [timeElapsed(T0 + 2000, 1 / 30)])
    const movedConductor = moved.agents.find((a) => a.id === conductor.id)!
    expect(movedConductor.conductorMoveRemaining).toBeLessThan(CONDUCTOR_MOVE_TOKEN_COST)
  })
})
