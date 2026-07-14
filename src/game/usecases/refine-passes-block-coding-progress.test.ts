import { describe, expect, it } from 'vitest'
import { timeElapsed } from '../messages'
import { taskNeedsRefinement } from '../projects'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Agent, GameState, Task } from '../types'

describe('refine-passes-block-coding-progress', () => {
  it('does not advance story points on tasks that still need refine passes', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const template = base.agents[0]!
    const task: Task = {
      id: 'task-stuck',
      projectId: project.id,
      requirementId: project.requirements[0]!.id,
      title: 'Should not code yet',
      storyPointsRequired: 2,
      storyPointsEarned: 0.5,
      complexity: 2,
      refined: true,
      status: 'in_progress',
      assignedAgentId: 'coder-1',
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
      refinePassesRemaining: 2,
    }
    const coder: Agent = {
      ...template,
      id: 'coder-1',
      job: 'code',
      projectId: project.id,
      status: 'working',
      taskId: task.id,
      contextUsed: 0,
      compactingRemainingSec: 0,
    }

    expect(taskNeedsRefinement(task)).toBe(true)

    const before: GameState = {
      ...base,
      projects: [
        {
          ...project,
          tasks: [task],
          roleCounts: { refine: 0, code: 1, review: 0, test: 0, conductor: 0 },
        },
      ],
      agents: [coder],
    }

    const after = dispatchChain(before, [timeElapsed(T0 + 1000, 30)])
    const updated = after.projects[0]!.tasks[0]!

    expect(updated.storyPointsEarned).toBe(0.5)
    expect(updated.status).toBe('in_progress')
    expect(updated.status).not.toBe('pr_ready')
  })
})
