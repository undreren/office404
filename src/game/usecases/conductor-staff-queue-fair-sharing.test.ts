import { describe, expect, it } from 'vitest'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Agent, GameState, Project } from '../types'

function conductorProject(slotIndex: number, id: string): Project {
  const base = initialPlaying().projects[0]!
  return {
    ...base,
    id,
    slotIndex,
    clientName: `Client ${slotIndex}`,
    isTutorial: false,
    kind: 'client',
    useConductor: true,
    roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 0 },
    requirements: base.requirements.map((r) => ({
      ...r,
      status: 'open' as const,
      refineJobProgress: 0,
      refineJobDuration: 0,
    })),
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

describe('conductor-staff-queue-fair-sharing', () => {
  it('alternates conductor staffing when both projects need one and share idle agents', () => {
    const base = initialPlaying()
    const template = base.agents[0]!
    const projectA = conductorProject(0, 'proj-a')
    const projectB = conductorProject(1, 'proj-b')

    const before: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      projects: [projectA, projectB],
      agents: [
        idleRefiner(template, 'refine-a', projectA.id),
        idleRefiner({ ...template, name: 'Refiner B' }, 'refine-b', projectB.id),
      ],
    }

    const after = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    expect(after.agents.some((a) => a.projectId === projectA.id && a.job === 'conductor')).toBe(true)
    expect(after.agents.some((a) => a.projectId === projectB.id && a.job === 'conductor')).toBe(true)
  })

  it('prioritizes unallocated work over extra staffing on another project', () => {
    const base = initialPlaying()
    const template = base.agents[0]!
    const projectA = conductorProject(0, 'proj-a')
    const projectB = conductorProject(1, 'proj-b')

    const before: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      conductorStaffQueueCursor: 0,
      projects: [projectA, projectB],
      agents: [
        {
          ...template,
          id: 'conductor-a',
          job: 'conductor',
          projectId: projectA.id,
          status: 'conducting',
          taskId: null,
        },
        idleRefiner(template, 'refine-a', projectA.id),
        idleRefiner({ ...template, name: 'Refiner B' }, 'refine-b', projectB.id),
      ],
    }

    const after = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    expect(after.agents.some((a) => a.projectId === projectB.id && a.job === 'conductor')).toBe(true)
    expect(after.agents.some((a) => a.projectId === projectB.id && a.job === 'refine')).toBe(false)
  })

  it('advances the queue cursor when multiple projects compete for one roster agent', () => {
    const base = initialPlaying()
    const template = base.agents[0]!
    const projectA = conductorProject(0, 'proj-a')
    const projectB = conductorProject(1, 'proj-b')

    const before: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      conductorStaffQueueCursor: 0,
      projects: [projectA, projectB],
      agents: [
        {
          ...template,
          id: 'conductor-a',
          job: 'conductor',
          projectId: projectA.id,
          status: 'conducting',
          taskId: null,
        },
        {
          ...template,
          id: 'conductor-b',
          name: 'Conductor B',
          job: 'conductor',
          projectId: projectB.id,
          status: 'conducting',
          taskId: null,
        },
        {
          ...template,
          id: 'bench',
          name: 'Bench',
          job: null,
          projectId: null,
          status: 'idle',
          taskId: null,
        },
      ],
    }

    const after = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    expect(after.agents.filter((a) => a.job === 'refine').length).toBe(1)
    expect(after.conductorStaffQueueCursor).toBe(1)
  })
})
