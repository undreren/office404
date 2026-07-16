import { describe, expect, it } from 'vitest'
import { IN_HOUSE_FIRST_FEATURE_COST } from '../constants'
import {
  activateProductFeatureMsg,
  buyAgentSlotMsg,
  buyVibingCourseMsg,
  toggleSpecialistRoleMsg,
} from '../messages'
import { PRODUCT_OWNER_COURSE_ID } from '../upgrades'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

describe('po-auto-conductor-on-new-product', () => {
  function baseState() {
    return stateWithCash(
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
    )
  }

  it('enables conductor on new product work when PO is active and Conductor is owned', () => {
    let state = baseState()
    state = {
      ...state,
      vibingCourses: ['conductor', PRODUCT_OWNER_COURSE_ID],
    }
    state = dispatchChain(state, [
      buyAgentSlotMsg(T0 + 500),
      buyVibingCourseMsg(T0 + 600, PRODUCT_OWNER_COURSE_ID),
      toggleSpecialistRoleMsg(T0 + 700, 'product_owner', true),
      activateProductFeatureMsg(T0 + 800, 'prod-1'),
    ])

    const project = state.projects.find((p) => p.kind === 'product')!
    expect(project.useConductor).toBe(true)
    expect(project.roleCounts.conductor).toBe(1)
    expect(project.roleCounts.refine).toBe(0)
    expect(project.roleCounts.code).toBe(0)
  })

  it('does not auto-enable conductor without PO assigned', () => {
    let state = baseState()
    state = { ...state, vibingCourses: ['conductor'] }

    state = dispatchChain(state, [activateProductFeatureMsg(T0 + 800, 'prod-1')])

    const project = state.projects.find((p) => p.kind === 'product')!
    expect(project.useConductor).toBe(false)
    expect(project.roleCounts.conductor).toBe(0)
  })
})
