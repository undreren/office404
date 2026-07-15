import { describe, expect, it } from 'vitest'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import { withTokenProgress } from './_helpers/taskTokens'

describe('reviewed-pr-auto-merges-on-tick', () => {
  it('merges a reviewed pr_ready task once all review comments are addressed', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const parent = withTokenProgress(
      {
        id: 'task-parent',
        projectId: project.id,
        requirementId: req.id,
        title: 'Ship it',
        storyPointsRequired: 3,
        storyPointsEarned: 0,
        complexity: 2,
        refined: true,
        status: 'pr_ready',
        assignedAgentId: null,
        completedByAgentId: 'agt-x',
        parentTaskId: null,
        prQuality: null,
        prQualityStaging: 80,
        hasUndiscoveredBug: false,
        bugDiscovered: false,
        isBugFix: false,
        sourceTaskId: null,
        isReviewComment: false,
        reviewed: true,
        testStoryPointsEarned: 0,
      },
      'code',
    )
    const comment = withTokenProgress(
      {
        id: 'task-comment',
        projectId: project.id,
        requirementId: null,
        title: 'Needs more blockchain',
        storyPointsRequired: 0.5,
        storyPointsEarned: 0,
        complexity: 0,
        refined: true,
        status: 'done',
        assignedAgentId: null,
        completedByAgentId: 'agt-y',
        parentTaskId: parent.id,
        prQuality: null,
        prQualityStaging: 0,
        hasUndiscoveredBug: false,
        bugDiscovered: false,
        isBugFix: false,
        sourceTaskId: null,
        isReviewComment: true,
        reviewed: true,
        testStoryPointsEarned: 0,
      },
      'code',
    )
    const before = {
      ...base,
      projects: [{ ...project, tasks: [parent, comment] }],
    }

    const after = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    expect(after.projects[0]!.tasks.find((t) => t.id === parent.id && !t.isReviewComment)?.status).toBe(
      'merged',
    )
    expect(after.stats.tasksMerged).toBe(before.stats.tasksMerged + 1)
  })
})
