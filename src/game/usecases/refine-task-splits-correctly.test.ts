import { describe, expect, it } from 'vitest'
import { refineTaskToTasks } from '../projects'
import { ctxFrom } from '../simulation/simCtx'
import type { GameState, Task } from '../types'
import { initialPlaying } from './_helpers/initialPlaying'

function refinableTask(projectId: string, requirementId: string): Task {
  return {
    id: 'task-big',
    projectId,
    requirementId,
    title: 'Monolithic login',
    storyPointsRequired: 5,
    storyPointsEarned: 0,
    complexity: 3,
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
    refinePassesRemaining: 1,
  }
}

describe('refine-task-splits-correctly', () => {
  it('splits a refinable task into fibonacci subtasks that sum to the original SP', () => {
    const state = initialPlaying()
    const project = state.projects[0]!
    const task = refinableTask(project.id, project.requirements[0]!.id)
    const ctx = ctxFrom(state as GameState)

    const split = refineTaskToTasks(ctx, task)

    expect(split).toHaveLength(2)
    expect(split[0]!.storyPointsRequired + split[1]!.storyPointsRequired).toBe(5)
    expect(split.every((t) => t.refinePassesRemaining === 0)).toBe(true)
    expect(split.every((t) => t.requirementId === task.requirementId)).toBe(true)
  })
})
