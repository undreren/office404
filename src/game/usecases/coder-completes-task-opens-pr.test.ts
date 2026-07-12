import { describe, expect, it } from 'vitest'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Task } from '../types'

describe('coder-completes-task-opens-pr', () => {
  it('matches use case invariants', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-pr',
      projectId: project.id,
      requirementId: req.id,
      title: 'Finish me',
      storyPointsRequired: 1,
      storyPointsEarned: 0.9,
      complexity: 1,
      refined: true,
      status: 'in_progress',
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
    let state = {
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

    for (let tick = 0; tick < 100; tick++) {
      state = dispatchChain(state, [timeElapsed(T0 + tick * 5, 5)])
      if (state.projects[0]!.tasks[0]!.status === 'pr_ready') break
    }

    expect(state.projects[0]!.tasks[0]!.status).toBe('pr_ready')
  })
})
