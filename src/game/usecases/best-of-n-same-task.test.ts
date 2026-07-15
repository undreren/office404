import { describe, expect, it } from 'vitest'
import { buyVibingCourseMsg, timeElapsed } from '../messages'
import {
  dispatchCodingTask,
  dispatchReviewTask,
} from '../projects'
import { BEST_OF_N_COURSE_ID, vibingCourseCost, VIBING_COURSES } from '../upgrades'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'
import type { Agent, Task } from '../types'

function codeAgent(id: string, projectId: string, taskId: string | null): Agent {
  return {
    id,
    name: id,
    personality: 'testy',
    job: 'code',
    projectId,
    taskId,
    status: taskId ? 'working' : 'idle',
    contextUsed: 0,
    compactingRemainingSec: 0,
    jobProgress: 0,
    jobDuration: 0,
    uptime: 0,
    isAutomation: false,
  }
}

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

describe('best-of-n-same-task', () => {
  it('blocks a second coder on the same task without Best-of-N', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-code',
      projectId: project.id,
      requirementId: req.id,
      title: 'Shared task',
      storyPointsRequired: 5,
      storyPointsEarned: 0,
      complexity: 2,
      refined: true,
      status: 'in_progress',
      assignedAgentId: 'coder-1',
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
    const agents = [codeAgent('coder-1', project.id, task.id), codeAgent('coder-2', project.id, null)]

    const slots = new Map<string, number>()
    expect(dispatchCodingTask({ ...project, tasks: [task] }, 'coder-1', agents, 1, slots)).toEqual(task)
    expect(dispatchCodingTask({ ...project, tasks: [task] }, 'coder-2', agents, 1, slots)).toBeNull()
  })

  it('allows a second coder on the same task at Best-of-N tier 1', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-code',
      projectId: project.id,
      requirementId: req.id,
      title: 'Shared task',
      storyPointsRequired: 5,
      storyPointsEarned: 0,
      complexity: 2,
      refined: true,
      status: 'in_progress',
      assignedAgentId: 'coder-1',
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
    const agents = [codeAgent('coder-1', project.id, task.id), codeAgent('coder-2', project.id, null)]

    const slots = new Map<string, number>()
    expect(dispatchCodingTask({ ...project, tasks: [task] }, 'coder-1', agents, 2, slots)).toEqual(task)
    expect(dispatchCodingTask({ ...project, tasks: [task] }, 'coder-2', agents, 2, slots)).toEqual(task)
  })

  it('allows a second reviewer on the same PR at Best-of-N tier 1', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const task = prReadyTask(project.id, project.requirements[0]!.id)
    const agents: Agent[] = [
      {
        id: 'rev-1',
        name: 'rev-1',
        personality: 'testy',
        job: 'review',
        projectId: project.id,
        taskId: task.id,
        status: 'reviewing',
        contextUsed: 0,
        compactingRemainingSec: 0,
        jobProgress: 0.05,
        jobDuration: 0.2,
        uptime: 0,
        isAutomation: false,
      },
      {
        id: 'rev-2',
        name: 'rev-2',
        personality: 'testy',
        job: 'review',
        projectId: project.id,
        taskId: null,
        status: 'idle',
        contextUsed: 0,
        compactingRemainingSec: 0,
        jobProgress: 0,
        jobDuration: 0,
        uptime: 0,
        isAutomation: false,
      },
    ]

    const slots = new Map<string, number>()
    expect(dispatchReviewTask({ ...project, tasks: [task] }, 'rev-1', agents, 1, slots)).toEqual(task)
    expect(dispatchReviewTask({ ...project, tasks: [task] }, 'rev-2', agents, 1, slots)).toBeNull()
    const slots2 = new Map<string, number>()
    expect(dispatchReviewTask({ ...project, tasks: [task] }, 'rev-1', agents, 2, slots2)).toEqual(task)
    expect(dispatchReviewTask({ ...project, tasks: [task] }, 'rev-2', agents, 2, slots2)).toEqual(task)
  })

  it('purchases Best-of-N up to four tiers with exponential cost', () => {
    const course = VIBING_COURSES.find((c) => c.id === BEST_OF_N_COURSE_ID)!
    expect(course.maxTier).toBe(4)
    expect(vibingCourseCost(course, 0)).toBe(400)
    expect(vibingCourseCost(course, 1)).toBe(720)

    let state = stateWithCash(initialPlaying(), 50_000)
    for (let tier = 1; tier <= 4; tier++) {
      const cost = vibingCourseCost(course, tier - 1)
      state = stateWithCash(state, cost)
      state = dispatchChain(state, [buyVibingCourseMsg(T0 + tier * 1000, BEST_OF_N_COURSE_ID)])
      expect(state.vibingCourseTiers[BEST_OF_N_COURSE_ID]).toBe(tier)
    }

    const blocked = dispatchChain(state, [buyVibingCourseMsg(T0 + 10_000, BEST_OF_N_COURSE_ID)])
    expect(blocked.vibingCourseTiers[BEST_OF_N_COURSE_ID]).toBe(4)
  })
})

function taskInProgress(projectId: string, requirementId: string): Task {
  return {
    id: 'task-code',
    projectId,
    requirementId,
    title: 'Shared task',
    storyPointsRequired: 20,
    storyPointsEarned: 0,
    complexity: 2,
    refined: true,
    status: 'in_progress',
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
}

describe('best-of-n compaction', () => {
  it('keeps task progress when one of two coders compacts', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task = taskInProgress(project.id, req.id)
    const before = {
      ...base,
      vibingCourseTiers: { ...base.vibingCourseTiers, best_of_n: 1 },
      projects: [
        {
          ...project,
          tasks: [task],
          roleCounts: { refine: 0, code: 2, review: 0, test: 0, conductor: 0 },
        },
      ],
      agents: [
        {
          ...codeAgent('coder-1', project.id, task.id),
          contextUsed: 3995,
        },
        codeAgent('coder-2', project.id, task.id),
      ],
    }

    const withProgress = dispatchChain(before, [timeElapsed(T0 + 50, 2)])
    const beforeCompact = {
      ...withProgress,
      agents: withProgress.agents.map((a, i) =>
        i === 0 ? { ...a, contextUsed: 3995 } : a,
      ),
    }

    const afterCompact = dispatchChain(beforeCompact, [timeElapsed(T0 + 100, 5)])
    expect(afterCompact.agents[0]!.status).toBe('compacting')
    const earnedWhilePeerDown = afterCompact.projects[0]!.tasks[0]!.storyPointsEarned
    expect(earnedWhilePeerDown).toBeGreaterThan(0)

    const afterReboot = dispatchChain(afterCompact, [timeElapsed(T0 + 200, 35)])
    const earnedBeforeReboot = afterCompact.projects[0]!.tasks[0]!.storyPointsEarned
    expect(afterReboot.agents[0]!.status).not.toBe('compacting')
    expect(afterReboot.projects[0]!.tasks[0]!.storyPointsEarned).toBeGreaterThanOrEqual(
      earnedBeforeReboot,
    )
  })
})
