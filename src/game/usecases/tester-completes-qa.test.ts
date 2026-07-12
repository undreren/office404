import { describe, expect, it } from 'vitest'
import { JUST_MERGE_PR_QUALITY } from '../constants'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { GameState, Task } from '../types'

describe('tester-completes-qa', () => {
  it('matches use case invariants', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-qa',
      projectId: project.id,
      requirementId: req.id,
      title: 'QA me',
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
    let state: GameState = {
      ...base,
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
        status: 'testing' as const,
        taskId: task.id,
        contextUsed: 0,
        compactingRemainingSec: 0,
      })),
    }

    for (let tick = 0; tick < 500; tick++) {
      state = dispatchChain(state, [timeElapsed(T0 + tick * 10, 10)])
      const current = state.projects[0]!.tasks.find((t) => t.id === task.id)!
      if (current.testStoryPointsEarned >= current.storyPointsRequired) break
    }

    const finished = state.projects[0]!.tasks.find((t) => t.id === task.id)!
    expect(finished.testStoryPointsEarned).toBeGreaterThanOrEqual(finished.storyPointsRequired)
    expect(finished.prQuality).toBeGreaterThan(JUST_MERGE_PR_QUALITY)
  })
})
