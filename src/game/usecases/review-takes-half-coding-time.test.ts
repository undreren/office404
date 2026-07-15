import { describe, expect, it } from 'vitest'
import { timeElapsed } from '../messages'
import { taskTokensRequired } from '../mechanics'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { GameState, Task } from '../types'

describe('review-takes-half-coding-time', () => {
  it('does not instantly complete review from coding token progress', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const sp = 3
    const codeTokens = taskTokensRequired(sp, 'code')
    const reviewTokens = taskTokensRequired(sp, 'review')
    const task: Task = {
      id: 'task-review',
      projectId: project.id,
      requirementId: req.id,
      title: 'Review me',
      storyPointsRequired: sp,
      storyPointsEarned: codeTokens,
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
    let state: GameState = {
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
        jobDuration: 0,
      })),
    }

    state = dispatchChain(state, [timeElapsed(T0, 0.1)])

    const updated = state.projects[0]!.tasks.find((t) => t.id === task.id)!
    expect(updated.reviewed).toBe(false)
    expect(updated.reviewJobProgress ?? 0).toBeLessThan(reviewTokens)
    expect(codeTokens).toBeGreaterThan(reviewTokens)
  })
})
