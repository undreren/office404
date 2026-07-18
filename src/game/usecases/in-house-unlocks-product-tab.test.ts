import { describe, expect, it } from 'vitest'
import { prestigeHallucinationBuyMsg, activateProductFeatureMsg } from '../messages'
import { canAccessProduct } from '../product'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('in-house-unlocks-product-tab', () => {
  it('unlocks product access and seeds backlog when in_house is purchased', () => {
    const before = {
      ...initialPlaying(),
      meta: {
        ...initialPlaying().meta,
        hallucinationPoints: 10,
      },
    }

    expect(canAccessProduct(before.meta)).toBe(false)
    expect(before.productBacklog).toHaveLength(0)

    const state = dispatchChain(before, [prestigeHallucinationBuyMsg(T0 + 1000, 'in_house')])

    expect(canAccessProduct(state.meta)).toBe(true)
    expect(state.productBacklog.some((item) => item.status === 'queued')).toBe(true)
  })

  it('activates a queued backlog feature into a product project', () => {
    const before = {
      ...initialPlaying(),
      cash: 100_000,
      meta: {
        ...initialPlaying().meta,
        hallucinationLevels: { in_house: 1 },
      },
      productBacklog: [
        {
          id: 'prod-1',
          title: 'Auth module',
          storyPoints: 5,
          status: 'queued' as const,
        },
      ],
    }

    const state = dispatchChain(before, [activateProductFeatureMsg(T0 + 1000, 'prod-1')])

    expect(state.cash).toBe(100_000)
    expect(state.projects.some((p) => p.kind === 'product' && p.status === 'active')).toBe(true)
    expect(state.productBacklog.find((item) => item.id === 'prod-1')?.status).toBe('active')
  })
})
