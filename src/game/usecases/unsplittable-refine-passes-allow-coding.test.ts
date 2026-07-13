import { describe, expect, it } from 'vitest'
import { canRefineTask, pickCodingTask, taskLifecycleLabel } from '../projects'
import { initialPlaying } from './_helpers/initialPlaying'
import type { Task } from '../types'

describe('unsplittable-refine-passes-allow-coding', () => {
  it('does not treat 1-SP tasks with refine passes as refinable', () => {
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

    expect(canRefineTask(task)).toBe(false)
    expect(taskLifecycleLabel(task, { ...project, tasks: [task] })).toBe('coding')
  })

  it('lets coders pick 1-SP tasks that cannot be refined', () => {
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

    expect(pickCodingTask(activeProject, 'coder-1', [], 1)).toEqual(task)
  })
})
