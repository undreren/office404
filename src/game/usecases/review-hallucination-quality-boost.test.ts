import { describe, expect, it } from 'vitest'
import { PR_QUALITY_PER_COMMENT } from '../constants'
import { prQualityAfterComments } from '../mechanics'
import { effectiveReviewCommentResolutions, stagedPrQualityFromReviews } from '../projects'
import { mergePrMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Task } from '../types'

describe('review-hallucination-quality-boost', () => {
  it('counts suppressed comments as addressed for staged quality', () => {
    const project = initialPlaying().projects[0]!
    const parent: Task = {
      id: 'task-parent',
      projectId: project.id,
      requirementId: project.requirements[0]!.id,
      title: 'Ship it',
      storyPointsRequired: 13,
      storyPointsEarned: 13,
      complexity: 2,
      refined: true,
      status: 'pr_ready',
      assignedAgentId: null,
      completedByAgentId: 'agt-x',
      parentTaskId: null,
      prQuality: null,
      prQualityStaging: 70,
      prQualityBase: 70,
      reviewCommentsSuppressed: 2,
      hasUndiscoveredBug: false,
      bugDiscovered: false,
      isBugFix: false,
      sourceTaskId: null,
      isReviewComment: false,
      reviewed: true,
      testStoryPointsEarned: 0,
    }

    expect(effectiveReviewCommentResolutions({ ...project, tasks: [parent] }, parent)).toBe(2)
    expect(stagedPrQualityFromReviews({ ...project, tasks: [parent] }, parent)).toBe(
      prQualityAfterComments(70, 2),
    )
  })

  it('merges with quality from suppressed comments without coding them', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const parent: Task = {
      id: 'task-parent',
      projectId: project.id,
      requirementId: project.requirements[0]!.id,
      title: 'Ship it',
      storyPointsRequired: 13,
      storyPointsEarned: 13,
      complexity: 2,
      refined: true,
      status: 'pr_ready',
      assignedAgentId: null,
      completedByAgentId: 'agt-x',
      parentTaskId: null,
      prQuality: null,
      prQualityStaging: 70,
      prQualityBase: 70,
      reviewCommentsSuppressed: 2,
      hasUndiscoveredBug: false,
      bugDiscovered: false,
      isBugFix: false,
      sourceTaskId: null,
      isReviewComment: false,
      reviewed: true,
      testStoryPointsEarned: 0,
    }
    const before = {
      ...base,
      projects: [{ ...project, tasks: [parent] }],
    }

    const after = dispatchChain(before, [mergePrMsg(T0 + 1000, parent.id)])
    const merged = after.projects[0]!.tasks.find((t) => t.id === parent.id)

    expect(merged?.status).toBe('merged')
    expect(merged?.prQuality).toBe(70 + 2 * PR_QUALITY_PER_COMMENT)
  })
})
