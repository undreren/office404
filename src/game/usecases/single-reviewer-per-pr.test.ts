import { describe, expect, it } from 'vitest'
import { timeElapsed } from '../messages'
import { activeReviewerForTask, pickReviewTask } from '../projects'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Agent, GameState, Task } from '../types'

function prReadyTask(projectId: string, requirementId: string): Task {
  return {
    id: 'task-review',
    projectId,
    requirementId,
    title: 'Review me',
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
}

function reviewAgent(id: string, projectId: string, taskId: string | null, overrides: Partial<Agent> = {}): Agent {
  return {
    id,
    name: id,
    personality: 'testy',
    job: 'review',
    projectId,
    taskId,
    status: taskId ? 'reviewing' : 'idle',
    contextUsed: 0,
    compactingRemainingSec: 0,
    jobProgress: 0.05,
    jobDuration: 0.2,
    uptime: 0,
    isAutomation: false,
    ...overrides,
  }
}

describe('single-reviewer-per-pr', () => {
  it('only one review agent may claim a pr_ready task', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const task = prReadyTask(project.id, project.requirements[0]!.id)
    const agents = [
      reviewAgent('rev-1', project.id, task.id),
      reviewAgent('rev-2', project.id, task.id),
    ]

    expect(activeReviewerForTask(task, agents)?.id).toBe('rev-1')
    expect(pickReviewTask({ ...project, tasks: [task] }, 'rev-1', agents)).toEqual(task)
    expect(pickReviewTask({ ...project, tasks: [task] }, 'rev-2', agents)).toBeNull()
  })

  it('second staffed reviewer idles when only one PR is ready', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const task = prReadyTask(project.id, project.requirements[0]!.id)
    const state: GameState = {
      ...base,
      projects: [
        {
          ...project,
          tasks: [task],
          roleCounts: { refine: 0, code: 0, review: 2, test: 0, conductor: 0 },
        },
      ],
      agents: [
        reviewAgent('rev-1', project.id, task.id),
        reviewAgent('rev-2', project.id, task.id),
      ],
    }

    const after = dispatchChain(state, [timeElapsed(T0 + 1000, 1)])

    const reviewers = after.agents.filter((a) => a.job === 'review' && a.projectId === project.id)
    const active = reviewers.filter((a) => a.status === 'reviewing' && a.taskId === task.id)
    expect(active).toHaveLength(1)
    expect(reviewers.some((a) => a.status === 'idle' && a.taskId === null)).toBe(true)
  })
})
