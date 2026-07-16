import { describe, expect, it } from 'vitest'
import {
  buyAgentSlotMsg,
  buyVibingCourseMsg,
  timeElapsed,
  toggleSpecialistRoleMsg,
} from '../messages'
import { PRODUCT_OWNER_COURSE_ID } from '../upgrades'
import type { Project } from '../types'
import { taskTokensRequired } from '../mechanics'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
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

describe('po-auto-delivers-on-completion', () => {
  function withActivePo(state: ReturnType<typeof initialPlaying>) {
    const funded = stateWithCash(state, 5_000)
    const withSlot = dispatchChain(funded, [buyAgentSlotMsg(T0 + 500)])
    const withCourse = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, PRODUCT_OWNER_COURSE_ID)])
    return dispatchChain(withCourse, [toggleSpecialistRoleMsg(T0 + 1500, 'product_owner', true)])
  }

  it('auto-delivers a completed product project when PO is on duty', () => {
    const before = withActivePo({
      ...initialPlaying(),
      tutorialDone: true,
      meta: { ...initialPlaying().meta, hallucinationLevels: { in_house: 1 } },
      projects: [deliverableProductProject()],
      mrr: 0,
      productFeaturesShipped: 0,
    })

    const after = dispatchChain(before, [timeElapsed(T0 + 3000, 1)])

    expect(after.projects.some((p) => p.id === 'prod-proj-1')).toBe(false)
    expect(after.mrr).toBeGreaterThan(0)
    expect(after.stats.productsShipped).toBe(1)
  })
})
