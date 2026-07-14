import { describe, expect, it } from 'vitest'
import {
  canRefineTask,
  pickCodingTask,
  taskLifecycleLabel,
} from '../projects'
import { initialPlaying } from './_helpers/initialPlaying'
import type { Task } from '../types'

describe('unsplittable-refine-passes-require-refining', () => {
  it('treats 1-SP tasks with refine passes as refinable', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const task: Task = {
      ...project.tasks[0]!,
      id: 'task-1',
      title: 'One-point wonder',
      status: 'open',
      storyPointsRequired: 1,
      storyPointsEarned: 0,
      refinePassesRemaining: 1,
      refined: false,
    }

    expect(canRefineTask(task)).toBe(true)
    expect(taskLifecycleLabel(task, { ...project, tasks: [task] })).toBe('refining')
  })

  it('does not let coders pick 1-SP tasks that still need refine passes', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const task: Task = {
      ...project.tasks[0]!,
      id: 'task-1',
      title: 'One-point wonder',
      status: 'open',
      storyPointsRequired: 1,
      storyPointsEarned: 0,
      refinePassesRemaining: 1,
      refined: false,
    }
    const activeProject = { ...project, tasks: [task] }
    const coder = {
      id: 'coder-1',
      name: 'coder-1',
      job: 'code' as const,
      projectId: project.id,
      status: 'idle' as const,
      taskId: null,
      contextUsed: 0,
      compactingRemainingSec: 0,
      jobProgress: 0,
      jobDuration: 0,
      uptime: 0,
      isAutomation: false,
      personality: 'testy',
    }

    expect(pickCodingTask(activeProject, 'coder-1', [coder], 1)).toBeNull()
  })
})
