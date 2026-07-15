import { describe, expect, it } from 'vitest'
import { TUTORIAL_PAYMENT } from '../constants'
import { deliverProjectMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import { fullyShippableTask } from './_helpers/taskTokens'
import type { GameState } from '../types'
import { taskTokensRequired } from '../mechanics'

describe('lead-spawns-on-tutorial-complete', () => {
  it('spawns a lead immediately when the tutorial project is delivered', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task = fullyShippableTask({
      id: 'task-tutorial',
      projectId: project.id,
      requirementId: req.id,
      title: 'Tutorial task',
      storyPointsRequired: 2,
      storyPointsEarned: 0,
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
    })
    const testTok = taskTokensRequired(2, 'test')
    const before: GameState = {
      ...base,
      cash: 0,
      projects: [
        {
          ...project,
          payment: TUTORIAL_PAYMENT,
          requirements: [{ ...req, status: 'refined' }],
          tasks: [task],
          testStoryPointsRequired: testTok,
          testStoryPointsCompleted: testTok,
          totalStoryPoints: 2,
        },
      ],
    }

    const state = dispatchChain(before, [deliverProjectMsg(T0 + 1000, project.id)])

    expect(state.tutorialDone).toBe(true)
    expect(state.leads.filter((l) => l.status === 'available')).toHaveLength(1)
  })
})
