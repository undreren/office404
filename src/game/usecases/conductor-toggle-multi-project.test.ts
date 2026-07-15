import { describe, expect, it } from 'vitest'
import { toggleConductorMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Agent, GameState, Project } from '../types'

function clientProject(slotIndex: number, id: string, overrides: Partial<Project> = {}): Project {
  const base = initialPlaying().projects[0]!
  return {
    ...base,
    id,
    clientName: `Client slot ${slotIndex}`,
    isTutorial: false,
    kind: 'client',
    slotIndex,
    status: 'active',
    useConductor: false,
    roleCounts: { refine: 1, code: 0, review: 0, test: 0, conductor: 0 },
    requirements: base.requirements.map((r) => ({
      ...r,
      status: 'open' as const,
      refineJobProgress: 0,
      refineJobDuration: 0,
    })),
    tasks: [],
    ...overrides,
  }
}

function staffedRefiner(template: Agent, id: string, projectId: string): Agent {
  return {
    ...template,
    id,
    job: 'refine',
    projectId,
    status: 'idle',
    taskId: null,
    contextUsed: 0,
    compactingRemainingSec: 0,
    jobProgress: 0,
    jobDuration: 0,
  }
}

describe('conductor-toggle-multi-project', () => {
  it('assigns a conductor when toggled on the second project while the first has staffed workers', () => {
    const base = initialPlaying()
    const template = base.agents[0]!
    const projectA = clientProject(0, 'proj-a')
    const projectB = clientProject(1, 'proj-b')

    const before: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      projects: [projectA, projectB],
      agents: [staffedRefiner(template, 'refine-a', projectA.id)],
    }

    const state = dispatchChain(before, [toggleConductorMsg(T0 + 1000, projectB.id, true)])

    const project = state.projects.find((p) => p.id === projectB.id)!
    expect(project.useConductor).toBe(true)
    expect(state.agents.some((a) => a.projectId === projectB.id && a.job === 'conductor')).toBe(true)
  })

  it('assigns conductors to both projects when each is toggled with its own idle worker', () => {
    const base = initialPlaying()
    const template = base.agents[0]!
    const projectA = clientProject(0, 'proj-a')
    const projectB = clientProject(1, 'proj-b')

    let state: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      projects: [projectA, projectB],
      agents: [
        staffedRefiner(template, 'refine-a', projectA.id),
        staffedRefiner({ ...template, name: 'Refiner B' }, 'refine-b', projectB.id),
      ],
    }

    state = dispatchChain(state, [
      toggleConductorMsg(T0 + 1000, projectA.id, true),
      toggleConductorMsg(T0 + 2000, projectB.id, true),
    ])

    expect(state.agents.some((a) => a.projectId === projectA.id && a.job === 'conductor')).toBe(true)
    expect(state.agents.some((a) => a.projectId === projectB.id && a.job === 'conductor')).toBe(true)
  })
})
