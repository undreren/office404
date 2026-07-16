import { describe, expect, it } from 'vitest'
import {
  buyAgentSlotMsg,
  buyVibingCourseMsg,
  timeElapsed,
  toggleSpecialistRoleMsg,
} from '../messages'
import type { Project } from '../types'
import { taskTokensRequired } from '../mechanics'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { stateWithDeliverableProject } from './_helpers/stateWithTutorialComplete'
import { fullyShippableTask } from './_helpers/taskTokens'
import { T0 } from './_helpers/testConstants'

function deliverableProductProject(): Project {
  const projectId = 'prod-proj-1'
  const reqId = 'req-prod-1'
  const testTok = taskTokensRequired(5, 'test')
  return {
    id: projectId,
    clientName: 'In-House Product',
    clientTagline: 'MRR or bust.',
    blurb: 'Auth module',
    payment: 0,
    durationDays: 0,
    daysRemaining: 9999,
    isTutorial: false,
    repPenaltyMultiplier: 1,
    deliveryQuality: 80,
    testPercent: 100,
    testStoryPointsRequired: testTok,
    testStoryPointsCompleted: testTok,
    totalStoryPoints: 5,
    status: 'active',
    kind: 'product',
    requirements: [
      { id: reqId, projectId, title: 'Auth', storyPoints: 5, status: 'refined', refinePassesUsed: 0 },
    ],
    tasks: [
      fullyShippableTask({
        id: 'task-1',
        projectId,
        requirementId: reqId,
        title: 'Ship it',
        storyPointsRequired: 5,
        storyPointsEarned: 0,
        complexity: 5,
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
        refinePassesRemaining: 0,
      }),
    ],
    lateCount: 0,
    roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 0 },
    useConductor: false,
    duplicateProjectId: null,
    mrrContribution: 0,
    slotIndex: 0,
  }
}

describe('pm-delivers-client-only', () => {
  function withActivePm(state: ReturnType<typeof initialPlaying>) {
    const withSlot = dispatchChain(state, [buyAgentSlotMsg(T0 + 500)])
    const withCourse = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, 'project_manager')])
    return dispatchChain(withCourse, [toggleSpecialistRoleMsg(T0 + 1500, 'project_manager', true)])
  }

  it('auto-delivers client projects but not product projects', () => {
    const payment = 500
    const base = stateWithCash({ ...initialPlaying(), tutorialDone: true }, 5000)
    const { state: ready, projectId } = stateWithDeliverableProject(base, payment)
    const withPm = withActivePm({
      ...ready,
      projects: [...ready.projects, deliverableProductProject()],
    })
    const cashBefore = withPm.cash
    const mrrBefore = withPm.mrr

    const after = dispatchChain(withPm, [timeElapsed(T0 + 3000, 1)])

    expect(after.projects.some((p) => p.id === projectId)).toBe(false)
    expect(after.cash).toBe(cashBefore + payment)
    expect(after.projects.some((p) => p.id === 'prod-proj-1')).toBe(true)
    expect(after.mrr).toBe(mrrBefore)
  })
})
