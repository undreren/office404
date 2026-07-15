import { describe, expect, it } from 'vitest'
import { toggleConductorMsg } from '../messages'
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

describe('conductor-toggle-reconciles-all-slots', () => {
  it('staffs conductor on the left project before staffing the toggled right project', () => {
    const capped = stateAtAgentCapacity()
    const template = capped.agents[0]!
    const projectA = clientProject(0, 'proj-a', {
      useConductor: true,
      roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 1 },
    })
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

    expect(after.agents.some((a) => a.projectId === projectA.id && a.job === 'conductor')).toBe(true)
  })

  it('pulls an idle roster agent when toggling conductor on an empty project', () => {
    const capped = stateAtAgentCapacity()
    const template = capped.agents[0]!
    const projectA = clientProject(0, 'proj-a', {
      roleCounts: { refine: 1, code: 1, review: 0, test: 0, conductor: 0 },
    })
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
