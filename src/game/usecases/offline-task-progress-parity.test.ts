import { describe, expect, it } from 'vitest'
import { catchUpOfflineMsg, buyVibingCourseMsg, timeElapsed } from '../messages'
import { TICK_INTERVAL_MS } from '../constants'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'
import type { GameState, Task } from '../types'

function codingAgentState(storyPointsRequired = 20): GameState {
  const base = stateWithCash(initialPlaying(), 2000)
  const enrolled = dispatchChain(base, [buyVibingCourseMsg(T0 + 500, 'offline')])
  const project = enrolled.projects[0]!
  const req = project.requirements[0]!
  const task: Task = {
    id: 'task-code',
    projectId: project.id,
    requirementId: req.id,
    title: 'Code me',
    storyPointsRequired,
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
  return {
    ...enrolled,
    projects: [
      {
        ...project,
        tasks: [task],
        roleCounts: { refine: 0, code: 1, review: 0, test: 0, conductor: 0 },
      },
    ],
    agents: enrolled.agents.map((a) => ({
      ...a,
      job: 'code' as const,
      projectId: project.id,
      status: 'working' as const,
      taskId: task.id,
      contextUsed: 0,
      compactingRemainingSec: 0,
    })),
    snapshotAt: T0,
  }
}

function taskEarned(state: GameState): number {
  return state.projects[0]!.tasks[0]!.storyPointsEarned
}

describe('offline-task-progress-parity', () => {
  it.each([60, 300, 600, 1800, 3600])(
    'matches 1s ticks for %i seconds of coding away time',
    (awaySec) => {
      const before = codingAgentState()
      const live = dispatchChain(
        before,
        Array.from({ length: awaySec }, (_, i) => timeElapsed(T0 + 1000 + i, 1)),
      )
      const offline = dispatchChain(before, [catchUpOfflineMsg(T0 + awaySec * 1000)])

      expect(taskEarned(offline)).toBeCloseTo(taskEarned(live), 4)
      expect(offline.projects[0]!.tasks[0]!.status).toBe(live.projects[0]!.tasks[0]!.status)
    },
  )

  it.each([60, 300, 600, 1800, 3600])(
    'matches live 30Hz ticks for %i seconds of coding away time',
    (awaySec) => {
      const before = codingAgentState()
      const tickSec = TICK_INTERVAL_MS / 1000
      const ticks = Math.round(awaySec / tickSec)
      const live = dispatchChain(
        before,
        Array.from({ length: ticks }, (_, i) => timeElapsed(T0 + 1000 + i, tickSec)),
      )
      const offline = dispatchChain(before, [catchUpOfflineMsg(T0 + awaySec * 1000)])

      expect(taskEarned(offline)).toBeCloseTo(taskEarned(live), 3)
    },
  )
})
