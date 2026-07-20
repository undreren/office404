import { describe, expect, it } from 'vitest'
import { catchUpOfflineMsg, buyVibingCourseMsg, timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'
import type { GameState, Task } from '../types'

const AWAY_SEC = 60

function reviewSpawningState(): GameState {
  const base = dispatchChain(stateWithCash(initialPlaying(), 2000), [
    buyVibingCourseMsg(T0 + 500, 'offline'),
  ])
  const project = base.projects[0]!
  const req = project.requirements[0]!
  const task: Task = {
    id: 'task-review',
    projectId: project.id,
    requirementId: req.id,
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
    reviewJobDuration: 0.01,
    reviewJobProgress: 0,
  }
  return {
    ...base,
    nextId: 900,
    projects: [
      {
        ...project,
        tasks: [task],
        roleCounts: { refine: 0, code: 0, review: 1, test: 0, conductor: 0 },
      },
    ],
    agents: base.agents.map((a) => ({
      ...a,
      job: 'review' as const,
      projectId: project.id,
      status: 'reviewing' as const,
      taskId: task.id,
      contextUsed: 0,
      compactingRemainingSec: 0,
      jobProgress: 0,
      jobDuration: 0.01,
    })),
    snapshotAt: T0,
  }
}

describe('offline-progress-preserves-next-id', () => {
  it('keeps nextId aligned with live tick-by-tick simulation after offline catch-up', () => {
    const before = reviewSpawningState()
    const live = dispatchChain(
      before,
      Array.from({ length: AWAY_SEC }, (_, i) => timeElapsed(T0 + 1000 + i, 1)),
    )
    const offline = dispatchChain(before, [catchUpOfflineMsg(T0 + AWAY_SEC * 1000)])

    expect(live.nextId).toBeGreaterThan(before.nextId)
    expect(offline.nextId).toBeGreaterThanOrEqual(live.nextId)

    const liveCommentIds = live.projects[0]!
      .tasks.filter((t) => t.isReviewComment)
      .map((t) => t.id)
    const offlineCommentIds = offline.projects[0]!
      .tasks.filter((t) => t.isReviewComment)
      .map((t) => t.id)
    expect(offlineCommentIds).toEqual(liveCommentIds)
  })
})
