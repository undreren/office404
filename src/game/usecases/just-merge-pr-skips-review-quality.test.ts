import { describe, expect, it } from 'vitest'
import { JUST_MERGE_PR_QUALITY } from '../constants'
import { justMergePrMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Task } from '../types'

describe('just-merge-pr-skips-review-quality', () => {
  it('matches use case invariants', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-yolo',
      projectId: project.id,
      requirementId: req.id,
      title: 'YOLO merge',
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
    const before = {
      ...base,
      projects: [{ ...project, tasks: [task] }],
    }

    const state = dispatchChain(before, [justMergePrMsg(T0 + 1000, task.id)])
    const merged = state.projects[0]!.tasks.find((t) => t.id === task.id)!

    expect(merged.status).toBe('merged')
    expect(merged.prQuality).toBe(JUST_MERGE_PR_QUALITY)
  })
})
