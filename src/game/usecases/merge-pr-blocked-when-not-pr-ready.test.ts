import { describe, expect, it } from 'vitest'
import { mergePrMsg, stateChanged } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Task } from '../types'

describe('merge-pr-blocked-when-not-pr-ready', () => {
  it('matches use case invariants', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-open',
      projectId: project.id,
      requirementId: req.id,
      title: 'Not ready',
      storyPointsRequired: 3,
      storyPointsEarned: 1,
      complexity: 2,
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
    const before = {
      ...base,
      projects: [{ ...project, tasks: [task] }],
    }

    const after = dispatchChain(before, [mergePrMsg(T0 + 1000, task.id)])

    expect(stateChanged(before, after)).toBe(false)
  })
})
