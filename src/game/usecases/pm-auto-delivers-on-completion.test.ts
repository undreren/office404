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

describe('pm-auto-delivers-on-completion', () => {
  function withActivePm(state: ReturnType<typeof initialPlaying>) {
    const withSlot = dispatchChain(state, [buyAgentSlotMsg(T0 + 500)])
    const withCourse = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, 'project_manager')])
    return dispatchChain(withCourse, [toggleSpecialistRoleMsg(T0 + 1500, 'project_manager', true)])
  }

  it('auto-delivers a completed project when the PM specialist is assigned', () => {
    const payment = 500
    const base = stateWithCash({ ...initialPlaying(), tutorialDone: true }, 5000)
    const { state: ready, projectId } = stateWithDeliverableProject(base, payment)
    const withPm = withActivePm(ready)
    const cashBefore = withPm.cash

    const after = dispatchChain(withPm, [timeElapsed(T0 + 3000, 1)])

    expect(after.projects.some((p) => p.id === projectId)).toBe(false)
    expect(after.cash).toBe(cashBefore + payment)
    expect(after.stats.projectsCompleted).toBe(withPm.stats.projectsCompleted + 1)
  })

  it('does not auto-deliver when the PM specialist is unassigned', () => {
    const payment = 500
    const base = stateWithCash({ ...initialPlaying(), tutorialDone: true }, 5000)
    const { state: ready, projectId } = stateWithDeliverableProject(base, payment)
    const withPm = withActivePm(ready)
    const unassigned = dispatchChain(withPm, [toggleSpecialistRoleMsg(T0 + 2000, 'project_manager', false)])
    const cashBefore = unassigned.cash

    const after = dispatchChain(unassigned, [timeElapsed(T0 + 3000, 1)])

    expect(after.projects.some((p) => p.id === projectId)).toBe(true)
    expect(after.cash).toBe(cashBefore)
  })
})
