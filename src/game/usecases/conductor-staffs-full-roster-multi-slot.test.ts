import { describe, expect, it } from 'vitest'
import { timeElapsed, toggleConductorMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateAtAgentCapacity } from './_helpers/stateAtAgentCapacity'
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
    roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 0 },
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

function idleAgent(template: Agent, id: string, projectId: string, job: Agent['job']): Agent {
  return {
    ...template,
    id,
    job,
    projectId,
    status: 'idle',
    taskId: null,
    contextUsed: 0,
    compactingRemainingSec: 0,
    jobProgress: 0,
    jobDuration: 0,
  }
}

describe('conductor-staffs-full-roster-multi-slot', () => {
  it('staffs conductor and refine on a higher slot when roster is full', () => {
    const capped = stateAtAgentCapacity()
    const template = capped.agents[0]!
    const projectA = clientProject(0, 'proj-a')
    const projectB = clientProject(1, 'proj-b', {
      useConductor: true,
      roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 1 },
    })

    const before: GameState = {
      ...capped,
      vibingCourses: ['conductor'],
      projects: [projectA, projectB],
      agents: [
        idleAgent(template, 'refine-a', projectA.id, 'refine'),
        idleAgent({ ...template, name: 'Coder A' }, 'code-a', projectA.id, 'code'),
      ],
    }

    const after = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    expect(after.agents.some((a) => a.projectId === projectB.id && a.job === 'conductor')).toBe(true)
    expect(after.agents.some((a) => a.projectId === projectB.id && a.job === 'refine')).toBe(true)
  })

  it('does not pull idle agents from a higher slot to staff conductor on a lower slot', () => {
    const capped = stateAtAgentCapacity()
    const template = capped.agents[0]!
    const projectA = clientProject(0, 'proj-a', {
      useConductor: true,
      roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 1 },
    })
    const projectB = clientProject(1, 'proj-b', {
      roleCounts: { refine: 1, code: 1, review: 0, test: 0, conductor: 0 },
    })

    const before: GameState = {
      ...capped,
      vibingCourses: ['conductor'],
      projects: [projectA, projectB],
      agents: [
        idleAgent({ ...template, name: 'Refiner B' }, 'refine-b', projectB.id, 'refine'),
        idleAgent({ ...template, name: 'Coder B' }, 'code-b', projectB.id, 'code'),
      ],
    }

    const after = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    expect(after.agents.some((a) => a.projectId === projectA.id && a.job === 'conductor')).toBe(false)
    expect(after.agents.some((a) => a.projectId === projectB.id && a.job === 'refine')).toBe(true)
    expect(after.agents.some((a) => a.projectId === projectB.id && a.job === 'code')).toBe(true)
  })

  it('staffs conductor immediately when toggled on a higher slot with a full roster', () => {
    const capped = stateAtAgentCapacity()
    const template = capped.agents[0]!
    const projectA = clientProject(0, 'proj-a')
    const projectB = clientProject(1, 'proj-b')

    const before: GameState = {
      ...capped,
      vibingCourses: ['conductor'],
      projects: [projectA, projectB],
      agents: [
        idleAgent(template, 'refine-a', projectA.id, 'refine'),
        idleAgent({ ...template, name: 'Coder A' }, 'code-a', projectA.id, 'code'),
      ],
    }

    const after = dispatchChain(before, [toggleConductorMsg(T0 + 1000, projectB.id, true)])

    expect(after.projects.find((p) => p.id === projectB.id)!.useConductor).toBe(true)
    expect(after.agents.some((a) => a.projectId === projectB.id && a.job === 'conductor')).toBe(true)
  })
})
