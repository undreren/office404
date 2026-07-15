import { describe, expect, it } from 'vitest'
import { buyVibingCourseMsg, timeElapsed, toggleSpecialistRoleMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'
import type { Agent, GameState, Task } from '../types'

describe('conductor-reassigns-after-conductor-yeeted', () => {
  it('restaffs conductor and reassigns idle workers when roleCounts.conductor is 0 but useConductor is true', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const template = base.agents[0]!

    const prReadyTask: Task = {
      id: 'task-pr',
      projectId: project.id,
      requirementId: project.requirements[0]!.id,
      title: 'Awaiting review',
      storyPointsRequired: 5,
      storyPointsEarned: 5,
      complexity: 4,
      refined: true,
      status: 'pr_ready',
      assignedAgentId: null,
      completedByAgentId: 'coder-a',
      parentTaskId: null,
      prQuality: null,
      prQualityStaging: 50,
      hasUndiscoveredBug: false,
      bugDiscovered: false,
      isBugFix: false,
      sourceTaskId: null,
      isReviewComment: false,
      reviewed: false,
      testStoryPointsEarned: 0,
      refinePassesRemaining: 0,
    }

    const coderA: Agent = {
      ...template,
      id: 'coder-a',
      job: 'code',
      projectId: project.id,
      status: 'idle',
      taskId: null,
      contextUsed: 0,
      compactingRemainingSec: 0,
    }
    const coderB: Agent = {
      ...template,
      id: 'coder-b',
      job: 'code',
      projectId: project.id,
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
          roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 0 },
          requirements: project.requirements.map((r) => ({ ...r, status: 'refined' as const })),
          tasks: [prReadyTask],
        },
      ],
      agents: [coderA, coderB],
    }

    const state = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    const conductor = state.agents.find((a) => a.projectId === project.id && a.job === 'conductor')
    const reviewer = state.agents.find((a) => a.projectId === project.id && a.job === 'review')

    expect(conductor).toBeTruthy()
    expect(reviewer).toBeTruthy()
    expect(state.agents.filter((a) => a.projectId === project.id && a.job === 'code' && a.status === 'idle').length).toBeLessThan(2)
  })

  it('does not yeet the conductor when conductor mode is on and roster needs a specialist slot', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const template = base.agents[0]!
    const withConductor = dispatchChain(stateWithCash(base, 2000), [
      buyVibingCourseMsg(T0 + 1000, 'conductor'),
      buyVibingCourseMsg(T0 + 1500, 'marketing'),
    ])
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
    const coder: Agent = {
      ...template,
      id: 'coder-a',
      job: 'code',
      projectId: project.id,
      status: 'idle',
      taskId: null,
      contextUsed: 0,
      compactingRemainingSec: 0,
    }

    const before: GameState = {
      ...withConductor,
      projects: [
        {
          ...project,
          useConductor: true,
          roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 1 },
        },
      ],
      agents: [conductor, coder],
    }

    const state = dispatchChain(before, [toggleSpecialistRoleMsg(T0 + 2000, 'marketing', true)])

    expect(state.agents.some((a) => a.id === conductor.id && a.job === 'conductor')).toBe(true)
    expect(state.agents.some((a) => a.isAutomation && a.automationJob === 'marketing')).toBe(true)
    expect(state.agents.some((a) => a.id === coder.id)).toBe(false)
  })
})
