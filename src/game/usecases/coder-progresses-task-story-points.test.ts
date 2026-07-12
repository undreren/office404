import { describe, expect, it } from 'vitest'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Task } from '../types'

describe('coder-progresses-task-story-points', () => {
  it('matches use case invariants', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-code',
      projectId: project.id,
      requirementId: req.id,
      title: 'Code me',
      storyPointsRequired: 5,
      storyPointsEarned: 0,
      complexity: 2,
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
    }
    const before = {
      ...base,
      projects: [
        {
          ...project,
          tasks: [task],
          roleCounts: { refine: 0, code: 1, review: 0, test: 0, conductor: 0 },
        },
      ],
      agents: base.agents.map((a) => ({
        ...a,
        job: 'code' as const,
        projectId: project.id,
        status: 'working' as const,
        taskId: task.id,
        contextUsed: 0,
        compactingRemainingSec: 0,
      })),
    }
    const earnedBefore = before.projects[0]!.tasks[0]!.storyPointsEarned

    const state = dispatchChain(before, [timeElapsed(T0 + 1000, 30)])

    expect(state.projects[0]!.tasks[0]!.storyPointsEarned).toBeGreaterThan(earnedBefore)
  })
})
