import { describe, expect, it } from 'vitest'
import { prestigeHallucinationBuyMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateAtAgentCapacity } from './_helpers/stateAtAgentCapacity'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

function withHallucinationPoints(state: ReturnType<typeof initialPlaying>, points: number) {
  return {
    ...state,
    meta: {
      ...state.meta,
      hallucinationPoints: points,
    },
  }
}

describe('hallucination-specialist-auto-enroll', () => {
  it('grants the vibing course and auto-assigns when procurement hallucination is first purchased', () => {
    const before = withHallucinationPoints(stateWithCash(initialPlaying(), 500), 5)

    const after = dispatchChain(before, [prestigeHallucinationBuyMsg(T0 + 1000, 'procurement')])

    expect(after.meta.hallucinationLevels.procurement).toBe(1)
    expect(after.vibingCourses).toContain('procurement')
    expect(after.vibingCourseTiers.procurement).toBe(1)
    expect(after.assignedSpecialistRoles).toContain('procurement')
    expect(after.agents.some((a) => a.isAutomation && a.automationJob === 'procurement')).toBe(true)
  })

  it('grants the vibing course and auto-assigns when sales hallucination is first purchased', () => {
    const before = withHallucinationPoints(stateWithCash(initialPlaying(), 500), 5)

    const after = dispatchChain(before, [prestigeHallucinationBuyMsg(T0 + 1000, 'sales')])

    expect(after.vibingCourses).toContain('sales')
    expect(after.assignedSpecialistRoles).toContain('sales')
    expect(after.agents.some((a) => a.isAutomation && a.automationJob === 'sales')).toBe(true)
  })

  it('does not leave the vibing course purchasable after hallucination unlock', () => {
    const before = withHallucinationPoints(stateWithCash(initialPlaying(), 500), 5)

    const after = dispatchChain(before, [prestigeHallucinationBuyMsg(T0 + 1000, 'marketing')])

    expect(after.vibingCourses).toContain('marketing')
    expect(after.vibingCourseTiers.marketing).toBe(1)
  })

  it('does not force re-assign when upgrading an already-unlocked specialist hallucination', () => {
    const before = withHallucinationPoints(
      {
        ...stateWithCash(initialPlaying(), 500),
        vibingCourses: ['customer'],
        vibingCourseTiers: { customer: 1 },
        assignedSpecialistRoles: [],
        meta: {
          ...initialPlaying().meta,
          hallucinationPoints: 10,
          hallucinationLevels: { customer: 1 },
        },
      },
      10,
    )

    const after = dispatchChain(before, [prestigeHallucinationBuyMsg(T0 + 1000, 'customer')])

    expect(after.meta.hallucinationLevels.customer).toBe(2)
    expect(after.assignedSpecialistRoles).not.toContain('customer')
    expect(after.agents.some((a) => a.isAutomation && a.automationJob === 'customer')).toBe(false)
  })

  it('yeets a project agent when auto-assigning on a full roster', () => {
    const capped = withHallucinationPoints(stateWithCash(stateAtAgentCapacity(), 350), 5)
    const project = capped.projects[0]!

    const after = dispatchChain(capped, [prestigeHallucinationBuyMsg(T0 + 1000, 'marketing')])

    expect(after.assignedSpecialistRoles).toContain('marketing')
    expect(after.agents.some((a) => a.isAutomation && a.automationJob === 'marketing')).toBe(true)
    expect(after.agents.some((a) => a.projectId === project.id && a.job === 'code')).toBe(false)
  })
})
