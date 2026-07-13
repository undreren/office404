import { describe, expect, it } from 'vitest'
import { timeElapsed } from '../messages'
import { setHallucinationLevel } from '../meta'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { GameState, Task } from '../types'

const INSTANT_QA_SEED = 77

describe('test-hallucination-instant-qa', () => {
  it('can instant-complete QA when a tester picks up a merged PR', () => {
    const base = initialPlaying(INSTANT_QA_SEED)
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-qa-instant',
      projectId: project.id,
      requirementId: req.id,
      title: 'Instant QA target',
      storyPointsRequired: 2,
      storyPointsEarned: 2,
      complexity: 2,
      refined: true,
      status: 'merged',
      assignedAgentId: null,
      completedByAgentId: 'agt-x',
      parentTaskId: null,
      prQuality: 80,
      prQualityStaging: 80,
      hasUndiscoveredBug: false,
      bugDiscovered: false,
      isBugFix: false,
      sourceTaskId: null,
      isReviewComment: false,
      reviewed: true,
      testStoryPointsEarned: 0,
    }
    const before: GameState = {
      ...base,
      meta: setHallucinationLevel(base.meta, 'test', 4),
      projects: [
        {
          ...project,
          requirements: project.requirements.map((r) => ({ ...r, status: 'refined' as const })),
          tasks: [task],
          testStoryPointsRequired: 2,
          testStoryPointsCompleted: 0,
          roleCounts: { refine: 0, code: 0, review: 0, test: 1, conductor: 0 },
        },
      ],
      agents: base.agents.map((a) => ({
        ...a,
        job: 'test' as const,
        projectId: project.id,
        status: 'idle' as const,
        taskId: null,
        contextUsed: 0,
        compactingRemainingSec: 0,
      })),
    }

    const state = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])
    const finished = state.projects[0]!.tasks.find((t) => t.id === task.id)!

    expect(finished.testStoryPointsEarned).toBeGreaterThanOrEqual(finished.storyPointsRequired)
  })
})
