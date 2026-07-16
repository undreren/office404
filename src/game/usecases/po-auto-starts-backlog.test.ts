import { describe, expect, it } from 'vitest'
import { IN_HOUSE_FIRST_FEATURE_COST } from '../constants'
import {
  buyAgentSlotMsg,
  buyVibingCourseMsg,
  timeElapsed,
  toggleSpecialistRoleMsg,
} from '../messages'
import { PRODUCT_OWNER_COURSE_ID } from '../upgrades'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

describe('po-auto-starts-backlog', () => {
  function withActivePo(state: ReturnType<typeof initialPlaying>) {
    const withSlot = dispatchChain(state, [buyAgentSlotMsg(T0 + 500)])
    const withCourse = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, PRODUCT_OWNER_COURSE_ID)])
    return dispatchChain(withCourse, [toggleSpecialistRoleMsg(T0 + 1500, 'product_owner', true)])
  }

  it('auto-starts a queued backlog feature when PO is on duty and cash is available', () => {
    const before = withActivePo(
      stateWithCash(
        {
          ...initialPlaying(),
          tutorialDone: true,
          meta: { ...initialPlaying().meta, hallucinationLevels: { in_house: 1 } },
          productBacklog: [
            {
              id: 'prod-1',
              title: 'Auth module',
              storyPoints: 5,
              cost: IN_HOUSE_FIRST_FEATURE_COST,
              status: 'queued',
            },
          ],
        },
        IN_HOUSE_FIRST_FEATURE_COST + 1_000,
      ),
    )

    const after = dispatchChain(before, [timeElapsed(T0 + 3000, 1)])

    expect(after.cash).toBe(before.cash - IN_HOUSE_FIRST_FEATURE_COST)
    expect(after.projects.some((p) => p.kind === 'product' && p.status === 'active')).toBe(true)
    expect(after.productBacklog.find((item) => item.id === 'prod-1')?.status).toBe('active')
  })

  it('does not auto-start when PO is unassigned', () => {
    const before = withActivePo(
      stateWithCash(
        {
          ...initialPlaying(),
          tutorialDone: true,
          meta: { ...initialPlaying().meta, hallucinationLevels: { in_house: 1 } },
          productBacklog: [
            {
              id: 'prod-1',
              title: 'Auth module',
              storyPoints: 5,
              cost: IN_HOUSE_FIRST_FEATURE_COST,
              status: 'queued',
            },
          ],
        },
        IN_HOUSE_FIRST_FEATURE_COST + 1_000,
      ),
    )
    const unassigned = dispatchChain(before, [
      toggleSpecialistRoleMsg(T0 + 2000, 'product_owner', false),
    ])

    const after = dispatchChain(unassigned, [timeElapsed(T0 + 3000, 1)])

    expect(after.projects.some((p) => p.kind === 'product')).toBe(false)
    expect(after.productBacklog.find((item) => item.id === 'prod-1')?.status).toBe('queued')
  })
})
