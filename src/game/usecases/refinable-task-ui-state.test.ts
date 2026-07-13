import { describe, expect, it } from 'vitest'
import {
  pickCodingTask,
  taskLifecycleLabel,
  taskLifecycleProgressPct,
  taskNeedsRefinement,
  taskRefineProgressPct,
} from '../projects'
import type { Agent, Task } from '../types'
import { initialPlaying } from './_helpers/initialPlaying'

function refinableTask(projectId: string, requirementId: string): Task {
  return {
    id: 'task-refine-me',
    projectId,
    requirementId,
    title: 'Still too big',
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

function readyTask(projectId: string, requirementId: string): Task {
  return {
    ...refinableTask(projectId, requirementId),
    id: 'task-ready',
    title: 'Ready to code',
    storyPointsRequired: 2,
    refinePassesRemaining: 0,
  }
}

describe('refinable task UI state', () => {
  const baseProject = initialPlaying().projects[0]!
  const projectId = baseProject.id
  const requirementId = baseProject.requirements[0]!.id
  const project = {
    ...baseProject,
    tasks: [refinableTask(projectId, requirementId), readyTask(projectId, requirementId)],
  }

  it('labels refinable tasks as refining and tracks refiner progress', () => {
    const task = project.tasks[0]!
    const refiner: Agent = {
      id: 'refiner-1',
      name: 'Split Bot',
      job: 'refine',
      projectId,
      taskId: task.id,
      status: 'refining',
      jobProgress: 1.5,
      jobDuration: 3,
    } as Agent

    expect(taskNeedsRefinement(task)).toBe(true)
    expect(taskLifecycleLabel(task, project)).toBe('refining')
    expect(taskRefineProgressPct(task, project, [refiner])).toBe(50)
    expect(taskLifecycleProgressPct(task, project, [refiner])).toBe(50)
  })

  it('blocks coders from picking refinable tasks', () => {
    const coder: Agent = {
      id: 'coder-1',
      name: 'Coder',
      job: 'code',
      projectId,
      status: 'idle',
      taskId: null,
    } as Agent

    const picked = pickCodingTask(project, coder.id, [coder])
    expect(picked?.id).toBe('task-ready')
  })
})
