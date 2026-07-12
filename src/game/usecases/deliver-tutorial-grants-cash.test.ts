import { describe, expect, it } from 'vitest'
import { TUTORIAL_PAYMENT } from '../constants'
import { deliverProjectMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { GameState, Task } from '../types'

describe('deliver-tutorial-grants-cash', () => {
  it('matches use case invariants', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-tutorial',
      projectId: project.id,
      requirementId: req.id,
      title: 'Tutorial task',
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
      testStoryPointsEarned: 2,
    }
    const before: GameState = {
      ...base,
      cash: 0,
      projects: [
        {
          ...project,
          payment: TUTORIAL_PAYMENT,
          requirements: [{ ...req, status: 'refined' }],
          tasks: [task],
          testStoryPointsRequired: 2,
          testStoryPointsCompleted: 2,
          totalStoryPoints: 2,
        },
      ],
    }

    const state = dispatchChain(before, [deliverProjectMsg(T0 + 1000, project.id)])

    expect(state.cash).toBe(TUTORIAL_PAYMENT)
    expect(state.tutorialDone).toBe(true)
  })
})
