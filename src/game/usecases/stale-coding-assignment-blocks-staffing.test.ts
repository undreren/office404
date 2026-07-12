import { describe, expect, it } from 'vitest'
import { adjustRoleCountMsg } from '../messages'
import {
  pickCodingTask,
  repairStaleCodingAssignments,
  roleCanAcceptStaffing,
} from '../projects'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { GameState, Task } from '../types'

describe('stale-coding-assignment-blocks-staffing', () => {
  it('treats orphaned assignedAgentId as available coding work', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-code',
      projectId: project.id,
      requirementId: req.id,
      title: 'CI pipeline config that finishes before retirement',
      storyPointsRequired: 20,
      storyPointsEarned: 13,
      complexity: 2,
      refined: true,
      status: 'in_progress',
      assignedAgentId: 'agent-orphan',
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
    const agents = base.agents.map((a) => ({
      ...a,
      job: null,
      projectId: null,
      status: 'idle' as const,
      taskId: null,
    }))

    expect(pickCodingTask({ ...project, tasks: [task] }, agents[0]!.id, agents)).toEqual(task)
    expect(roleCanAcceptStaffing({ ...project, tasks: [task] }, 'code', agents)).toBe(true)

    const repaired = repairStaleCodingAssignments([{ ...project, tasks: [task] }], agents)
    expect(repaired[0]!.tasks[0]!.assignedAgentId).toBeNull()
    expect(roleCanAcceptStaffing({ ...repaired[0]!, tasks: repaired[0]!.tasks }, 'code', agents)).toBe(true)
  })

  it('staffs a coder when tasks were orphaned by a prior unassign', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-code',
      projectId: project.id,
      requirementId: req.id,
      title: 'CI pipeline config that finishes before retirement',
      storyPointsRequired: 20,
      storyPointsEarned: 13,
      complexity: 2,
      refined: true,
      status: 'in_progress',
      assignedAgentId: 'agent-orphan',
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
      agents: base.agents.map((a) => ({
        ...a,
        job: null,
        projectId: null,
        status: 'idle' as const,
        taskId: null,
      })),
      projects: [
        {
          ...project,
          requirements: project.requirements.map((r) => ({ ...r, status: 'refined' as const })),
          tasks: [task],
          roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 0 },
        },
      ],
    }

    const state = dispatchChain(before, [adjustRoleCountMsg(T0 + 1000, project.id, 'code', 1)])

    expect(state.projects[0]!.roleCounts.code).toBe(1)
    expect(state.agents[0]!.job).toBe('code')
    expect(state.projects[0]!.tasks[0]!.assignedAgentId).toBeNull()
  })
})
