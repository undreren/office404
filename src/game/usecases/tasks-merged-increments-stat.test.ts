import { describe, expect, it } from 'vitest'
import { mergePrMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Task } from '../types'

describe('tasks-merged-increments-stat', () => {
  it('matches use case invariants', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-stat',
      projectId: project.id,
      requirementId: req.id,
      title: 'Stat task',
      storyPointsRequired: 2,
      storyPointsEarned: 2,
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
      reviewed: true,
      testStoryPointsEarned: 0,
    }
    const before = {
      ...base,
      projects: [{ ...project, tasks: [task] }],
    }

    const state = dispatchChain(before, [mergePrMsg(T0 + 1000, task.id)])

    expect(state.stats.tasksMerged).toBe(before.stats.tasksMerged + 1)
  })
})
