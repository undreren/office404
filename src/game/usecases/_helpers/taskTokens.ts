import { taskTokensRequired } from '../../mechanics'
import type { Task, TaskWorkRole } from '../../types'

export function withTokenProgress(task: Task, role: TaskWorkRole = 'code'): Task {
  const required = taskTokensRequired(task.storyPointsRequired, role)
  if (role === 'test') {
    return { ...task, testStoryPointsEarned: required }
  }
  return { ...task, storyPointsEarned: required }
}

export function fullyShippableTask(task: Task): Task {
  const code = taskTokensRequired(task.storyPointsRequired, 'code')
  const test = taskTokensRequired(task.storyPointsRequired, 'test')
  return {
    ...task,
    storyPointsEarned: code,
    testStoryPointsEarned: test,
    status: 'merged',
    reviewed: true,
    prQuality: task.prQuality ?? 80,
    prQualityStaging: task.prQualityStaging ?? 80,
  }
}
