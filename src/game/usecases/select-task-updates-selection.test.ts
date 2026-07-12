import { describe, expect, it } from 'vitest'
import { selectTaskMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Task } from '../types'

describe('select-task-updates-selection', () => {
  it('matches use case invariants', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-select',
      projectId: project.id,
      requirementId: req.id,
      title: 'Selectable',
      storyPointsRequired: 2,
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
    const before = { ...base, projects: [{ ...project, tasks: [task] }] }

    const state = dispatchChain(before, [selectTaskMsg(T0 + 1000, task.id)])

    expect(state.selectedTaskId).toBe(task.id)
  })
})
