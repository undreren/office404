import { describe, expect, it } from 'vitest'
import {
  buyAgentSlotMsg,
  buyVibingCourseMsg,
  timeElapsed,
  toggleSpecialistRoleMsg,
} from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { stateWithDeliverableProject } from './_helpers/stateWithTutorialComplete'
import { T0 } from './_helpers/testConstants'

describe('sales-auto-delivers-on-completion', () => {
  function withActiveSalesAgent(state: ReturnType<typeof initialPlaying>) {
    const withSlot = dispatchChain(state, [buyAgentSlotMsg(T0 + 500)])
    const withCourse = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, 'sales')])
    return dispatchChain(withCourse, [toggleSpecialistRoleMsg(T0 + 1500, 'sales', true)])
  }

  it('auto-delivers a completed project when the sales specialist is assigned', () => {
    const payment = 500
    const base = stateWithCash({ ...initialPlaying(), tutorialDone: true }, 5000)
    const { state: ready, projectId } = stateWithDeliverableProject(base, payment)
    const withSales = withActiveSalesAgent(ready)
    const cashBefore = withSales.cash

    const after = dispatchChain(withSales, [timeElapsed(T0 + 3000, 1)])

    expect(after.projects.some((p) => p.id === projectId)).toBe(false)
    expect(after.cash).toBe(cashBefore + payment)
    expect(after.stats.projectsCompleted).toBe(withSales.stats.projectsCompleted + 1)
  })

  it('does not auto-deliver when the sales specialist is unassigned', () => {
    const payment = 500
    const base = stateWithCash({ ...initialPlaying(), tutorialDone: true }, 5000)
    const { state: ready, projectId } = stateWithDeliverableProject(base, payment)
    const withSales = withActiveSalesAgent(ready)
    const unassigned = dispatchChain(withSales, [toggleSpecialistRoleMsg(T0 + 2000, 'sales', false)])
    const cashBefore = unassigned.cash

    const after = dispatchChain(unassigned, [timeElapsed(T0 + 3000, 1)])

    expect(after.projects.some((p) => p.id === projectId)).toBe(true)
    expect(after.cash).toBe(cashBefore)
  })
})
