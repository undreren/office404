import { describe, expect, it } from 'vitest'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Agent, GameState, Task } from '../types'

describe('conductor-prioritizes-test-when-qa-backlog', () => {
  it('staffs a tester before idle coders when merged PRs need QA', () => {
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
    const task: Task = {
      id: 'task-merged-qa',
      projectId: project.id,
      requirementId: project.requirements[0]!.id,
      title: 'Needs QA',
      storyPointsRequired: 2,
      storyPointsEarned: 2,
      complexity: 1,
      refined: true,
      status: 'merged',
      assignedAgentId: null,
      completedByAgentId: 'agt-x',
      parentTaskId: null,
      prQuality: 80,
      prQualityStaging: 80,
      hasUndiscoveredBug: false,
      bugDiscovered: false,
      isBugFix: false,
      sourceTaskId: null,
      isReviewComment: false,
      reviewed: true,
      testStoryPointsEarned: 0,
    }

    const before: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      projects: [
        {
          ...project,
          useConductor: true,
          roleCounts: { refine: 0, code: 1, review: 0, test: 0, conductor: 1 },
          requirements: project.requirements.map((r) => ({ ...r, status: 'refined' as const })),
          tasks: [
            task,
            {
              id: 'task-open-code',
              projectId: project.id,
              requirementId: project.requirements[0]!.id,
              title: 'Still coding',
              storyPointsRequired: 3,
              storyPointsEarned: 0,
              complexity: 1,
              refined: true,
              status: 'open',
              assignedAgentId: null,
              completedByAgentId: null,
              parentTaskId: null,
              prQuality: null,
              prQualityStaging: 0,
              hasUndiscoveredBug: false,
              bugDiscovered: false,
              isBugFix: false,
              sourceTaskId: null,
              isReviewComment: false,
              reviewed: false,
              testStoryPointsEarned: 0,
              refinePassesRemaining: 0,
            },
          ],
          testStoryPointsRequired: 2,
          testStoryPointsCompleted: 0,
        },
      ],
      agents: [conductor, coder],
    }

    const state = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])
    const tester = state.agents.find((a) => a.projectId === project.id && a.job === 'test')

    expect(tester).toBeTruthy()
  })
})
