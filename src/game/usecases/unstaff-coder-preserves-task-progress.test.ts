import { describe, expect, it } from 'vitest'
import { adjustRoleCountMsg, timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { GameState, Task } from '../types'

describe('unstaff-coder-preserves-task-progress', () => {
  it('keeps story points and releases the task when a working coder is unstaffed', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-code',
      projectId: project.id,
      requirementId: req.id,
      title: 'Code me',
      storyPointsRequired: 5,
      storyPointsEarned: 2,
      complexity: 2,
      refined: true,
      status: 'in_progress',
      assignedAgentId: 'agent-1',
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
    const before: GameState = {
      ...base,
      projects: [
        {
          ...project,
          tasks: [task],
          roleCounts: { refine: 0, code: 1, review: 0, test: 0, conductor: 0 },
        },
      ],
      agents: base.agents.map((a) => ({
        ...a,
        id: 'agent-1',
        job: 'code' as const,
        projectId: project.id,
        status: 'working' as const,
        taskId: task.id,
        contextUsed: 0,
        compactingRemainingSec: 0,
      })),
    }

    const state = dispatchChain(before, [adjustRoleCountMsg(T0 + 1000, project.id, 'code', -1)])
    const updatedTask = state.projects[0]!.tasks[0]!

    expect(updatedTask.storyPointsEarned).toBe(2)
    expect(updatedTask.status).toBe('in_progress')
    expect(updatedTask.assignedAgentId).toBeNull()
    expect(state.agents[0]!.job).toBeNull()
  })

  it('lets a replacement coder resume the same task', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-code',
      projectId: project.id,
      requirementId: req.id,
      title: 'Code me',
      storyPointsRequired: 5,
      storyPointsEarned: 2,
      complexity: 2,
      refined: true,
      status: 'in_progress',
      assignedAgentId: 'agent-1',
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
    const before: GameState = {
      ...base,
      projects: [
        {
          ...project,
          tasks: [task],
          roleCounts: { refine: 0, code: 1, review: 0, test: 0, conductor: 0 },
        },
      ],
      agents: base.agents.map((a) => ({
        ...a,
        id: 'agent-1',
        job: 'code' as const,
        projectId: project.id,
        status: 'working' as const,
        taskId: task.id,
        contextUsed: 0,
        compactingRemainingSec: 0,
      })),
    }

    const unstaffed = dispatchChain(before, [adjustRoleCountMsg(T0 + 1000, project.id, 'code', -1)])
    const restaffed = dispatchChain(unstaffed, [adjustRoleCountMsg(T0 + 2000, project.id, 'code', 1)])
    const progressed = dispatchChain(restaffed, [timeElapsed(T0 + 3000, 30)])

    expect(progressed.projects[0]!.tasks[0]!.storyPointsEarned).toBeGreaterThan(2)
  })
})
