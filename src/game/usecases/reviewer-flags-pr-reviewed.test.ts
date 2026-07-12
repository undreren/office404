import { describe, expect, it } from 'vitest'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Task } from '../types'

describe('reviewer-flags-pr-reviewed', () => {
  it('matches use case invariants', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-review',
      projectId: project.id,
      requirementId: req.id,
      title: 'Review me',
      storyPointsRequired: 3,
      storyPointsEarned: 3,
      complexity: 2,
      refined: true,
      status: 'pr_ready',
      assignedAgentId: null,
      completedByAgentId: 'agt-x',
      parentTaskId: null,
      prQuality: null,
      prQualityStaging: 70,
      hasUndiscoveredBug: false,
      bugDiscovered: false,
      isBugFix: false,
      sourceTaskId: null,
      isReviewComment: false,
      reviewed: false,
      testStoryPointsEarned: 0,
    }
    let state = {
      ...base,
      projects: [
        {
          ...project,
          tasks: [task],
          roleCounts: { refine: 0, code: 0, review: 1, test: 0, conductor: 0 },
        },
      ],
      agents: base.agents.map((a) => ({
        ...a,
        job: 'review' as const,
        projectId: project.id,
        status: 'reviewing' as const,
        taskId: task.id,
        contextUsed: 0,
        compactingRemainingSec: 0,
        jobProgress: 0,
        jobDuration: 0.1,
      })),
    }

    for (let tick = 0; tick < 100; tick++) {
      state = dispatchChain(state, [timeElapsed(T0 + tick * 5, 5)])
      if (state.projects[0]!.tasks.find((t) => t.id === task.id)?.reviewed) break
    }

    expect(state.projects[0]!.tasks.find((t) => t.id === task.id)?.reviewed).toBe(true)
  })
})
