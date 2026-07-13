import { describe, expect, it } from 'vitest'
import { LATE_FEE_PERCENT } from '../constants'
import { advanceGameDays } from './_helpers/advanceGameDays'
import { stateWithAcceptedProject } from './_helpers/stateWithAcceptedProject'
import { T0 } from './_helpers/testConstants'
import type { Task } from '../types'

describe('project-deadline-late-applies-fee', () => {
  it('matches use case invariants', () => {
    let state = { ...stateWithAcceptedProject(), reputation: 5 }
    const project = state.projects.find((p) => !p.isTutorial)!
    const paymentBefore = project.payment
    const repBefore = state.reputation
    const openTask: Task = {
      id: 'task-late-open',
      projectId: project.id,
      requirementId: 'req-late',
      title: 'Late blocker',
      storyPointsRequired: 5,
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

    state = {
      ...state,
      projects: state.projects.map((p) =>
        p.id === project.id ? { ...p, daysRemaining: 0.5, tasks: [openTask] } : p,
      ),
    }
    state = advanceGameDays(state, 1, T0 + 50_000)

    const after = state.projects.find((p) => p.id === project.id)!
    const expectedFee = Math.round(paymentBefore * LATE_FEE_PERCENT)

    expect(after.lateCount).toBe(1)
    expect(after.payment).toBe(paymentBefore - expectedFee)
    expect(state.reputation).toBeLessThan(repBefore)
  })
})
