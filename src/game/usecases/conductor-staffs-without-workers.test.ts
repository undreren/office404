import { describe, expect, it } from 'vitest'
import { timeElapsed, toggleConductorMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Agent, GameState } from '../types'

describe('conductor-staffs-without-workers', () => {
  function projectWithOpenRefineWork(): GameState {
    const base = initialPlaying()
    const project = base.projects[0]!
    const template = base.agents[0]!
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

    return {
      ...base,
      vibingCourses: ['conductor'],
      projects: [
        {
          ...project,
          useConductor: false,
          roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 0 },
          requirements: project.requirements.map((r) => ({ ...r, status: 'open' as const })),
          tasks: [],
        },
      ],
      agents: [bench],
    }
  }

  it('assigns a conductor immediately when conductor mode is enabled with no workers', () => {
    const before = projectWithOpenRefineWork()
    const projectId = before.projects[0]!.id

    const state = dispatchChain(before, [toggleConductorMsg(T0 + 1000, projectId, true)])

    const conductor = state.agents.find((a) => a.projectId === projectId && a.job === 'conductor')
    expect(conductor).toBeTruthy()
  })

  it('assigns a conductor on tick when conductor mode is already on with no workers', () => {
    const before = {
      ...projectWithOpenRefineWork(),
      projects: [
        {
          ...projectWithOpenRefineWork().projects[0]!,
          useConductor: true,
          roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 1 },
        },
      ],
    }
    const projectId = before.projects[0]!.id

    const state = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    const conductor = state.agents.find((a) => a.projectId === projectId && a.job === 'conductor')
    expect(conductor).toBeTruthy()
  })
})
