import { describe, expect, it } from 'vitest'
import {
  buyVibingCourseMsg,
  returnFromHiddenMsg,
  syncOfflineSpecialistMsg,
  timeElapsed,
} from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'
import type { Agent, GameState, Task } from '../types'

const AWAY_SEC = 60

type WorkSnapshot = {
  gameDay: number
  cash: number
  storyPointsEarned: number
  taskStatus: Task['status']
  productiveAgents: number
  offlineSpecialistAssigned: boolean
}

function workSnapshot(state: GameState, projectId: string, taskId: string): WorkSnapshot {
  const project = state.projects.find((p) => p.id === projectId)!
  const task = project.tasks.find((t) => t.id === taskId)!
  return {
    gameDay: state.gameDay,
    cash: state.cash,
    storyPointsEarned: task.storyPointsEarned,
    taskStatus: task.status,
    productiveAgents: state.agents.filter((a) => !a.isAutomation).length,
    offlineSpecialistAssigned: state.assignedSpecialistRoles.includes('offline'),
  }
}

function cloneCoder(
  template: Agent,
  id: string,
  projectId: string,
  taskId: string | null,
  status: Agent['status'] = 'working',
): Agent {
  return {
    ...template,
    id,
    job: 'code',
    projectId,
    status,
    taskId,
    contextUsed: 0,
    compactingRemainingSec: 0,
    isAutomation: false,
    automationJob: undefined,
  }
}

function buildWorkState(coderCount: number, agentSlotPurchases: number): GameState {
  const base = stateWithCash(initialPlaying(), 10_000)
  const enrolled = dispatchChain(base, [buyVibingCourseMsg(T0 + 100, 'offline')])

  const project = enrolled.projects[0]!
  const req = project.requirements[0]!
  const task: Task = {
    id: 'task-code',
    projectId: project.id,
    requirementId: req.id,
    title: 'Code me',
    storyPointsRequired: 20,
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

  const template = enrolled.agents[0]!
  const coders =
    coderCount === 1
      ? [cloneCoder(template, 'coder-1', project.id, task.id)]
      : [
          cloneCoder(template, 'coder-1', project.id, task.id),
          cloneCoder(template, 'coder-2', project.id, null, 'idle'),
        ]

  return {
    ...enrolled,
    agentSlotPurchases,
    projects: [
      {
        ...project,
        tasks: [task],
        roleCounts: { refine: 0, code: coderCount, review: 0, test: 0, conductor: 0 },
      },
    ],
    agents: coders,
    snapshotAt: T0,
  }
}

describe('offline-matches-online-wait', () => {
  it('matches waiting online when offline has one extra productive agent for the specialist slot', () => {
    const projectId = initialPlaying().projects[0]!.id
    const taskId = 'task-code'

    // Online: one coder, full roster. Offline: +2 slots and +1 bench coder so the
    // auto-assigned offline specialist does not displace productive capacity.
    const onlineBefore = buildWorkState(1, 0)
    const offlineBefore = buildWorkState(2, 2)

    const onlineAfter = dispatchChain(
      onlineBefore,
      Array.from({ length: AWAY_SEC }, (_, i) => timeElapsed(T0 + 1000 + i, 1)),
    )
    const offlineHidden = dispatchChain(offlineBefore, [syncOfflineSpecialistMsg(T0 + 2000, true)])
    const offlineAfter = dispatchChain(offlineHidden, [
      returnFromHiddenMsg(T0 + 2000 + AWAY_SEC * 1000),
    ])

    expect(offlineHidden.assignedSpecialistRoles).toContain('offline')
    expect(offlineHidden.agents.some((a) => a.automationJob === 'offline')).toBe(true)

    const online = workSnapshot(onlineAfter, projectId, taskId)
    const offline = workSnapshot(offlineAfter, projectId, taskId)

    expect(online.productiveAgents).toBe(1)
    expect(offline.productiveAgents).toBe(2)
    expect(offline.offlineSpecialistAssigned).toBe(false)

    expect(offline.gameDay).toBeCloseTo(online.gameDay, 5)
    expect(offline.cash).toBeCloseTo(online.cash, 5)
    expect(offline.storyPointsEarned).toBeCloseTo(online.storyPointsEarned, 5)
    expect(offline.taskStatus).toBe(online.taskStatus)
  })
})
