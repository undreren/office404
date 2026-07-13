import { describe, expect, it } from 'vitest'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Agent, GameState, Project } from '../types'

function conductorProject(index: number, id: string): Project {
  const base = initialPlaying().projects[0]!
  return {
    ...base,
    id,
    clientName: `Client ${index}`,
    isTutorial: false,
    kind: 'client',
    useConductor: true,
    roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 0 },
    requirements: base.requirements.map((r) => ({ ...r, status: 'open' as const, refineJobProgress: 0, refineJobDuration: 0 })),
    tasks: [],
  }
}

function idleRefiner(template: Agent, id: string, projectId: string): Agent {
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

describe('conductor-staffs-left-to-right-without-stealing', () => {
  it('does not steal idle workers from a right project to staff a conductor on the left', () => {
    const base = initialPlaying()
    const template = base.agents[0]!
    const projectA = conductorProject(1, 'proj-a')
    const projectB = conductorProject(2, 'proj-b')

    const before: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      projects: [projectA, projectB],
      agents: [idleRefiner(template, 'refine-b', projectB.id)],
    }

    const after = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    expect(after.agents.some((a) => a.projectId === projectA.id && a.job === 'conductor')).toBe(false)
    expect(after.agents.some((a) => a.projectId === projectB.id && a.job === 'conductor')).toBe(true)
  })

  it('staffs the left project first when both have idle agents without cross-project stealing', () => {
    const base = initialPlaying()
    const template = base.agents[0]!
    const projectA = conductorProject(1, 'proj-a')
    const projectB = conductorProject(2, 'proj-b')

    const before: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      projects: [projectA, projectB],
      agents: [
        idleRefiner(template, 'refine-a', projectA.id),
        idleRefiner(template, 'refine-b', projectB.id),
      ],
    }

    const after = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    expect(after.agents.some((a) => a.projectId === projectA.id && a.job === 'conductor')).toBe(true)
    expect(after.agents.some((a) => a.projectId === projectB.id && a.job === 'conductor')).toBe(true)
  })

  it('does not staff a conductor on a project with no manageable work', () => {
    const base = initialPlaying()
    const template = base.agents[0]!
    const projectA = conductorProject(1, 'proj-a')
    const doneProject: Project = {
      ...projectA,
      id: 'proj-done',
      requirements: projectA.requirements.map((r) => ({ ...r, status: 'refined' as const })),
      tasks: projectA.tasks.map((t) => ({ ...t, status: 'merged' as const, refined: true })),
    }

    const before: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      projects: [doneProject],
      agents: [idleRefiner(template, 'refine-a', doneProject.id)],
    }

    const after = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    expect(after.agents.some((a) => a.projectId === doneProject.id && a.job === 'conductor')).toBe(false)
    expect(after.agents.some((a) => a.projectId === doneProject.id && a.job === 'refine')).toBe(true)
  })
})
